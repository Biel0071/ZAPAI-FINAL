'use strict';

const assert = require('assert');
const zaiUsageService = require('../services/zaiUsageService');

async function runTests() {
  console.log('--- TEST: zaiUsageService ---');

  // Test 1: Admin account is unlimited
  const adminUsage = await zaiUsageService.getUsage({
    companyId: 'tenant-test-admin',
    userId: 'admin-user',
    role: 'admin',
  });
  assert.strictEqual(adminUsage.isAdmin, true);
  assert.strictEqual(adminUsage.isUnlimited, true);
  assert.strictEqual(adminUsage.canUse, true);
  console.log('✅ [TEST 1 PASSED] Admin account is unlimited');

  // Test 2: Master account is unlimited
  const masterConsume = await zaiUsageService.consumeUsage({
    companyId: 'tenant-test-master',
    userId: 'master-user',
    role: 'master',
  });
  assert.strictEqual(masterConsume.ok, true);
  assert.strictEqual(masterConsume.isUnlimited, true);
  console.log('✅ [TEST 2 PASSED] Master account bypasses quota consumption');

  // Test 3: Regular user gets free quota
  const testTenant = `test-tenant-${Date.now()}`;
  const userUsage = await zaiUsageService.getUsage({
    companyId: testTenant,
    userId: 'regular-user',
    role: 'user',
  });
  assert.strictEqual(userUsage.isAdmin, false);
  assert.strictEqual(userUsage.isUnlimited, false);
  assert.strictEqual(userUsage.canUse, true);
  assert.strictEqual(userUsage.limitToday, 50);
  console.log(`✅ [TEST 3 PASSED] Regular user starts with 50 free messages/day`);

  // Test 4: Consume usage increments count
  const consumeRes = await zaiUsageService.consumeUsage({
    companyId: testTenant,
    userId: 'regular-user',
    role: 'user',
  });
  assert.strictEqual(consumeRes.ok, true);
  assert.strictEqual(consumeRes.countToday, 1);
  assert.strictEqual(consumeRes.remainingToday, 49);
  console.log(`✅ [TEST 4 PASSED] Consume usage decrements remaining count (now 49)`);

  // Test 5: Recharge balance adds credits
  const recharged = await zaiUsageService.rechargeBalance({
    companyId: testTenant,
    userId: 'regular-user',
    amount: 25,
  });
  assert.strictEqual(recharged.balanceCredits >= 25, true);
  console.log(`✅ [TEST 5 PASSED] Recharge added credits (balance: ${recharged.balanceCredits})`);

  console.log('--- ALL zaiUsageService TESTS PASSED! ---');
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
