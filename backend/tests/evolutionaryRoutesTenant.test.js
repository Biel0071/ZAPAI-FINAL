const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const learningEngine = require('../src/ai/evolutionary/learningEngine');

test('evolution routes use the authenticated tenant even when company_id is supplied', async () => {
  const original = {
    getEvolutionMetrics: learningEngine.getEvolutionMetrics,
    listSuggestions: learningEngine.listSuggestions,
    approveSuggestion: learningEngine.approveSuggestion,
  };
  const seen = [];
  learningEngine.getEvolutionMetrics = async ({ companyId }) => {
    seen.push(['metrics', companyId]);
    return { totalExperiences: 0 };
  };
  learningEngine.listSuggestions = async ({ companyId }) => {
    seen.push(['suggestions', companyId]);
    return [];
  };
  learningEngine.approveSuggestion = async ({ companyId }) => {
    seen.push(['approve', companyId]);
    return { ok: true };
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.authTenantId = 'tenant-a';
    next();
  });
  app.use('/api/ai/evolution', require('../src/ai/evolutionary/evolutionaryRoutes'));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const base = `http://127.0.0.1:${server.address().port}/api/ai/evolution`;
    assert.equal((await fetch(`${base}/metrics?company_id=tenant-b`)).status, 200);
    assert.equal((await fetch(`${base}/suggestions?company_id=tenant-b`)).status, 200);
    assert.equal((await fetch(`${base}/suggestions/1/approve?company_id=tenant-b`, { method: 'POST' })).status, 200);
    assert.deepEqual(seen, [
      ['metrics', 'tenant-a'],
      ['suggestions', 'tenant-a'],
      ['approve', 'tenant-a'],
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    Object.assign(learningEngine, original);
  }
});

test('evolution routes reject an unverified tenant from a header or query', async () => {
  const original = learningEngine.getEvolutionMetrics;
  const previousBypass = process.env.ALLOW_DEV_AUTH_BYPASS;
  process.env.ALLOW_DEV_AUTH_BYPASS = 'false';
  let called = false;
  learningEngine.getEvolutionMetrics = async () => {
    called = true;
    return {};
  };
  const app = express();
  app.use('/api/ai/evolution', require('../src/ai/evolutionary/evolutionaryRoutes'));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/evolution/metrics?company_id=tenant-b`, {
      headers: { 'x-company-id': 'tenant-b' },
    });
    assert.equal(response.status, 401);
    assert.equal(called, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    learningEngine.getEvolutionMetrics = original;
    if (previousBypass === undefined) delete process.env.ALLOW_DEV_AUTH_BYPASS;
    else process.env.ALLOW_DEV_AUTH_BYPASS = previousBypass;
  }
});

test('metrics route reports a database failure instead of successful mock data', async () => {
  const original = learningEngine.getEvolutionMetrics;
  learningEngine.getEvolutionMetrics = async () => { throw new Error('database unavailable'); };
  const app = express();
  app.use((req, _res, next) => {
    req.authTenantId = 'tenant-a';
    next();
  });
  app.use('/api/ai/evolution', require('../src/ai/evolutionary/evolutionaryRoutes'));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/evolution/metrics`);
    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.data, undefined);
    assert.equal(payload.error, 'Falha ao carregar métricas de evolução.');
    assert.doesNotMatch(payload.error, /database unavailable/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    learningEngine.getEvolutionMetrics = original;
  }
});

test('suggestions route distinguishes a database failure from a successful empty list', async () => {
  const originalPool = learningEngine.pool;
  learningEngine.pool = {
    query: async () => { throw new Error('database unavailable'); },
  };
  const app = express();
  app.use((req, _res, next) => {
    req.authTenantId = 'tenant-a';
    next();
  });
  app.use('/api/ai/evolution', require('../src/ai/evolutionary/evolutionaryRoutes'));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const url = `http://127.0.0.1:${server.address().port}/api/ai/evolution/suggestions`;
    const failed = await fetch(url);
    assert.equal(failed.status, 500);
    const failedPayload = await failed.json();
    assert.deepEqual(failedPayload, { success: false, error: 'Falha ao carregar sugestões de evolução.' });
    assert.doesNotMatch(failedPayload.error, /database unavailable/);

    learningEngine.pool = { query: async () => ({ rows: [] }) };
    const empty = await fetch(url);
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { success: true, data: [] });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    learningEngine.pool = originalPool;
  }
});
