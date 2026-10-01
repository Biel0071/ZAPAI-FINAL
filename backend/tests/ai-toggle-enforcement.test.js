const assert = require('node:assert/strict');
const test = require('node:test');
const settingsPath = require.resolve('../src/data/repositories/systemSettingsRepository');
require.cache[settingsPath] = { exports: { getSetting: async () => null } };

const {
  getAutomatedReplyPermission: checkAutomatedReplyPermission,
} = require('../services/aiReplyGuard');
const getAutomatedReplyPermission = (item, dependencies) => checkAutomatedReplyPermission(item, {
  getAutomationScope: async () => ({ mode: 'all', sessionId: null, phones: [] }),
  ...dependencies,
});

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
      getConversationById: async () => ({ aiEnabled: false, companyId: 'default', sessionId: 'main' }),
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
      getConversationById: async () => ({ aiEnabled: true, companyId: 'default', sessionId: 'main' }),
      getConversationByPhone: async () => null,
    },
  });

  assert.deepEqual(permission, { allowed: true, reason: 'ai_enabled' });
});

test('checks the queued AI toggle for the item tenant', async () => {
  let checkedTenant = null;
  const permission = await getAutomatedReplyPermission({ ...aiItem, companyId: 'store-42' }, {
    isAIEnabled: (tenantId) => {
      checkedTenant = tenantId;
      return true;
    },
    sessionManager: { getSession: () => null },
    conversationRepository: {
      getConversationById: async () => ({ aiEnabled: true, companyId: 'store-42', sessionId: 'main' }),
      getConversationByPhone: async () => null,
    },
  });

  assert.equal(checkedTenant, 'store-42');
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
  const runtimeService = require('../src/messaging/inbox/inbox/services/ConversationRuntimeService');
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

test('denies an AI reply if saved conversation belongs to another company or connection', async () => {
  for (const conversation of [{companyId:'other',sessionId:'main'}, {companyId:'default',sessionId:'other'}]) {
    const result=await getAutomatedReplyPermission(aiItem,{isAIEnabled:()=>true,sessionManager:{getSession:()=>null},conversationRepository:{getConversationById:async (id,companyId)=>{assert.equal(companyId,'default');return {...conversation,aiEnabled:true}},getConversationByPhone:async()=>null}});
    assert.equal(result.allowed,false);assert.equal(result.reason,'conversation_context_mismatch');
  }
});

test('legacy automatic flow and absence/followup queue markers obey selected scope and global pause', async () => {
  for (const metadata of [{ source: 'ai_auto_trigger' }, { source: 'ai' }, { systemTag: 'absence' }, { systemTag: 'reactivation_followup' }]) {
    const result = await getAutomatedReplyPermission({ ...aiItem, metadata }, {
      isAIEnabled: () => true,
      getAutomationScope: async () => ({ mode: 'selected', sessionId: 'main', phones: ['5531993807167'] }),
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'automation_phone_outside_scope');
    const paused = await getAutomatedReplyPermission({ ...aiItem, metadata }, { isAIEnabled: () => false });
    assert.equal(paused.allowed, false); assert.equal(paused.reason, 'global_ai_off');
  }
});
