const { query } = require('../backend/config/database');
const aiService = require('../backend/services/ai.service');

async function run() {
  console.log('--- INSPECTING PROVIDER KEYS ---');
  try {
    const res = await query(`
      SELECT id, provider, model, enabled, workspace_id, updated_at
      FROM provider_keys
    `);
    console.log('Provider Keys in DB:', res.rows.length);
    for (const row of res.rows) {
      console.log(row);
    }

    console.log('\n--- INSPECTING AI SERVICE STATUS ---');
    const status = await aiService.getAIStatus();
    console.log(status);
  } catch (err) {
    console.error('Error during query:', err);
  }
}

run();
