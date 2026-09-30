const test = require('node:test');
const assert = require('node:assert/strict');
const { getPhoneAliases, normalizePhone } = require('../services/whatsapp/shared/identifiers');
let conversation;
let ownedSessions;
let contact;
let runtimeSession;
const queries = [];
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub('../services/sessionManager', { DEFAULT_SESSION: 'main', normalizeSessionName: value => value, getSession: () => runtimeSession });
stub('../services/messageService', {});
stub('../services/whatsappService', { normalizePhone });
stub('../src/data/repositories/conversationRepository', { async getConversationById(id, tenant) { queries.push({ id, tenant }); return conversation?.company_id === tenant ? conversation : null; } });
stub('../src/infrastructure/config/database', { async query(sql, params) { queries.push({ sql, params }); return { rows: sql.includes('FROM sessions') ? ownedSessions : contact ? [contact] : [] }; } });
const { resolveOutboundContext } = require('../src/api/controllers/messages/shared');

test.beforeEach(() => {
  queries.length = 0;
  conversation = { id: 'conv-a', company_id: 'tenant-a', contact_id: 7, phone: '5511888888888', remote_jid: '5511888888888@s.whatsapp.net', session_id: 'wa-a' };
  ownedSessions = [{ session_id: 'wa-a', company_id: 'tenant-a' }];
  runtimeSession = { companyId: 'tenant-a', sessionId: 'wa-a', status: 'connected', sock: {} };
  contact = { id: 7, phone: conversation.phone };
});
const req = body => ({ authTenantId: 'tenant-a', body, headers: {}, query: {} });

test('outbound context resolves owned conversation and connection from authenticated tenant', async () => {
  const result = await resolveOutboundContext(req({ companyId: 'tenant-b', conversationId: 'conv-a', phone: '5511888888888', contactId: 7 }));
  assert.equal(result.companyId, 'tenant-a');
  assert.equal(result.targetSessionName, 'wa-a');
  assert.equal(result.targetJidOrPhone, conversation.remote_jid);
  assert.ok(queries.every(call => call.tenant === 'tenant-a' || call.params.includes('tenant-a')));
});

test('cross-tenant conversation, missing session and cross-tenant runtime socket are rejected', async () => {
  conversation.company_id = 'tenant-b';
  await assert.rejects(resolveOutboundContext(req({ conversationId: 'conv-b', phone: '5511888888888' })), error => error.status === 404);
  conversation.company_id = 'tenant-a';
  ownedSessions = [];
  await assert.rejects(resolveOutboundContext(req({ conversationId: 'conv-a' })), error => error.status === 403);
  ownedSessions = [{ session_id: 'wa-a' }];
  runtimeSession.companyId = 'tenant-b';
  await assert.rejects(resolveOutboundContext(req({ conversationId: 'conv-a' })), error => error.status === 403);
});

test('different destination, connection or contact cannot be attached to an owned conversation', async () => {
  await assert.rejects(resolveOutboundContext(req({ conversationId: 'conv-a', phone: '5511777777777' })), error => error.status === 409);
  await assert.rejects(resolveOutboundContext(req({ conversationId: 'conv-a', sessionId: 'wa-b' })), error => error.status === 409);
  await assert.rejects(resolveOutboundContext(req({ conversationId: 'conv-a', contactId: 8 })), error => error.status === 409);
});

test('offline session is retryable and short database ids cannot become recipients', async () => {
  runtimeSession.status = 'disconnected';
  await assert.rejects(resolveOutboundContext(req({ conversationId: 'conv-a' })), error => error.status === 409);
  await assert.rejects(resolveOutboundContext(req({ phone: '16', sessionId: 'wa-a' })), error => error.status === 400);
});
