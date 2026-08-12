const assert = require('assert');
const path = require('path');
const { detectProjectProfile } = require('../../installer/detector');

function runTestDetector() {
  console.log('Testing Project Stack Detector...');
  const profile = detectProjectProfile(path.resolve(__dirname, '../../..'));
  
  assert(profile.project, 'Project name should be detected');
  assert(Array.isArray(profile.language), 'Language should be an array');
  assert(profile.language.includes('JavaScript') || profile.language.includes('TypeScript'), 'Should detect JS or TS');
  assert(profile.packageManager, 'Package manager should be detected');
  
  console.log('  ✅ Stack detector unit tests PASSED.');
}

module.exports = { runTestDetector };
