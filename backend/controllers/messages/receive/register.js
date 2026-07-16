/**
 * Register inbound/outbound messages into DB + publish side effects.
 * Extracted from controllers/messagesController.js (Phase 2b-3b).
 *
 * `registerIncomingMessage`:
 *   - Dedupes by external message id.
 *   - Persists via messageService.
 *   - Fires audit log, webhook dispatch, AI intelligence capture.
 *
 * `registerOutgoingMessage`:
 *   - Persists via persistOutgoingMessageRecord.
 *   - Disables AI for human-originated sends.
 *   - Emits realtime inbox event for the sender preview.
 *   - Fires audit log, webhook dispatch, AI intelligence capture.
 */

const sessionManager = require('../../../services/sessionManager');
const messageService = require('../../../services/messageService');
const conversationRepository = require('../../../repositories/conversationRepository');
const MessageAuditService = require('../../../services/messageAuditService');
const webhookService = require('../../../services/webhookService');
const aiIntelligenceService = require('../../../services/aiIntelligenceService');
const conversationRuntimeService = require('../../../inbox-core/inbox/services/ConversationRuntimeService');
const { formatApiMessage, toExactMessageText } = require('../shared');
const { shouldPersistExternalMessageId } = require('./dedupe');
const { persistOutgoingMessageRecord } = require('../send/persistOutgoing');
const { emitInboxRealtimeEventFromStore } = require('../realtime/inboxEvents');

async function registerIncomingMessage(store, payload) {
  const exactText = toExactMessageText(payload.text);
  const externalMessageId = String(payload.externalMessageId || '').trim();

  if (!shouldPersistExternalMessageId(externalMessageId)) {
    return {
      duplicate: true,
      isNewConversation: false,
      message: null,
    };
  }

  MessageAuditService.log('message_received', payload);
  // eslint-disable-next-line no-console
  console.log('[BAILEYS] inbound message received', {
    id: externalMessageId || null,
    phone: payload.phone,
    sessionId: payload.sessionId || sessionManager.DEFAULT_SESSION,
    text: exactText || '[media]',
    timestamp: payload.timestamp || null,
  });

  let result = null;

  try {
    result = await messageService.persistIncomingMessage({
      ...payload,
      text: exactText,
      sessionId: payload.sessionId || sessionManager.DEFAULT_SESSION,
      status: 'received',
    });

    if (result?.message) {
      // eslint-disable-next-line no-console
      console.log('MESSAGE SAVED');
      console.log(`[TEMP_LOG] message.received - CONVERSATION_ID: "${result.message.conversationId || result.conversation?.id || ''}", PHONE: "${payload.phone}", REMOTE_JID: "${payload.phone || ''}", SESSION_ID: "${result.message.sessionId || payload.sessionId || ''}", MESSAGE_ID: "${result.message.id || ''}", SOURCE: "inbound_baileys"`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('MESSAGE SAVE ERROR:', err);
    throw err;
  }

  if (result.isNewConversation) {
    // eslint-disable-next-line no-console
    console.log(`[CRM] new conversation created: ${payload.phone}`);
  }

  // eslint-disable-next-line no-console
  console.log(`[INCOMING] message from ${payload.phone}`);
  MessageAuditService.log('message_persisted', result.message);

  await webhookService.dispatchEvent({
    tenantId: payload.companyId,
    event: 'message_received',
    payload: {
      conversationId: result?.message?.conversationId || null,
      messageId: result?.message?.id || null,
      phone: payload.phone,
      text: exactText || '',
      timestamp: payload.timestamp || new Date().toISOString(),
    },
  });

  try {
    await aiIntelligenceService.captureMessageEvent(store, {
      conversationId: result?.message?.conversationId || result?.conversation?.id || null,
      direction: 'incoming',
      mediaType: result?.message?.mediaType || payload.mediaType || null,
      messageId: result?.message?.id || externalMessageId || null,
      name: result?.conversation?.name || payload.name || payload.phone,
      phone: payload.phone,
      source: 'incoming',
      text: exactText || '',
      timestamp:
        result?.message?.createdAt || payload.timestamp || new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      '[AI INTELLIGENCE] Failed to capture inbound message:',
      error?.message || error
    );
  }

  return result;
}

async function registerOutgoingMessage(store, payload) {
  const exactText = toExactMessageText(payload.text);
  MessageAuditService.log('message_sent', payload);

  const result = await persistOutgoingMessageRecord(store, {
    ...payload,
    name: payload.name || 'Unknown',
    sessionId: payload.sessionId || sessionManager.DEFAULT_SESSION,
    text: exactText,
  });

  // eslint-disable-next-line no-console
  console.log(`[OUTGOING] message sent to ${payload.phone}`);
  MessageAuditService.log('message_persisted', result?.message);

  if (!result?.message?.id) {
    throw new Error('Outgoing message persistence did not return a valid id.');
  }

  console.log(`[TEMP_LOG] message.sent - CONVERSATION_ID: "${result?.message?.conversationId || result?.conversation?.id || ''}", PHONE: "${payload.phone}", REMOTE_JID: "${payload.phone || ''}", SESSION_ID: "${result?.message?.sessionId || payload.sessionId || ''}", MESSAGE_ID: "${result?.message?.id || ''}", SOURCE: "${payload.source || 'human_agent'}"`);

  if (result?.message) {
    if (payload.source === 'human' && result?.conversation?.id) {
      const runtime = conversationRuntimeService.registerHumanReply(store, result.conversation.id);
      const updatedConversation = await conversationRepository.updateConversationState(result.conversation.id, {
        aiEnabled: false,
      });
      const payloadUpdate = {
        ...(updatedConversation || result.conversation),
        aiEnabled: false,
        ai_enabled: false,
        aiPausedUntil: runtime.aiPausedUntil,
        controlMode: runtime.controlMode,
        humanActive: true,
      };
      const io = store?.io || global.io;
      io?.emit('conversation:update', payloadUpdate);
      io?.emit('conversation_updated', payloadUpdate);
      io?.emit('conversation-update', payloadUpdate);
    }

    emitInboxRealtimeEventFromStore(store, formatApiMessage(result.message));
    // eslint-disable-next-line no-console
    console.log('[OUTGOING] realtime inbox event emitted');

    const conversationKey = String(result.message.conversationId || payload.phone || '');
    if (
      payload.source === 'human' &&
      payload.systemTag !== 'absence' &&
      store?.absenceState &&
      conversationKey
    ) {
      delete store.absenceState[conversationKey];
      delete store.absenceState[String(payload.phone || '')];
    }

    await webhookService.dispatchEvent({
      tenantId: payload.companyId,
      event: 'message_sent',
      payload: {
        conversationId: result.message.conversationId,
        messageId: result.message.id,
        phone: payload.phone,
        text: exactText || '',
      },
    });

    void aiIntelligenceService
      .captureMessageEvent(store, {
        conversationId: result.message.conversationId,
        direction: 'outgoing',
        mediaType: result.message.mediaType || payload.mediaType || null,
        messageId: result.message.id,
        name: result?.conversation?.name || payload.name || payload.phone,
        phone: payload.phone,
        source: payload.source || 'outgoing',
        text: exactText || '',
        timestamp: result.message.createdAt || new Date().toISOString(),
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(
          '[AI INTELLIGENCE] Failed to capture outbound message:',
          error?.message || error
        );
      });
  }

  return result;
}

module.exports = {
  registerIncomingMessage,
  registerOutgoingMessage,
};
