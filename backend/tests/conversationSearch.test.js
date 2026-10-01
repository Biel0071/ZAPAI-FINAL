const test = require('node:test');
const assert = require('node:assert/strict');

function stubModule(relativePath, exports) {
  const id = require.resolve(relativePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const queries = [];
stubModule('../src/infrastructure/config/database', {
  query: async (sql, params) => { queries.push({ sql, params }); return { rows: [] }; },
});
stubModule('../src/data/repositories/contactRepository', {});
const repository = require('../src/data/repositories/conversationRepository');

test.beforeEach(() => queries.splice(0));

test('searches canonical conversations before limiting, with tenant and exact session scope', async () => {
  await repository.listConversations('tenant-a', 50, { sessionId: 'main', search: '7167', strictSession: true, useCache: false });
  const { sql, params } = queries[0];
  assert.match(sql, /conv\.company_id = \$1/);
  assert.match(sql, /conv\.session_id = \$2/);
  assert.doesNotMatch(sql, /NOT EXISTS/);
  assert.ok(sql.indexOf('deduplicated') < sql.indexOf('ILIKE'));
  assert.ok(sql.indexOf('ILIKE') < sql.lastIndexOf('LIMIT'));
  assert.equal(params[0], 'tenant-a');
  assert.equal(params[1], 'main');
  assert.ok(params.includes('%7167%'));
  assert.equal(params.at(-1), 50);
});

test('treats SQL wildcard characters and user input as literal parameters', async () => {
  await repository.listConversations('tenant-a', 20, { search: "50%_' OR 1=1 --", useCache: false });
  const { sql, params } = queries[0];
  assert.doesNotMatch(sql, /OR 1=1/);
  assert.ok(params.includes("%50\\%\\_' OR 1=1 --%"));
});

test('search cache separates terms, tenants and strict session requests', async () => {
  await repository.listConversations('tenant-a', 30, { sessionId: 'main', search: 'first', strictSession: true });
  await repository.listConversations('tenant-a', 30, { sessionId: 'main', search: 'second', strictSession: true });
  await repository.listConversations('tenant-b', 30, { sessionId: 'main', search: 'first', strictSession: true });
  await repository.listConversations('tenant-a', 30, { sessionId: 'main', search: 'first', strictSession: true });
  assert.equal(queries.length, 3);
});
