const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getAutomatedReplyPermission,
} = require('../services/aiReplyGuard');

const aiItem = {
  companyId: 'default',
  phone: '5531999990001',
  sessionId: 'main',
  metadata: {
    ai_response: true,
    conversationId: 'conversation-ai-toggle-test',
  },
};

test('blocks a queued AI reply when the backend conversation toggle is off', async () => {
  const permission = await getAutomatedReplyPermission(aiItem, {
    isAIEnabled: () => true,
    sessionManager: { getSession: () => null },
    conversationRepository: {
      getConversationById: async () => ({ aiEnabled: false }),
      getConversationByPhone: async () => null,
    },
  });

  assert.deepEqual(permission, { allowed: false, reason: 'conversation_ai_off' });
});

test('allows a queued AI reply only after the backend confirms it is enabled', async () => {
  const permission = await getAutomatedReplyPermission(aiItem, {
    isAIEnabled: () => true,
    sessionManager: { getSession: () => null },
    conversationRepository: {
      getConversationById: async () => ({ aiEnabled: true }),
      getConversationByPhone: async () => null,
    },
  });

  assert.deepEqual(permission, { allowed: true, reason: 'ai_enabled' });
});

test('fails closed when the AI toggle cannot be verified', async () => {
  const permission = await getAutomatedReplyPermission(aiItem, {
    isAIEnabled: () => true,
    sessionManager: { getSession: () => null },
    conversationRepository: {
      getConversationById: async () => { throw new Error('database unavailable'); },
      getConversationByPhone: async () => null,
    },
  });

  assert.deepEqual(permission, { allowed: false, reason: 'ai_toggle_verification_failed' });
});

test('does not block human messages with the AI guard', async () => {
  const permission = await getAutomatedReplyPermission({
    ...aiItem,
    metadata: { source: 'human' },
  });

  assert.deepEqual(permission, { allowed: true, reason: 'not_ai_response' });
});

test('preserves a disabled conversation AI toggle while persisting inbound messages', () => {
  const criticalFiles = [
    'backend/services/messageService.js',
    'backend/services/enterprise/message-service.js',
    'backend/services/whatsapp/inbound/pipeline.js',
  ];

  for (const filePath of criticalFiles) {
    const source = require('node:fs').readFileSync(filePath, 'utf8');
    assert.equal(
      /updateConversationAIEnabled\([^\n]*true/.test(source),
      false,
      filePath + ' must not re-enable AI when an inbound message arrives',
    );
  }
});


test('uses a 24 hour human takeover pause and releases it after expiry', () => {
  const runtimeService = require('../inbox-core/inbox/services/ConversationRuntimeService');
  assert.equal(runtimeService.DEFAULT_HUMAN_TIMEOUT_MS, 24 * 60 * 60 * 1000);

  const store = {};
  const runtime = runtimeService.registerHumanReply(store, 'conversation-human-timeout-test');
  assert.equal(runtime.controlMode, 'human_active');
  assert.ok(Date.parse(runtime.aiPausedUntil) > Date.now());

  store.conversationRuntime['conversation-human-timeout-test'].aiPausedUntil = new Date(Date.now() - 1000).toISOString();
  const refreshed = runtimeService.refreshExpiredHumanTakeover(store, 'conversation-human-timeout-test');
  assert.equal(refreshed.expired, true);
  assert.equal(refreshed.runtime.controlMode, 'ai_active');
  assert.equal(refreshed.runtime.aiPausedUntil, null);
});
