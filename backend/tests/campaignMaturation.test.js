const test = require('node:test');
const assert = require('node:assert/strict');
const campaignMaturationService = require('../services/campaignMaturationService');
const db = require('../src/infrastructure/config/database');

test.after(async () => {
  await db.pool.end();
});

test('campaignMaturationService: calculates maturation stats and daily goals', async () => {
  const stats = await campaignMaturationService.getChipMaturationStats('default');

  assert.ok(stats, 'Stats should exist');
  assert.ok(typeof stats.daysActive === 'number', 'daysActive should be a number');
  assert.ok(stats.daysActive >= 1, 'daysActive should be at least 1');
  assert.ok(typeof stats.recommendedDailyLimit === 'number', 'recommendedDailyLimit should be a number');
  assert.ok(stats.recommendedDailyLimit >= 20, 'recommendedDailyLimit should be at least 20');
  assert.ok(typeof stats.sentToday === 'number', 'sentToday should be a number');
  assert.ok(Array.isArray(stats.progressionTable), 'progressionTable should be an array');
  assert.equal(stats.progressionTable.length, 5, 'progressionTable should have 5 stages');

  const currentStage = stats.progressionTable.find(p => p.status === 'atual');
  assert.ok(currentStage, 'There should be a current stage in the progression table');
});
