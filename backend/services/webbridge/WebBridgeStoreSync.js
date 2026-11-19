'use strict';

/**
 * WebBridgeStoreSync — ZAPFLOW Unified WhatsApp Web Engine
 * Responsável pela sincronização instantânea de conversas, contatos,
 * catálogo e escuta de mensagens em tempo real diretamente do Store do WhatsApp Web.
 */

const conversationRepository = require('../../src/data/repositories/conversationRepository');
const messageRepository = require('../../src/data/repositories/messageRepository');
const messageDedupeService = require('../messageDedupeService');

class WebBridgeStoreSync {
  /**
   * Conecta os listeners em tempo real na página do Chromium
   */
  async attachRealtimeListener(page, sessionId = 'main', companyId = 'default') {
    if (!page || page.isClosed()) return;

    try {
      // Expõe callback Node.js para ser chamado pelo JavaScript do WhatsApp Web
      try {
        await page.exposeFunction('__zapflowOnWebMessage', async (msgPayload) => {
          try {
            await this.handleIncomingWebMessage(msgPayload, sessionId, companyId);
          } catch (err) {
            console.warn('[WEB-STORE-SYNC] Erro no processamento de mensagem recebida:', err.message);
          }
        });
      } catch (e) {
        // Ignora se a função já foi exposta anteriormente na mesma página
      }

      // Injeta observador de mensagens no Store interno do WhatsApp Web
      await page.evaluate(() => {
        try {
          if (window.__zapflowListenerAttached) return;
          window.__zapflowListenerAttached = true;

          const hookStore = () => {
            if (window.Store && window.Store.Msg) {
              window.Store.Msg.on('add', (msg) => {
                try {
                  if (!msg || !window.__zapflowOnWebMessage) return;
                  const jid = msg.chat?.id?._serialized || msg.id?.remote?._serialized || (msg.chat && msg.chat.id) || '';
                  const payload = {
                    id: msg.id?._serialized || String(msg.id || Date.now()),
                    fromMe: Boolean(msg.id?.fromMe || msg.fromMe),
                    remoteJid: jid,
                    senderPhone: jid.split('@')[0].split(':')[0].replace(/\D/g, ''),
                    body: msg.body || msg.caption || '',
                    type: msg.type || 'chat',
                    timestamp: msg.t ? msg.t * 1000 : Date.now(),
                    hasMedia: Boolean(msg.hasMedia || msg.mimetype),
                    mimetype: msg.mimetype || null,
                  };
                  window.__zapflowOnWebMessage(payload);
                } catch (_) {}
              });
              console.log('[ZAPFLOW] Store.Msg listener conectado com sucesso no WhatsApp Web.');
            } else {
              setTimeout(hookStore, 2000);
            }
          };

          hookStore();
        } catch (_) {}
      });

      console.log(`[WEB-STORE-SYNC] Listener em tempo real ativo para sessão "${sessionId}".`);
    } catch (err) {
      console.warn(`[WEB-STORE-SYNC] Aviso ao anexar listener em tempo real para "${sessionId}":`, err.message);
    }
  }

  /**
   * Processa a mensagem capturada do WhatsApp Web e sincroniza com o banco e Socket.IO
   */
  async handleIncomingWebMessage(msg, sessionId, companyId) {
    if (!msg || !msg.remoteJid) return;

    const dedupeKey = `webbridge:${sessionId}:${msg.id}`;
    if (messageDedupeService.isDuplicate(dedupeKey)) return;
    messageDedupeService.markProcessed(dedupeKey);

    const cleanPhone = msg.senderPhone || msg.remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
    if (!cleanPhone) return;

    // 1. Garante ou atualiza a conversa no PostgreSQL
    let conv = null;
    try {
      conv = await conversationRepository.findByPhone(cleanPhone, companyId);
      if (!conv) {
        conv = await conversationRepository.createConversation({
          phone: cleanPhone,
          companyId,
          sessionId,
          name: cleanPhone,
          lastMessage: msg.body || (msg.hasMedia ? '[Mídia]' : ''),
          status: 'open',
          unreadCount: msg.fromMe ? 0 : 1,
        });
      } else {
        await conversationRepository.updateLastMessage(conv.id, {
          lastMessage: msg.body || (msg.hasMedia ? '[Mídia]' : ''),
          lastMessageType: msg.type || 'text',
          updatedAt: new Date(msg.timestamp || Date.now()),
          unreadIncrement: msg.fromMe ? 0 : 1,
        });
      }
    } catch (_) {}

    // 2. Salva a mensagem no messageRepository
    let savedMsg = null;
    try {
      savedMsg = await messageRepository.createMessage({
        id: msg.id,
        conversationId: conv ? conv.id : cleanPhone,
        companyId,
        sessionId,
        fromMe: msg.fromMe,
        content: msg.body || '',
        mediaType: msg.type || 'text',
        status: msg.fromMe ? 'sent' : 'received',
        timestamp: new Date(msg.timestamp || Date.now()),
      });
    } catch (_) {}

    // 3. Emite evento em tempo real via Socket.IO para o Inbox
    if (global.io) {
      global.io.emit('message:new', {
        id: msg.id,
        conversationId: conv ? conv.id : cleanPhone,
        remoteJid: msg.remoteJid,
        phone: cleanPhone,
        content: msg.body || '',
        fromMe: msg.fromMe,
        timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
        type: msg.type || 'text',
        sessionId,
        companyId,
      });

      global.io.emit('conversation:update', {
        id: conv ? conv.id : cleanPhone,
        lastMessage: msg.body || '',
        updatedAt: new Date().toISOString(),
      });
    }

    // 4. Se for mensagem do cliente e não enviada por mim, engatilha o pipeline de IA se habilitado
    if (!msg.fromMe && conv) {
      try {
        const { processAI } = require('../ai.service');
        if (typeof processAI === 'function') {
          processAI({
            conversationId: conv.id,
            sessionId,
            companyId,
            messageText: msg.body,
            phone: cleanPhone,
          }).catch(() => {});
        }
      } catch (_) {}
    }
  }

  /**
   * Sincroniza todas as conversas e contatos existentes no WhatsApp Web ao conectar
   */
  async syncChatsAndContacts(page, sessionId = 'main', companyId = 'default') {
    if (!page || page.isClosed()) return { chats: 0, contacts: 0 };

    try {
      console.log(`[WEB-STORE-SYNC] Sincronizando conversas do WhatsApp Web para "${sessionId}"...`);

      const chatsData = await page.evaluate(async () => {
        try {
          if (!window.Store || !window.Store.Chat) {
            // Fallback via DOM
            const items = Array.from(document.querySelectorAll('#pane-side div[role="listitem"]'));
            return items.map((el) => {
              const text = el.innerText || '';
              const lines = text.split('\n').filter(Boolean);
              return {
                name: lines[0] || 'Contato WhatsApp',
                lastMessage: lines[lines.length - 1] || '',
                raw: text,
              };
            });
          }

          // Leitura direta e ultrarrápida do Store interno
          const models = window.Store.Chat.models || [];
          return models.slice(0, 50).map(c => ({
            id: c.id?._serialized || '',
            name: c.name || c.formattedTitle || c.contact?.name || '',
            unreadCount: c.unreadCount || 0,
            t: c.t ? c.t * 1000 : Date.now(),
            lastMessage: c.lastReceivedKey ? (c.msgs?.last()?.body || '') : '',
            isGroup: Boolean(c.isGroup),
          }));
        } catch (_) {
          return [];
        }
      });

      console.log(`[WEB-STORE-SYNC] Extraídas ${chatsData.length} conversas do WhatsApp Web.`);

      // Persiste conversas no banco de dados e notifica frontend
      for (const chat of chatsData) {
        if (!chat.id) continue;
        const cleanPhone = chat.id.replace(/@.*$/, '').replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 10) continue;
        try {
          const existing = await conversationRepository.findByPhone(cleanPhone, companyId);
          if (!existing) {
            await conversationRepository.createConversation({
              phone: cleanPhone,
              companyId,
              sessionId,
              name: chat.name || cleanPhone,
              lastMessage: chat.lastMessage || '',
              status: 'open',
              unreadCount: chat.unreadCount || 0,
            });
          }
        } catch (_) {}
      }

      if (global.io) {
        global.io.emit('conversations:sync_complete', {
          sessionId,
          companyId,
          count: chatsData.length,
        });
      }

      return { chats: chatsData.length };
    } catch (err) {
      console.warn(`[WEB-STORE-SYNC] Aviso na sincronização de conversas:`, err.message);
      return { chats: 0, error: err.message };
    }
  }
}

module.exports = new WebBridgeStoreSync();
