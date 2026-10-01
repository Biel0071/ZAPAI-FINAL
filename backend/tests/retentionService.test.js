'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const retentionService = require('../services/retentionService');
const { pool } = require('../src/infrastructure/config/database');

test('retention policy configuration enforces 7 days for groups and 60 days for individual', () => {
  assert.equal(retentionService.GROUP_MESSAGE_RETENTION_HOURS, 168, 'Group message retention must default to 168 hours (7 days / 1 week)');
  assert.equal(retentionService.INDIVIDUAL_MESSAGE_RETENTION_DAYS, 60, 'Individual message retention must default to 60 days');
});

test('runRetention executes cleanly and reports preserved tables', async () => {
  const report = await retentionService.runRetention({});

  assert.ok(report, 'Report should be returned');
  assert.equal(report.error, null, 'Retention should complete without error');
  assert.ok(Array.isArray(report.preservedTables), 'Preserved tables must be listed');
  assert.ok(report.preservedTables.includes('ai_memory_short'), 'ai_memory_short must be preserved');
  assert.ok(report.preservedTables.includes('ai_memory_long'), 'ai_memory_long must be preserved');
  assert.ok(report.preservedTables.includes('ai_context'), 'ai_context must be preserved');
  assert.ok(report.preservedTables.includes('leads'), 'leads must be preserved');
  assert.ok(report.preservedTables.includes('contacts'), 'contacts must be preserved');
  assert.ok(report.preservedTables.includes('analytics'), 'analytics must be preserved');

  assert.ok(report.groups, 'Groups report should exist');
  assert.ok(report.groups.policy.includes('168h') || report.groups.policy.includes('1 week'), 'Policy should indicate 1 week / 168h');
  assert.ok(report.individual, 'Individual report should exist');
  assert.ok(report.individual.policy.includes('60d') || report.individual.policy.includes('60 days'), 'Policy should indicate 60 days');

  assert.ok(retentionService.getLastRunAt() !== null, 'getLastRunAt should return ISO timestamp');
  assert.equal(retentionService.isRetentionRunning(), false, 'isRetentionRunning should be false after completion');
});

test('retention isolates group cutoff at 7 days and individual cutoff at 60 days in database', async () => {
  const client = await pool.connect();
  const testCompany = 'retention_test_' + Date.now();
  const testSession = 'retention_sess_' + Date.now();

  try {
    await client.query('BEGIN');

    // 1. Create a lead and conversations
    const leadRes = await client.query(
      `INSERT INTO leads(company_id, phone, name) VALUES($1, '5511999998888', 'Lead Teste') RETURNING id`,
      [testCompany]
    );
    const leadId = leadRes.rows[0].id;

    // Normal conversation
    const convIndRes = await client.query(
      `INSERT INTO conversations(company_id, session_id, lead_id, remote_jid, status)
       VALUES($1, $2, $3, '5511999998888@s.whatsapp.net', 'open') RETURNING id`,
      [testCompany, testSession, leadId]
    );
    const convIndId = convIndRes.rows[0].id;

    // Group conversation
    const convGroupRes = await client.query(
      `INSERT INTO conversations(company_id, session_id, lead_id, remote_jid, status)
       VALUES($1, $2, $3, '120363024849202@g.us', 'open') RETURNING id`,
      [testCompany, testSession, leadId]
    );
    const convGroupId = convGroupRes.rows[0].id;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Messages:
    // M1: Group message 2 days old (keep - within 7 days)
    const m1Res = await client.query(
      `INSERT INTO messages(company_id, session_id, conversation_id, remote_jid, phone, text, created_at, timestamp)
       VALUES($1, $2, $3, '120363024849202@g.us', '120363024849202', 'Group msg 2d old', $4, $4) RETURNING id`,
      [testCompany, testSession, convGroupId, new Date(now - 2 * dayMs)]
    );

    // M2: Group message 10 days old (delete - older than 7 days)
    const m2Res = await client.query(
      `INSERT INTO messages(company_id, session_id, conversation_id, remote_jid, phone, text, created_at, timestamp)
       VALUES($1, $2, $3, '120363024849202@g.us', '120363024849202', 'Group msg 10d old', $4, $4) RETURNING id`,
      [testCompany, testSession, convGroupId, new Date(now - 10 * dayMs)]
    );

    // M3: Individual message 45 days old (keep - within 60 days)
    const m3Res = await client.query(
      `INSERT INTO messages(company_id, session_id, conversation_id, remote_jid, phone, text, created_at, timestamp)
       VALUES($1, $2, $3, '5511999998888@s.whatsapp.net', '5511999998888', 'Individual msg 45d old', $4, $4) RETURNING id`,
      [testCompany, testSession, convIndId, new Date(now - 45 * dayMs)]
    );

    // M4: Individual message 75 days old (delete - older than 60 days)
    const m4Res = await client.query(
      `INSERT INTO messages(company_id, session_id, conversation_id, remote_jid, phone, text, created_at, timestamp)
       VALUES($1, $2, $3, '5511999998888@s.whatsapp.net', '5511999998888', 'Individual msg 75d old', $4, $4) RETURNING id`,
      [testCompany, testSession, convIndId, new Date(now - 75 * dayMs)]
    );

    await client.query('COMMIT');

    // Run retention
    await retentionService.runRetention({});

    // Verify:
    // M1 (group 2d old) should still exist
    const m1Check = await pool.query('SELECT id FROM messages WHERE id = $1', [m1Res.rows[0].id]);
    assert.equal(m1Check.rows.length, 1, 'Group message under 7 days must be preserved');

    // M2 (group 10d old) must be deleted
    const m2Check = await pool.query('SELECT id FROM messages WHERE id = $1', [m2Res.rows[0].id]);
    assert.equal(m2Check.rows.length, 0, 'Group message over 7 days (10 days old) must be purged');

    // M3 (indiv 45d old) should still exist
    const m3Check = await pool.query('SELECT id FROM messages WHERE id = $1', [m3Res.rows[0].id]);
    assert.equal(m3Check.rows.length, 1, 'Individual message under 60 days must be preserved');

    // M4 (indiv 75d old) must be deleted
    const m4Check = await pool.query('SELECT id FROM messages WHERE id = $1', [m4Res.rows[0].id]);
    assert.equal(m4Check.rows.length, 0, 'Individual message over 60 days (75 days old) must be purged');

    // Conversation headers and lead must still exist
    const convIndCheck = await pool.query('SELECT id FROM conversations WHERE id = $1', [convIndId]);
    assert.equal(convIndCheck.rows.length, 1, 'Individual conversation header must be preserved');

    const convGroupCheck = await pool.query('SELECT id FROM conversations WHERE id = $1', [convGroupId]);
    assert.equal(convGroupCheck.rows.length, 1, 'Group conversation header must be preserved');

    const leadCheck = await pool.query('SELECT id FROM leads WHERE id = $1', [leadId]);
    assert.equal(leadCheck.rows.length, 1, 'Lead must be preserved');

  } finally {
    // Cleanup test data
    await pool.query('DELETE FROM messages WHERE company_id = $1', [testCompany]).catch(() => {});
    await pool.query('DELETE FROM conversations WHERE company_id = $1', [testCompany]).catch(() => {});
    await pool.query('DELETE FROM leads WHERE company_id = $1', [testCompany]).catch(() => {});
    client.release();
  }
});
