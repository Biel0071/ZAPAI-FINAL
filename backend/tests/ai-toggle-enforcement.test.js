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