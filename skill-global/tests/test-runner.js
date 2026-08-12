const { runTestDetector } = require('./unit/test-detector');
const { runTestSync } = require('./unit/test-sync');
const { runTestIntegration } = require('./integration/test-install-flow');

console.log('============================================================');
console.log(' ZAPFLOW ENGINEERING PACK — TEST SUITE RUNNER');
console.log('============================================================\n');

try {
  runTestDetector();
  runTestSync();
  runTestIntegration();
  console.log('\n🟢 ALL ENGINEERING PACK TESTS PASSED SUCCESSFULLY! (100% PASS)');
} catch (err) {
  console.error('\n🔴 TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
}
