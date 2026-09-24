const aiResponseEngine = require('../services/aiResponseEngine');
const { getClient } = require('../src/infrastructure/config/ai');

async function testChain() {
  console.log('1. Checking getClient():', getClient());

  console.log('\n2. Testing evolutionaryOrchestrator directly:');
  try {
    const evolutionaryOrchestrator = require('../src/ai/evolutionary/orchestrator');
    const res = await evolutionaryOrchestrator.orchestrateResponse({
      agent: { name: 'Camila' },
      customerMessage: 'Olá bom dia',
      companyId: 'default'
    });
    console.log('Orchestrator res:', res);
  } catch (err) {
    console.error('Orchestrator failed as expected with error:', err.message);
  }

  console.log('\n3. Testing generateAIResponse:');
  try {
    const aiRes = await aiResponseEngine.generateAIResponse({
      agent: { name: 'Camila' },
      customerMessage: 'Olá bom dia',
      companyId: 'default'
    });
    console.log('generateAIResponse result:', aiRes);
  } catch (err) {
    console.error('generateAIResponse failed:', err.message);
  }

  process.exit(0);
}

testChain();
