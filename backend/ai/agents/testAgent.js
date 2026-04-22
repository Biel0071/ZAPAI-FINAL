const path = require('path');
const { runSmokeTests } = require('../../tests/testRunner');

async function run(payload = {}) {
  const baseUrl = payload.baseUrl || process.env.SMOKE_TEST_BASE_URL || 'http://localhost:4000';
  process.env.BACKEND_TEST_BASE_URL = baseUrl;
  const result = await runSmokeTests();

  return {
    agent: 'testAgent',
    generatedAt: new Date().toISOString(),
    cwd: path.resolve(__dirname, '..', '..'),
    baseUrl,
    result,
  };
}

module.exports = {
  run,
};
