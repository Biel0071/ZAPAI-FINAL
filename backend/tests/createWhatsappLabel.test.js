const test = require('node:test');
const assert = require('node:assert/strict');

function stub(path, exports) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

test('createWhatsappLabel inserts label and returns 201 with label payload', async () => {
  const queries = [];
  stub('../src/infrastructure/config/database', {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/LOWER\(name\) = LOWER\(\$3\)/.test(sql)) {
        return { rows: [] };
      }
      if (/MAX\(CAST/.test(sql)) {
        return { rows: [{ max_id: 8 }] };
      }
      if (/INSERT INTO whatsapp_labels/.test(sql)) {
        return {
          rows: [
            {
              id: '9',
              company_id: 'tenant-a',
              session_id: 'main',
              name: 'Cliente Ouro',
              color: 0,
              color_hex: '#00d26a',
              deleted: false,
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { createWhatsappLabel } = require('../src/api/controllers/conversationsController');

  const req = {
    headers: { 'x-company-id': 'tenant-a' },
    body: { name: 'Cliente Ouro', colorHex: '#00d26a' },
    query: { sessionId: 'main' },
    app: { get: () => null },
  };

  let statusCode = 0;
  let jsonBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return this;
    },
  };

  await createWhatsappLabel(req, res);

  assert.equal(statusCode, 201);
  assert.equal(jsonBody.success, true);
  assert.equal(jsonBody.label.name, 'Cliente Ouro');
  assert.equal(jsonBody.label.color_hex, '#00d26a');
  assert.ok(queries.some((q) => /INSERT INTO whatsapp_labels/.test(q.sql)));
});
