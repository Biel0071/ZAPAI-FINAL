'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('../src/infrastructure/config/database');

const originalQuery = database.query;
let queryHandler = async () => ({ rowCount: 0, rows: [] });
database.query = (...args) => queryHandler(...args);
delete require.cache[require.resolve('../src/api/middleware/companyEntitlements')];
delete require.cache[require.resolve('../src/api/middleware/adminCompanyContext')];
delete require.cache[require.resolve('../src/api/middleware/companyStatus')];
const { companyEntitlements, getModule } = require('../src/api/middleware/companyEntitlements');
const { adminCompanyContext } = require('../src/api/middleware/adminCompanyContext');
const { companyStatus } = require('../src/api/middleware/companyStatus');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('maps canonical API paths to licensed modules', () => {
  assert.equal(getModule('/api/conversations'), 'inbox');
  assert.equal(getModule('/send-message'), 'inbox');
  assert.equal(getModule('/api/contacts/42'), 'contacts');
  assert.equal(getModule('/api/campaigns/42/start'), 'campaigns');
  assert.equal(getModule('/api/health'), null);
});

test('keeps legacy company access until a license is assigned', async () => {
  queryHandler = async (sql) => sql.includes('FROM companies c')
    ? { rowCount: 1, rows: [{ legacy_access: true, user_module_enabled: null }] }
    : { rowCount: 0, rows: [] };
  const res = response(); let continued = false;
  await companyEntitlements({ originalUrl: '/api/contacts', authTenantId: 'legacy-a', method: 'GET' }, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(res.statusCode, 200);
});

test('denies modules missing from the active company license', async () => {
  queryHandler = async () => ({ rowCount: 1, rows: [{ legacy_access: false, license_id: 8, modules: ['inbox'], number_limit: 2, user_id: 9, user_module_enabled: true }] });
  const res = response(); let continued = false;
  await companyEntitlements({ originalUrl: '/api/contacts', authTenantId: 'tenant-a', method: 'GET', auth: { username: 'user-a' } }, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'MODULE_NOT_LICENSED');
});

test('denies a number creation when the licensed quota is already full', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('FROM companies c')) return { rowCount: 1, rows: [{ legacy_access: false, license_id: 8, modules: ['inbox'], number_limit: 1, user_id: 9, user_module_enabled: true }] };
    if (sql.includes('SELECT 1 FROM sessions')) return { rowCount: 0, rows: [] };
    return { rowCount: 1, rows: [{ count: 1 }] };
  };
  const res = response(); let continued = false;
  await companyEntitlements({ originalUrl: '/api/whatsapp/sessions', authTenantId: 'tenant-a', method: 'POST', auth: { username: 'admin-a' } }, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'NUMBER_LIMIT_REACHED');
});

test('individual module permission can restrict a resource granted by the package', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('FROM companies c')) return { rowCount: 1, rows: [{ legacy_access: false, license_id: 8, modules: ['contacts'], number_limit: 2, user_id: 9, user_module_enabled: false }] };
    return { rowCount: 0, rows: [] };
  };
  const res = response(); let continued = false;
  await companyEntitlements({ originalUrl: '/api/contacts', authTenantId: 'tenant-a', method: 'GET', auth: { username: 'user-a' } }, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.body.code, 'USER_MODULE_DISABLED');
});

test('suspended companies are denied before business routes', async () => {
  queryHandler = async () => ({ rowCount: 1, rows: [{ status: 'suspended' }] });
  const res = response(); let continued = false;
  await companyStatus({ authTenantId: 'tenant-a' }, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 403);
});

test('rejects cross-company context for non-master and resolves active company for master', async () => {
  queryHandler = async () => ({ rowCount: 1, rows: [{ id: 'tenant-b' }] });
  const denied = response();
  await adminCompanyContext({ headers: { 'x-admin-company-context': 'tenant-b' }, auth: { role: 'admin' } }, denied, () => {});
  assert.equal(denied.statusCode, 403);

  const accepted = response(); let continued = false;
  const req = { headers: { 'x-admin-company-context': 'tenant-b' }, auth: { role: 'master' }, authTenantId: 'master-tenant' };
  await adminCompanyContext(req, accepted, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(req.authTenantId, 'tenant-b');
});

test.after(async () => { database.query = originalQuery; await database.closeDatabase(); });
