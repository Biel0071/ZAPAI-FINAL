'use strict';

/**
 * ZAPFLOW Master E2E Test Suite Runner
 * 
 * Executes all 4 tiers of the End-to-End Opaque-box Test Suite:
 * - Tier 1: Feature Coverage (R1, R2, R3 in isolation)
 * - Tier 2: Boundary & Corner Cases
 * - Tier 3: Cross-Feature Combinations
 * - Tier 4: Real-World Application Scenarios
 * 
 * Invocation:
 *   node tests/e2e/run_all_e2e.js
 * 
 * Exit Codes:
 *   0: All tests passed (100% GREEN)
 *   1: One or more tests failed
 */

const { spawn } = require('child_process');
const path = require('path');

const TIERS = [
  {
    tier: 'Tier 1',
    name: 'Feature Coverage (Isolation)',
    file: 'tier1_feature_coverage.test.js',
    expectedTests: 18,
    reqs: 'R1 (6), R2 (6), R3 (6)',
  },
  {
    tier: 'Tier 2',
    name: 'Boundary & Corner Cases',
    file: 'tier2_boundary_corner.test.js',
    expectedTests: 15,
    reqs: 'R1 (5), R2 (5), R3 (5)',
  },
  {
    tier: 'Tier 3',
    name: 'Cross-Feature Combinations',
    file: 'tier3_cross_feature.test.js',
    expectedTests: 5,
    reqs: 'Pairwise Cross-Boundary Interactions',
  },
  {
    tier: 'Tier 4',
    name: 'Real-World Application Scenarios',
    file: 'tier4_real_world_scenarios.test.js',
    expectedTests: 5,
    reqs: 'End-to-End Customer Workflows',
  },
];

async function runTier(tierConfig) {
  const filePath = path.join(__dirname, tierConfig.file);
  const startTime = Date.now();

  return new Promise((resolve) => {
    console.log(`\n================================================================================`);
    console.log(`  RUNNING ${tierConfig.tier.toUpperCase()}: ${tierConfig.name}`);
    console.log(`  File: ${tierConfig.file} | Coverage: ${tierConfig.reqs}`);
    console.log(`================================================================================\n`);

    const child = spawn(process.execPath, ['--test', filePath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ALLOW_DEV_AUTH_BYPASS: 'true',
      },
    });

    child.on('close', (code) => {
      const elapsedMs = Date.now() - startTime;
      resolve({
        ...tierConfig,
        exitCode: code,
        passed: code === 0,
        elapsedMs,
      });
    });

    child.on('error', (err) => {
      const elapsedMs = Date.now() - startTime;
      console.error(`[RUNNER-ERROR] Failed to run ${tierConfig.file}:`, err);
      resolve({
        ...tierConfig,
        exitCode: 1,
        passed: false,
        elapsedMs,
        error: err.message,
      });
    });
  });
}

async function runAll() {
  const masterStart = Date.now();
  console.log(`\n================================================================================`);
  console.log(`               ZAPFLOW E2E TEST SUITE — MASTER RUNNER`);
  console.log(`   Validating Requirements: R1 (Session Stability), R2 (Sync), R3 (Commerce)`);
  console.log(`   Node.js: ${process.version} | Timestamp: ${new Date().toISOString()}`);
  console.log(`================================================================================\n`);

  const results = [];
  for (const tier of TIERS) {
    const res = await runTier(tier);
    results.push(res);
  }

  const totalElapsed = Date.now() - masterStart;
  const allPassed = results.every(r => r.passed);
  const totalTests = TIERS.reduce((acc, t) => acc + t.expectedTests, 0);

  console.log(`\n================================================================================`);
  console.log(`                        MASTER E2E EXECUTION SUMMARY`);
  console.log(`================================================================================`);
  console.log(`| Tier   | Name                              | Tests | Status | Time (ms) |`);
  console.log(`|--------|-----------------------------------|-------|--------|-----------|`);

  for (const r of results) {
    const status = r.passed ? 'PASSED (PASS)' : 'FAILED (FAIL)';
    const namePadded = r.name.padEnd(33, ' ');
    const testsPadded = String(r.expectedTests).padStart(5, ' ');
    const statusPadded = status.padEnd(6, ' ');
    const timePadded = String(r.elapsedMs).padStart(9, ' ');
    console.log(`| ${r.tier} | ${namePadded} | ${testsPadded} | ${statusPadded} | ${timePadded} |`);
  }

  console.log(`================================================================================`);
  console.log(`TOTAL SUITES:    ${results.length}`);
  console.log(`TOTAL TESTS:     ${totalTests}`);
  console.log(`SUITES PASSED:   ${results.filter(r => r.passed).length} / ${results.length}`);
  console.log(`OVERALL RESULT:  ${allPassed ? '>>> ALL TIERS GREEN (SUCCESS) <<<' : '>>> SUITE FAILED <<<'}`);
  console.log(`TOTAL DURATION:  ${(totalElapsed / 1000).toFixed(2)}s`);
  console.log(`================================================================================\n`);

  process.exit(allPassed ? 0 : 1);
}

runAll().catch((err) => {
  console.error('[MASTER-RUNNER-FATAL]', err);
  process.exit(1);
});
