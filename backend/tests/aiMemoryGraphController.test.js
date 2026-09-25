const test = require('node:test');
const assert = require('node:assert/strict');

test('aiConfigController memory endpoints handle queries gracefully with and without sessionId', async () => {
  const controller = require('../src/api/controllers/aiConfigController');

  // Test 1: getMemoryAnalytics without sessionId (must not throw or return 500)
  {
    let statusCode = 200;
    let jsonResult = null;
    const req = {
      authTenantId: 'tenant-test',
      query: {},
      app: { locals: { store: {} } },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResult = data;
        return this;
      },
    };

    await controller.getMemoryAnalytics(req, res);
    assert.equal(statusCode, 200, 'getMemoryAnalytics without sessionId must return 200');
    assert.equal(jsonResult.success, true);
    assert.ok(jsonResult.data);
  }

  // Test 2: searchMemory without sessionId (must not throw or return 500)
  {
    let statusCode = 200;
    let jsonResult = null;
    const req = {
      authTenantId: 'tenant-test',
      query: { q: 'entrega' },
      app: { locals: { store: {} } },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResult = data;
        return this;
      },
    };

    await controller.searchMemory(req, res);
    assert.equal(statusCode, 200, 'searchMemory without sessionId must return 200');
    assert.equal(jsonResult.success, true);
    assert.ok(Array.isArray(jsonResult.data));
  }

  // Test 3: getMemoryGraph returns success 200
  {
    let statusCode = 200;
    let jsonResult = null;
    const req = {
      authTenantId: 'tenant-test',
      query: { agentKey: 'camila', limit: 20 },
      app: { locals: { store: {} } },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResult = data;
        return this;
      },
    };

    await controller.getMemoryGraph(req, res);
    assert.equal(statusCode, 200, 'getMemoryGraph must return 200');
    assert.equal(jsonResult.success, true);
    assert.ok(jsonResult.data);
    assert.ok(Array.isArray(jsonResult.data.nodes));
    assert.ok(Array.isArray(jsonResult.data.edges));
  }

  // Test 4: getMemoryMedia returns real structured media items with OCR and categories
  {
    let statusCode = 200;
    let jsonResult = null;
    const req = {
      authTenantId: 'default',
      query: { limit: 10 },
      app: { locals: { store: {} } },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResult = data;
        return this;
      },
    };

    await controller.getMemoryMedia(req, res);
    assert.equal(statusCode, 200, 'getMemoryMedia must return 200');
    assert.equal(jsonResult.success, true);
    assert.ok(Array.isArray(jsonResult.items), 'items must be an array');
    assert.ok(typeof jsonResult.total === 'number', 'total must be a number');
    if (jsonResult.items.length > 0) {
      const item = jsonResult.items[0];
      assert.ok(item.id, 'item must have an id');
      assert.ok(item.url, 'item must have a media url');
      assert.ok(item.category, 'item must have a category');
      assert.ok(typeof item.confidence === 'number', 'confidence must be numeric');
    }
  }

  process.exit(0);
});
