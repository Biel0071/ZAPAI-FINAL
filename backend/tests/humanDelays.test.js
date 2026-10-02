const test = require('node:test');
const assert = require('node:assert/strict');

const campaignDispatchEngine = require('../services/campaignDispatchEngine');
const delayEngine = require('../src/ai/agents/engine/delayEngine');
const aiAgentService = require('../src/ai/agents/services/aiAgentService');
const db = require('../src/infrastructure/config/database');

test.after(async () => {
  await db.pool.end();
});

test('campaignDispatchEngine: normalizes human delay settings for 2-hour cadence', () => {
  const dummyCampaign = {
    id: 'test-campaign-human',
    name: 'Test Human Campaign',
    selectedContacts: Array.from({ length: 61 }, (_, i) => ({ phone: `55319999900${i}` })),
    messages: [{ type: 'text', content: 'Oi, tudo bem? Aqui é a Camila da Vista Alegre!' }],
    settings: {
      intervalSeconds: 115,
      randomDelayMin: 85000,
      randomDelayMax: 140000,
      typingDelaySeconds: 9,
      typingDelayMinSeconds: 6,
      typingDelayMaxSeconds: 12,
      pauseEvery: 7,
      pauseEveryMin: 6,
      pauseEveryMax: 8,
      pauseSeconds: 180,
      pauseMinSeconds: 150,
      pauseMaxSeconds: 240,
    },
  };

  const state = campaignDispatchEngine.createCampaignState(dummyCampaign);

  assert.equal(state.pendingQueue.length, 61);
  assert.equal(state.settings.randomDelayMin, 85000);
  assert.equal(state.settings.randomDelayMax, 140000);
  assert.equal(state.settings.typingDelayMinMs, 6000);
  assert.equal(state.settings.typingDelayMaxMs, 12000);
  assert.equal(state.settings.pauseEveryMin, 6);
  assert.equal(state.settings.pauseEveryMax, 8);
  assert.equal(state.settings.pauseMinMs, 150000);
  assert.equal(state.settings.pauseMaxMs, 240000);
  assert.ok(state.nextPauseThreshold >= 6 && state.nextPauseThreshold <= 8);
});

test('campaignDispatchEngine: handles delays specified in seconds or fallback interval', () => {
  const dummyCampaign = {
    id: 'test-seconds',
    selectedContacts: [{ phone: '123' }],
    settings: {
      intervalSeconds: 120, // 2 minutes average
    },
  };

  const state = campaignDispatchEngine.createCampaignState(dummyCampaign);

  // interval is 120s = 120000ms
  assert.equal(state.settings.intervalMs, 120000);
  // randomDelayMin is ~0.8 * 120000 = 96000ms
  assert.ok(state.settings.randomDelayMin >= 90000 && state.settings.randomDelayMin <= 100000);
  // randomDelayMax is ~1.2 * 120000 = 144000ms
  assert.ok(state.settings.randomDelayMax >= 140000 && state.settings.randomDelayMax <= 150000);
  // typing delay defaults to 6s - 12s
  assert.equal(state.settings.typingDelayMinMs, 6000);
  assert.equal(state.settings.typingDelayMaxMs, 12000);
});

test('campaignDispatchEngine: typing delay has dynamic jitter and respects text length within [6s, 12s]', () => {
  const dummyCampaign = {
    id: 'test-typing',
    settings: {
      typingDelayMinSeconds: 6,
      typingDelayMaxSeconds: 12,
    },
  };
  const state = campaignDispatchEngine.createCampaignState(dummyCampaign);

  const samples = [];
  for (let i = 0; i < 100; i++) {
    const delay = campaignDispatchEngine.getCampaignTypingDelay(state, 'Mensagem média de teste');
    assert.ok(delay >= 6000, `Typing delay ${delay}ms should be >= 6000ms`);
    assert.ok(delay <= 12000, `Typing delay ${delay}ms should be <= 12000ms`);
    samples.push(delay);
  }

  // Verify dynamic jitter: samples should not all be identical
  const uniqueSamples = new Set(samples);
  assert.ok(uniqueSamples.size > 20, 'Typing delays must vary dynamically (not fixed)');
});

test('campaignDispatchEngine: random delay varies naturally within configured range', () => {
  const dummyCampaign = {
    id: 'test-random',
    settings: {
      randomDelayMin: 85000,
      randomDelayMax: 140000,
    },
  };
  const state = campaignDispatchEngine.createCampaignState(dummyCampaign);

  const samples = [];
  for (let i = 0; i < 100; i++) {
    const delay = campaignDispatchEngine.getRandomDelay(state);
    assert.ok(delay >= 85000, `Delay ${delay}ms should be >= 85000ms`);
    assert.ok(delay <= 140000, `Delay ${delay}ms should be <= 140000ms`);
    samples.push(delay);
  }

  const uniqueSamples = new Set(samples);
  assert.ok(uniqueSamples.size > 80, 'Inter-message delays must vary naturally');
});

test('campaignDispatchEngine: 61 leads dispatch simulation spans ~2 hours', () => {
  const dummyCampaign = {
    id: 'sim-cmp-61',
    name: 'Simulated 61 Leads',
    selectedContacts: Array.from({ length: 61 }, (_, i) => ({ phone: `55319999900${i}` })),
    messages: [{ type: 'text', content: 'Oi! Tudo bem? É a Camila aqui do Depósito Vista Alegre.' }],
    settings: {
      intervalSeconds: 115,
      randomDelayMin: 85000,
      randomDelayMax: 140000,
      typingDelayMinSeconds: 6,
      typingDelayMaxSeconds: 12,
      pauseEveryMin: 6,
      pauseEveryMax: 8,
      pauseMinSeconds: 150,
      pauseMaxSeconds: 240,
    },
  };

  const state = campaignDispatchEngine.createCampaignState(dummyCampaign);

  let totalSimulatedMs = 0;
  let sentCount = 0;
  let pauseCount = 0;
  let totalPauseMs = 0;

  while (sentCount < 61) {
    sentCount += 1;
    state.metrics.sent = sentCount;

    // 1. Typing delay presence
    const typingMs = campaignDispatchEngine.getCampaignTypingDelay(state, dummyCampaign.messages[0].content);
    totalSimulatedMs += typingMs;

    // 2. Pause simulation check
    if (sentCount < 61 && sentCount >= state.nextPauseThreshold) {
      pauseCount += 1;
      const pauseMin = state.settings.pauseMinMs;
      const pauseMax = state.settings.pauseMaxMs;
      const pauseDelay = Math.floor(Math.random() * (pauseMax - pauseMin + 1)) + pauseMin;
      totalSimulatedMs += pauseDelay;
      totalPauseMs += pauseDelay;

      const nextGap = Math.floor(Math.random() * (state.settings.pauseEveryMax - state.settings.pauseEveryMin + 1)) + state.settings.pauseEveryMin;
      state.nextPauseThreshold = sentCount + nextGap;
    }

    // 3. Inter-message delay
    if (sentCount < 61) {
      const delay = campaignDispatchEngine.getRandomDelay(state);
      totalSimulatedMs += delay;
    }
  }

  const totalMinutes = totalSimulatedMs / 1000 / 60;
  const avgSecondsPerLead = (totalSimulatedMs / 1000) / 61;

  // Verify cadence:
  // Target: ~120 minutes (allow range 100 min to 150 min depending on random draws)
  assert.ok(
    totalMinutes >= 100 && totalMinutes <= 155,
    `Total campaign duration for 61 leads should be ~2 hours (~120 min), got ${totalMinutes.toFixed(1)} min`
  );
  assert.ok(
    avgSecondsPerLead >= 95 && avgSecondsPerLead <= 150,
    `Average seconds per lead should be ~110-130s, got ${avgSecondsPerLead.toFixed(1)}s`
  );
  // Verify pauses occurred ~7-9 times
  assert.ok(pauseCount >= 6 && pauseCount <= 10, `Expected 6 to 10 pauses during 61 sends, got ${pauseCount}`);
});

test('delayEngine: getDelayMs and getTypingDelayMs provide human attendant delay ranges', () => {
  const camila = {
    name: 'Camila',
    delayProfile: { minMs: 12000, maxMs: 25000 },
    typingDelayProfile: { minMs: 6000, maxMs: 14000 },
  };

  for (let i = 0; i < 50; i++) {
    const readingDelay = delayEngine.getDelayMs(camila);
    assert.ok(readingDelay >= 12000 && readingDelay <= 25000, `Reading delay ${readingDelay}ms out of range [12s, 25s]`);

    const typingDelay = delayEngine.getTypingDelayMs(camila, 'Olá, tudo bem? Consigo te ajudar com o cimento sim!');
    assert.ok(typingDelay >= 6000 && typingDelay <= 14000, `Typing delay ${typingDelay}ms out of range [6s, 14s]`);
  }
});

test('campaignDispatchEngine: getCampaignTypingDelay handles object messages, nulls, and extreme lengths without NaN', () => {
  const dummyCampaign = {
    id: 'test-typing-robustness',
    settings: {
      typingDelayMinSeconds: 6,
      typingDelayMaxSeconds: 12,
    },
  };
  const state = campaignDispatchEngine.createCampaignState(dummyCampaign);

  const testCases = [
    null,
    undefined,
    '',
    'a',
    'A'.repeat(5000),
    { text: 'Mensagem em objeto' },
    { caption: 'Legenda em foto' },
    { content: 'Conteúdo em objeto' },
    { unknownField: 123 },
    42,
  ];

  for (const input of testCases) {
    const delay = campaignDispatchEngine.getCampaignTypingDelay(state, input);
    assert.ok(Number.isFinite(delay), `Typing delay for input ${JSON.stringify(input)} must be finite, got ${delay}`);
    assert.ok(delay >= 6000, `Typing delay ${delay}ms must be >= 6000ms`);
    assert.ok(delay <= 12000, `Typing delay ${delay}ms must be <= 12000ms`);
  }
});

test('campaignRepository and campaignDispatchEngine preserve tenant companyId', () => {
  const campaignRepository = require('../src/data/repositories/campaignRepository');
  const dummyCampaign = {
    id: 'cmp-tenant-test',
    companyId: 'store-bh-01',
    name: 'Tenant Campaign',
    selectedContacts: [{ phone: '5531988887777' }],
  };

  const state = campaignDispatchEngine.createCampaignState(dummyCampaign);
  assert.equal(state.companyId, 'store-bh-01', 'createCampaignState must preserve companyId');
});

