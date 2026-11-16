const test = require('node:test');
const assert = require('node:assert/strict');

const testUrl = process.env.ATTENDANTS_TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/attendants_test';
const hasExplicitTestDatabase = Boolean(process.env.ATTENDANTS_TEST_DATABASE_URL);
const parsedUrl = new URL(testUrl);
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname) || parsedUrl.pathname !== '/attendants_test') {
  throw new Error('Use only a local disposable attendants_test database.');
}
process.env.DATABASE_URL = testUrl;

const { pool } = require('../src/infrastructure/config/database');
const attendants = require('../src/data/repositories/attendantRepository');

test.before(async () => {
  await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
    CREATE TABLE ai_stores(company_id VARCHAR(100) NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,segment TEXT NOT NULL DEFAULT '',knowledge TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(company_id,id));
    CREATE TABLE sessions(id SERIAL PRIMARY KEY,company_id TEXT,session_id VARCHAR(100) UNIQUE,session_name VARCHAR(100),status VARCHAR(50),created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE session_ai_profiles(company_id VARCHAR(100),session_id VARCHAR(100),store_id TEXT,segment TEXT DEFAULT '',service_type TEXT DEFAULT '',evolution_mode TEXT DEFAULT 'limited',PRIMARY KEY(company_id,session_id));
    CREATE TABLE quick_replies(id SERIAL PRIMARY KEY,company_id TEXT);
    CREATE TABLE system_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TIMESTAMPTZ DEFAULT NOW());
    INSERT INTO ai_stores(company_id,id,name) VALUES ('tenant-a','store-a','Loja A'),('tenant-b','store-b','Loja B');
    INSERT INTO sessions(company_id,session_id,session_name) VALUES ('tenant-a','session-a','WhatsApp A'),('tenant-a','rollback-session','WhatsApp rollback'),('tenant-b','session-b','WhatsApp B');`);
  await require('../migrations/053_create_attendants_multi_tenant_tables').up(pool);
  await require('../migrations/056_versioned_agent_prompt_templates').up(pool);
}, { skip: !hasExplicitTestDatabase && 'Set ATTENDANTS_TEST_DATABASE_URL to run PostgreSQL integration tests.' });

test.after(async () => pool.end());

test('allows multiple attendants in one store and keeps one principal per session', { skip: !hasExplicitTestDatabase && 'Requires an explicit disposable local database.' }, async () => {
  const primary = await attendants.upsertAttendant('tenant-a', { key: 'primary', name: 'Principal' });
  const secondary = await attendants.upsertAttendant('tenant-a', { key: 'secondary', name: 'Apoio' });
  await attendants.assignToStore('tenant-a', 'store-a', primary.id, true);
  await attendants.assignToStore('tenant-a', 'store-a', secondary.id, false);
  await attendants.assignToConnection('tenant-a', 'session-a', primary.id, 'store-a', true);
  await attendants.assignToConnection('tenant-a', 'session-a', secondary.id, 'store-a', true);

  const storeRows = await pool.query(`SELECT attendant_id FROM store_attendant_assignments WHERE company_id='tenant-a' AND store_id='store-a'`);
  const connectionRows = await pool.query(`SELECT attendant_id,is_primary FROM connection_attendant_assignments WHERE company_id='tenant-a' AND session_id='session-a'`);
  assert.equal(storeRows.rowCount, 2);
  assert.equal(connectionRows.rowCount, 2);
  assert.equal(connectionRows.rows.filter(row => row.is_primary).length, 1);
  assert.equal(connectionRows.rows.find(row => row.attendant_id === secondary.id).is_primary, true);
});

test('rejects cross-tenant store, session, and attendant assignments', { skip: !hasExplicitTestDatabase && 'Requires an explicit disposable local database.' }, async () => {
  const storeAssignmentsBefore = Number((await pool.query(`SELECT COUNT(*)::int AS count FROM store_attendant_assignments WHERE company_id='tenant-a'`)).rows[0].count);
  const connectionAssignmentsBefore = Number((await pool.query(`SELECT COUNT(*)::int AS count FROM connection_attendant_assignments WHERE company_id='tenant-a'`)).rows[0].count);
  const tenantBAttendant = await attendants.upsertAttendant('tenant-b', { key: 'private', name: 'Privado' });
  await assert.rejects(attendants.assignToStore('tenant-a', 'store-b', tenantBAttendant.id), /não pertence/);
  await assert.rejects(attendants.assignToConnection('tenant-a', 'session-b', tenantBAttendant.id), /não pertence/);
  assert.equal(Number((await pool.query(`SELECT COUNT(*)::int AS count FROM store_attendant_assignments WHERE company_id='tenant-a'`)).rows[0].count), storeAssignmentsBefore);
  assert.equal(Number((await pool.query(`SELECT COUNT(*)::int AS count FROM connection_attendant_assignments WHERE company_id='tenant-a'`)).rows[0].count), connectionAssignmentsBefore);
});

test('rolls back replacing the principal when the new assignment insert fails', { skip: !hasExplicitTestDatabase && 'Requires an explicit disposable local database.' }, async () => {
  const first = await attendants.upsertAttendant('tenant-a', { key: 'rollback-first', name: 'Primeiro' });
  const blocked = await attendants.upsertAttendant('tenant-a', { key: 'rollback-blocked', name: 'Bloqueado' });
  await attendants.assignToConnection('tenant-a', 'rollback-session', first.id, null, true);
  await pool.query(`CREATE FUNCTION reject_test_attendant_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.attendant_id = '${blocked.id}' THEN RAISE EXCEPTION 'test insert failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_test_attendant_assignment BEFORE INSERT ON connection_attendant_assignments FOR EACH ROW EXECUTE FUNCTION reject_test_attendant_assignment();`);

  await assert.rejects(attendants.assignToConnection('tenant-a', 'rollback-session', blocked.id, null, true), /test insert failure/);
  const rows = await pool.query(`SELECT attendant_id,is_primary FROM connection_attendant_assignments WHERE company_id='tenant-a' AND session_id='rollback-session'`);
  assert.deepEqual(rows.rows, [{ attendant_id: first.id, is_primary: true }]);
  await pool.query(`DROP TRIGGER reject_test_attendant_assignment ON connection_attendant_assignments; DROP FUNCTION reject_test_attendant_assignment();`);
});

test('versions prompt templates and enforces tenant and store ownership', { skip: !hasExplicitTestDatabase && 'Requires an explicit disposable local database.' }, async () => {
  const templates = require('../src/data/repositories/agentPromptTemplateRepository');
  const created = await templates.createTemplate({
    scope: templates.COMPANY_SCOPE,
    companyId: 'tenant-a',
    templateKey: 'local-sales',
    niche: 'retail',
    title: 'Vendas local',
    promptText: 'Atenda {{agent.name}} da {{store.name}} com fatos: {{store.verifiedFacts}}.',
    createdBy: 'admin-a',
  });
  assert.equal(created.version.status, 'draft');
  assert.equal((await templates.listAvailable('tenant-a', { includeDrafts: true })).some(row => row.id === created.id), true);
  assert.equal((await templates.listAvailable('tenant-b', { includeDrafts: true })).some(row => row.id === created.id), false);
  await assert.rejects(templates.setStoreTemplate('tenant-a', 'store-a', created.id, 'admin-a'), /não pertence/);

  await assert.rejects(
    templates.publishVersion({ scope: templates.COMPANY_SCOPE, companyId: 'tenant-b', templateId: created.id, versionId: created.version.id }),
    /Template não encontrado/,
  );
  await templates.publishVersion({ scope: templates.COMPANY_SCOPE, companyId: 'tenant-a', templateId: created.id, versionId: created.version.id });
  assert.equal((await templates.listAvailable('tenant-a')).some(row => row.id === created.id && row.status === 'published'), true);

  const next = await templates.createDraftVersion({ scope: templates.COMPANY_SCOPE, companyId: 'tenant-a', templateId: created.id, createdBy: 'admin-a' });
  assert.equal(next.version, 2);
  await templates.updateDraftVersion({
    scope: templates.COMPANY_SCOPE,
    companyId: 'tenant-a',
    templateId: created.id,
    versionId: next.id,
    input: { promptText: 'Nova versão para {{agent.name}}.', requiredFields: [], unresolvedFacts: [], guardrails: ['Não inventar fatos.'] },
  });
  const drafts = await templates.listAvailable('tenant-a', { includeDrafts: true });
  assert.equal(drafts.filter(row => row.id === created.id).length, 1);
  assert.equal(drafts.find(row => row.id === created.id).version, 2);

  await templates.setStoreTemplate('tenant-a', 'store-a', created.id, 'admin-a');
  await assert.rejects(templates.setStoreTemplate('tenant-b', 'store-b', created.id, 'admin-b'), /não pertence/);
  const assignment = await pool.query('SELECT company_id,store_id FROM ai_store_prompt_templates');
  assert.deepEqual(assignment.rows, [{ company_id: 'tenant-a', store_id: 'store-a' }]);
  assert.equal((await templates.getStoreTemplate('tenant-a', 'store-a')).template_id, created.id);
  assert.equal(await templates.getStoreTemplate('tenant-b', 'store-a'), null);
});
