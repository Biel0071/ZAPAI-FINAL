const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createController({ connected = true, automationPaused = true, sessionOwned = true, queueItems = [], followups = [] } = {}) {
  const calls = [];
  const services = {
    queue: {
      listSessionPausedItems: () => queueItems,
      resumeContactItems: async (args) => { calls.push(['resumeQueueContact', args.phone]); return 1; },
      cancelContactItems: async (args) => { calls.push(['cancelQueueContact', args.phone]); return 1; },
      resumeSessionItems: async () => { calls.push(['resumeAllQueue']); return 2; },
    },
    campaigns: {
      listSessionPausedCampaignContacts: async () => [],
      resumeSessionContact: async (args) => { calls.push(['resumeCampaignContact', args.phone]); return 1; },
      cancelSessionContact: async (args) => { calls.push(['cancelCampaignContact', args.phone]); return 1; },
      resumeSessionAutomationSet: async () => { calls.push(['resumeAllCampaigns']); return { campaigns: 2 }; },
    },
    followups: {
      listSessionFollowups: async () => followups,
      resumeFollowupForConversation: async ({ conversationId }) => { calls.push(['resumeFollowup', conversationId]); return { ok: true }; },
      deactivateFollowupForConversation: async (id) => { calls.push(['cancelFollowup', id]); return { ok: true }; },
    },
  };
  const mocks = {
    '../../../services/outboundQueueService': services.queue,
    '../../../services/campaignDispatchEngine': services.campaigns,
    '../../../services/sessionManager': {
      normalizeSessionName: (value) => value,
      getSession: () => connected ? { sock: {}, status: 'connected', companyId: 'tenant-a', automationPaused } : null,
    },
    '../../infrastructure/config/database': { query: async () => ({ rows: sessionOwned ? [{ session_id: 'wa-1' }] : [] }) },
    '../../../services/aiFollowupEngine': services.followups,
    '../../../services/whatsapp/shared/identifiers': { normalizePhone: (value) => String(value || '').replace(/\D/g, '') },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(require.resolve('../src/api/controllers/outboundQueueController'), 'utf8');
  vm.runInNewContext(source, {
    module, exports: module.exports,
    global: { io: null },
    require: (name) => mocks[name] || require(name),
  });
  return { controller: module.exports, calls };
}

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function request(body = {}) {
  return { authTenantId: 'tenant-a', params: { sessionId: 'wa-1' }, body, app: { get: () => null } };
}

test('session review rejects actions while WhatsApp is disconnected', async () => {
  const { controller, calls } = createController({ connected: false });
  const res = response();
  await controller.resumeSessionAutomations(request(), res);
  assert.equal(res.statusCode, 409);
  assert.equal(calls.length, 0);
});

test('session review rejects connections outside the authenticated company', async () => {
  const { controller, calls } = createController({ sessionOwned: false });
  const res = response();
  await controller.resumeSessionAutomations(request(), res);
  assert.equal(res.statusCode, 404);
  assert.equal(calls.length, 0);
});

test('individual resume affects only the selected contact and its follow-up', async () => {
  const { controller, calls } = createController({
    queueItems: [{ phone: '5511999990001', attemptCount: 2 }],
    followups: [{ id: 'conversation-1', phone: '5511999990001' }],
  });
  const res = response();
  await controller.updateSessionContactAutomation(request({ action: 'resume', contactId: '5511999990001' }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [
    ['resumeQueueContact', '5511999990001'],
    ['resumeCampaignContact', '5511999990001'],
    ['resumeFollowup', 'conversation-1'],
  ]);
});

test('resume all also schedules eligible follow-ups after queue and campaigns', async () => {
  const { controller, calls } = createController({ followups: [{ id: 'conversation-2', phone: '5511999990002' }] });
  const res = response();
  await controller.resumeSessionAutomations(request(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [
    ['resumeAllCampaigns'],
    ['resumeFollowup', 'conversation-2'],
  ]);
  assert.equal(res.body.resumed.followups, 1);
});
