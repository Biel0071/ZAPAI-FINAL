const test = require('node:test');
const assert = require('node:assert/strict');

// Explicit disposable PostgreSQL only. Never use the app's DATABASE_URL for tests.
const testUrl = process.env.HISTORY_TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/history_bootstrap_test';
if (!testUrl) {
  test('history integration (set HISTORY_TEST_DATABASE_URL to a disposable history_bootstrap_test database)', { skip: true }, () => {});
} else {
  const url = new URL(testUrl);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/history_bootstrap_test') throw new Error('Use a local disposable history_bootstrap_test database.');
  process.env.DATABASE_URL = testUrl;
  process.env.JWT_SECRET = 'history-bootstrap-disposable-test-secret';
  process.env.ALLOW_DEV_AUTH_BYPASS = 'false';
  const { pool } = require('../src/infrastructure/config/database');
  const { HistoryRepository } = require('../src/data/repositories/historyRepository');
  const { HistorySync, encodeItems } = require('../services/whatsapp/historySync');
  const { HistoryLearning, isHeldOut } = require('../src/ai/evolutionary/historyLearning');
  const agents = require('../src/ai/agents/services/aiAgentService');
  const { createHistoryRouter } = require('../src/ai/evolutionary/historyRoutes');
  const express = require('express');
  const crypto = require('crypto');
  const token = (tenant, role = 'admin', expiry = Math.floor(Date.now() / 1000) + 600) => {
    const data = [Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'), Buffer.from(JSON.stringify({ tenantId: tenant, role, sub: 'reviewer', exp: expiry })).toString('base64url')].join('.');
    return `${data}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('base64url')}`;
  };
  const repository = new HistoryRepository(pool);
  const learning = new HistoryLearning({ pool, agents, analyze: async ({ message }) => {
    const batch = JSON.parse(message).batch;
    assert.ok(batch.every(i => !i.text.includes('123.456.789')));
    return JSON.stringify({ style: 'Linguagem direta e acolhedora.', patterns: ['Responder frete antes de pedir dados de entrega.'], commercial: ['Valor histórico R$ 700 — confirmar.'], conflicts: ['Parcelamento divergente.'], gaps: [], examples: ['Qual a quantidade desejada?'], evidenceIds: batch.map(i => i.source) });
  } });
  let server;
  let origin;
  const item = (id, options = {}) => ({ jid: '5521999990000@s.whatsapp.net', key: `message-${id}`,
    raw: JSON.stringify({ message: { conversation: `Pergunta ${id}` } }), sent: id % 2 === 0,
    at: new Date(Date.UTC(2025, 0, 1, 0, 0, id)).toISOString(), name: 'Maria Silva', archived: true, origin: 'unknown', ...options });
  const engine = new HistorySync({ repository, learning, decode: raw => JSON.parse(raw),
    extract: async raw => ({ text: raw.message.conversation || '', mediaType: raw.message.audioMessage ? 'audio' : raw.message.imageMessage ? 'image' : null }),
    media: async () => ({ url: '/media/tenant-a/audios/test.ogg' }), transcribe: async () => 'Gostaria de cimento.', describe: async () => { throw Error('expired'); } });

  test.before(async () => {
    await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE TABLE sessions(id SERIAL PRIMARY KEY,company_id TEXT,session_id TEXT UNIQUE,session_name TEXT,status TEXT,created_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE leads(id SERIAL PRIMARY KEY,company_id TEXT,phone VARCHAR(30),name TEXT,UNIQUE(company_id,phone));
      CREATE TABLE conversations(id SERIAL PRIMARY KEY,company_id TEXT,session_id TEXT,lead_id INTEGER REFERENCES leads(id),remote_jid TEXT NOT NULL,ai_enabled BOOLEAN,unread_count INTEGER,status TEXT,last_message TEXT,last_message_type TEXT,created_at TIMESTAMP,updated_at TIMESTAMP,UNIQUE(company_id,session_id,remote_jid));
      CREATE TABLE messages(id SERIAL PRIMARY KEY,company_id TEXT,session_id TEXT,conversation_id INTEGER REFERENCES conversations(id),phone TEXT,text TEXT,content TEXT,media_type TEXT,type TEXT,from_me BOOLEAN,sender TEXT,direction TEXT,status TEXT,timestamp TIMESTAMP,created_at TIMESTAMP,whatsapp_message_id TEXT,remote_jid TEXT,media_path TEXT,media_url TEXT);
      CREATE TABLE system_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TIMESTAMP);
      CREATE TABLE company_official_knowledge(id SERIAL PRIMARY KEY,company_id TEXT,title TEXT,content JSONB,is_active BOOLEAN,updated_at TIMESTAMP);
      INSERT INTO sessions(company_id,session_id,session_name,status) VALUES('tenant-a','a','A','connected'),('tenant-b','b','B','connected'),('tenant-a','a2','A2','connected');`);
    const migration = require('../migrations/034_whatsapp_history_bootstrap');
    await migration.up(pool);
    await migration.up(pool);
    await require('../migrations/035_session_agent_memory').up(pool);
    const app = express();
    app.use(express.json());
    app.use(require('../src/api/middleware/jwtAuth').createJwtAuthMiddleware());
    app.use('/history', createHistoryRouter({ repository, db: pool, agentService: agents, analyze: async ({ prompt, message }) => `${prompt.startsWith('Personalidade anterior') ? 'Atual' : 'Proposta'}: ${message}` }));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    origin = `http://127.0.0.1:${server.address().port}/history`;
  });
  test.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await pool.end(); });

  test('full batch >150, duplicate replay, chats without messages and no realtime side effects', async () => {
    await repository.enqueue('tenant-a', 'a', Array.from({ length: 251 }, (_, i) => item(i)));
    await repository.enqueue('tenant-a', 'a', Array.from({ length: 251 }, (_, i) => item(i)));
    await repository.enqueueChats('tenant-a', 'a', [{ id: '5521888880000@s.whatsapp.net', name: 'Sem mensagens', archived: false }]);
    for (let i = 0; i < 7; i++) await engine.process('tenant-a', 'a');
    const status = await repository.status('tenant-a', 'a');
    assert.equal(status.total, 251); assert.equal(status.imported, 251);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM messages')).rows[0].count, 251);
    const conversations = (await pool.query('SELECT * FROM conversations')).rows;
    assert.equal(conversations.length, 2);
    assert.ok(conversations.every(c => c.unread_count === 0 && c.ai_enabled === false));
    assert.equal(conversations.find(c => c.last_message)?.status, 'archived');
    assert.equal(status.drafts.length, 0);
  });

  test('same message key is isolated across tenants and numbers; LIDs never merge with phone IDs', async () => {
    await assert.rejects(repository.enqueue('tenant-b', 'a', [item(0)]));
    await repository.enqueue('tenant-b', 'b', [item(0)]);
    await repository.enqueue('tenant-a', 'a2', [item(0), item(1, { jid: '5521999990000@lid' })]);
    await engine.process('tenant-b', 'b'); await engine.process('tenant-a', 'a2');
    assert.equal((await repository.status('tenant-b', 'b')).total, 1);
    assert.equal((await pool.query(`SELECT COUNT(DISTINCT conversation_id)::int AS count FROM messages WHERE company_id='tenant-a' AND session_id='a2'`)).rows[0].count, 2);
  });

  test('failed processing resumes without duplicate insertion; preserved unread and active agent state', async () => {
    await pool.query(`UPDATE conversations SET unread_count=8,ai_enabled=TRUE,status='closed',updated_at=NOW() WHERE company_id='tenant-a' AND session_id='a'`);
    await repository.enqueue('tenant-a', 'a', [item(300)]);
    const pending = await repository.pending('tenant-a', 'a');
    await repository.fail(pending[0], false, 'simulated_disconnect');
    await repository.persist(pending[0], { text: 'recuperado' });
    await repository.persist(pending[0], { text: 'replay' });
    const status = await repository.status('tenant-a', 'a');
    assert.equal(status.imported, 252);
    assert.ok((await pool.query(`SELECT * FROM conversations WHERE company_id='tenant-a' AND session_id='a'`)).rows.every(c => c.unread_count === 8 && c.ai_enabled && c.status === 'closed'));
  });

  test('media downloads without AI until enrollment; audio is transcribed and failed media is resumable', async () => {
    await repository.enqueue('tenant-a', 'a', [item(400, { raw: JSON.stringify({ message: { audioMessage: { mimetype: 'audio/ogg' } } }) })]);
    await engine.process('tenant-a', 'a'); await engine.process('tenant-a', 'a');
    let media = (await pool.query(`SELECT * FROM whatsapp_history_items WHERE message_key='message-400'`)).rows[0];
    assert.equal(media.media_state, 'downloaded'); assert.equal(media.media_text, null);
    await pool.query(`UPDATE whatsapp_history_sync SET learning_enabled=TRUE WHERE company_id='tenant-a' AND session_id='a'`);
    await engine.process('tenant-a', 'a');
    media = (await pool.query(`SELECT * FROM whatsapp_history_items WHERE message_key='message-400'`)).rows[0];
    assert.equal(media.media_state, 'done'); assert.equal(media.media_text, 'Gostaria de cimento.');
    await repository.enqueue('tenant-a', 'a', [item(401, { raw: JSON.stringify({ message: { imageMessage: { mimetype: 'image/jpeg' } } }) })]);
    for (let i = 0; i < 4; i++) await engine.process('tenant-a', 'a');
    assert.equal((await repository.status('tenant-a', 'a')).media_failed, 1);
    await repository.resume('tenant-a', 'a');
    assert.equal((await repository.status('tenant-a', 'a')).media_failed, 0);
    // Restore failure to exercise partial analysis and avoid real provider calls.
    for (let i = 0; i < 3; i++) await engine.process('tenant-a', 'a');
  });

  test('draft analysis checkpoints, reserves conversations and never changes active agent before review', async () => {
    const active = await agents.createAgent({ key: 'camila', name: 'Camila', personality: 'Personalidade anterior', active: true, sessionIds:['a'] }, 'tenant-a');
    await pool.query(`UPDATE whatsapp_history_sync SET target_agent_key='camila' WHERE company_id='tenant-a' AND session_id='a'`);
    const heldJid = Array.from({ length: 100 }, (_, i) => `${5521000000000 + i}@s.whatsapp.net`).find(isHeldOut);
    await repository.enqueue('tenant-a', 'a', [item(500, { jid: heldJid, sent: false })]);
    await engine.process('tenant-a', 'a');
    await learning.start('tenant-a', 'a');
    await learning.step('tenant-a', 'a');
    const first = (await repository.status('tenant-a', 'a')).drafts[0];
    assert.ok(Number(first.cursor_id) > 0);
    const resumed = new HistoryLearning({ pool, agents, analyze: learning.analyze });
    for (let i = 0; i < 12; i++) await resumed.step('tenant-a', 'a');
    const draft = (await repository.status('tenant-a', 'a')).drafts[0];
    assert.equal(draft.status, 'draft'); assert.equal(draft.candidate.active, false); assert.equal(draft.candidate.partial, true);
    assert.ok(!draft.candidate.personality.includes('700'));
    assert.equal((await agents.listAgents('tenant-a'))[0].personality, active.personality);
    const reserved = (await pool.query(`SELECT id FROM whatsapp_history_items WHERE company_id='tenant-a' AND session_id='a' AND chat_jid=$1`, [heldJid])).rows[0];
    assert.ok(!draft.candidate.evidenceIds.map(String).includes(String(reserved.id)));
    await learning.start('tenant-a', 'a');
    assert.equal((await repository.status('tenant-a', 'a')).drafts.length, 1);
  });

  test('HTTP auth, ownership, input validation and atomic reviewed publication', async () => {
    const request = (path, method = 'GET', body, tenant = 'tenant-a', role = 'admin') => fetch(`${origin}${path}`, { method, headers: { 'content-type': 'application/json', ...(tenant ? { authorization: `Bearer ${token(tenant, role)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal((await request('/a/status', 'GET', undefined, null)).status, 401);
    assert.equal((await request('/a/status', 'GET', undefined, 'tenant-b')).status, 404);
    assert.equal((await request('/a/resume', 'POST', {}, 'tenant-a', 'agent')).status, 403);
    assert.equal((await request('/a/learning', 'POST', { enabled: true, targetAgentKey: 'foreign-agent' })).status, 400);
    assert.equal((await request('/a/status')).status, 200);
    assert.equal((await request('/a/status?companyId=tenant-b')).status, 403);
    assert.equal((await fetch(`${origin}/a/status`, { headers: { authorization: `Bearer ${token('tenant-a', 'admin', 1)}` } })).status, 401);
    const draft = (await repository.status('tenant-a', 'a')).drafts[0];
    const simulation = await request(`/a/drafts/${draft.id}/simulate`, 'POST', {});
    assert.equal(simulation.status, 200);
    const comparison = await simulation.json();
    assert.ok(comparison.before.startsWith('Atual:')); assert.ok(comparison.after.startsWith('Proposta:'));
    assert.equal((await request(`/a/drafts/${draft.id}/publish`, 'POST', {})).status, 409);
    assert.equal((await request(`/a/drafts/${draft.id}`, 'PATCH', { name: 'Camila', personality: 'Novo padrão revisado, consulte regras oficiais.' })).status, 200);
    assert.equal((await request(`/a/drafts/${draft.id}/publish`, 'POST', { reviewed: true, expectedRevision: draft.revision })).status, 409);
    const updated = (await repository.status('tenant-a', 'a')).drafts[0];
    assert.equal((await request(`/a/drafts/${draft.id}/publish`, 'POST', { reviewed: true, expectedRevision: updated.revision })).status, 200);
    assert.equal((await request(`/a/drafts/${draft.id}/publish`, 'POST', { reviewed: true })).status, 409);
    assert.equal((await agents.listAgents('tenant-a'))[0].personality, 'Novo padrão revisado, consulte regras oficiais.');
    assert.equal((await agents.listAgents('tenant-b')).length, 0);
    const audit = (await pool.query('SELECT previous_agent,reviewed_by FROM ai_history_drafts WHERE id=$1', [draft.id])).rows[0];
    assert.equal(audit.previous_agent.personality, 'Personalidade anterior'); assert.equal(audit.reviewed_by, 'reviewer');
  });

  test('incremental draft reuses completed analyses without re-reading the old corpus', async () => {
    const before = (await repository.status('tenant-a', 'a')).drafts[0];
    await repository.enqueue('tenant-a', 'a', [item(600)]);
    await engine.process('tenant-a', 'a');
    await learning.start('tenant-a', 'a');
    const next = (await repository.status('tenant-a', 'a')).drafts[0];
    assert.notEqual(next.id, before.id);
    assert.equal(String(next.cursor_id), String(before.watermark));
    await learning.step('tenant-a', 'a'); await learning.step('tenant-a', 'a');
    assert.equal((await repository.status('tenant-a', 'a')).drafts[0].status, 'draft');
    assert.equal((await agents.listAgents('tenant-a'))[0].personality, 'Novo padrão revisado, consulte regras oficiais.');
  });

  test('older-history requests checkpoint the oldest key and stop when WhatsApp makes no progress', async () => {
    await pool.query(`INSERT INTO sessions(company_id,session_id,session_name,status) VALUES('tenant-a','older','Older','connected')`);
    await repository.enqueue('tenant-a', 'older', [item(800)]);
    const { activeSessions } = require('../services/whatsapp/state/registry');
    const calls = [];
    activeSessions.older = { status: 'connected', sock: { fetchMessageHistory: async (...args) => calls.push(args) } };
    try {
      await engine.requestOlder('tenant-a', 'older');
      assert.equal(calls.length, 1); assert.equal(calls[0][1].id, 'message-800');
      await pool.query(`UPDATE whatsapp_history_sync SET last_request_at=NOW()-INTERVAL '2 minutes' WHERE company_id='tenant-a' AND session_id='older'`);
      await engine.requestOlder('tenant-a', 'older'); assert.equal(calls.length, 1);
      await repository.enqueue('tenant-a', 'older', [item(700)]);
      await engine.requestOlder('tenant-a', 'older'); assert.equal(calls.length, 2); assert.equal(calls[1][1].id, 'message-700');
    } finally { delete activeSessions.older; }
  });

  test('already stored messages seed history without recreating them or inventing WhatsApp keys', async () => {
    await pool.query(`INSERT INTO sessions(company_id,session_id,session_name,status) VALUES('tenant-a','stored','Stored','disconnected')`);
    await repository.ensure('tenant-a', 'stored');
    const original = (await pool.query(`INSERT INTO messages(company_id,session_id,phone,text,content,media_type,from_me,sender,timestamp,created_at)
      VALUES('tenant-a','stored','5521777770000','Histórico anterior','Histórico anterior','text',TRUE,'ai','2024-01-01','2024-01-01') RETURNING id`)).rows[0];
    assert.equal(await engine.seedStoredMessages('tenant-a', 'stored'), 1);
    assert.equal(await engine.seedStoredMessages('tenant-a', 'stored'), 0);
    const status = await repository.status('tenant-a', 'stored');
    assert.equal(status.imported, 1);
    const saved = (await pool.query(`SELECT message_key,message_id,origin FROM whatsapp_history_items WHERE company_id='tenant-a' AND session_id='stored'`)).rows[0];
    assert.equal(saved.message_id, original.id); assert.equal(saved.message_key, `stored:${original.id}`); assert.equal(saved.origin, 'ai');
  });

  test('real Baileys encoding preserves media encryption keys and excludes groups/protocol events', async () => {
    const { proto } = await import('@whiskeysockets/baileys');
    const original = { key: { id: 'binary', remoteJid: '55219999@s.whatsapp.net', fromMe: false }, messageTimestamp: 1735689600,
      message: { imageMessage: { mediaKey: Buffer.from([1, 2, 3]), mimetype: 'image/jpeg' } } };
    const rows = encodeItems([original, { ...original, key: { id: 'group', remoteJid: '123@g.us' } }], [], proto);
    assert.equal(rows.length, 1);
    const restored = proto.WebMessageInfo.decode(Buffer.from(rows[0].raw, 'base64'));
    assert.deepEqual(Buffer.from(restored.message.imageMessage.mediaKey), Buffer.from([1, 2, 3]));
  });
}
