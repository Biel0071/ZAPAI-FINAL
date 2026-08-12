const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { computeFileHash } = require('../../installer/sync');

function runTestSync() {
  console.log('Testing Hash Computation & Sync Utilities...');
  
  const sampleFile = path.join(__dirname, 'test-detector.js');
  const hash1 = computeFileHash(sampleFile);
  const hash2 = computeFileHash(sampleFile);
  
  assert(hash1, 'Hash should not be null');
  assert.strictEqual(hash1, hash2, 'Hash should be deterministic');
  
  console.log('  ✅ Sync & Hash unit tests PASSED.');
}

module.exports = { runTestSync };
