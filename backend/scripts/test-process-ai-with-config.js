const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('../src/infrastructure/config/database');
const { processAI } = require('../services/ai.service');

async function run() {
  console.log('Testing processAI with aiConfig loaded from system_settings...');
  const s = await query("SELECT value FROM system_settings WHERE key = 'ai_config'");
  const aiConfig = JSON.parse(s.rows[0].value);

  const res = await processAI({
    contact: {
      phone: '5511999999999',
      name: 'João',
      conversationId: 999
    },
    history: [],
    message: 'Olá, qual é o horário de atendimento de vocês?',
    store: {
      aiConfig
    },
    agentName: 'Camila',
    companyId: 'default'
  });

  console.log('\n--- processAI Result ---');
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error('Error in test:', err);
  process.exit(1);
});
