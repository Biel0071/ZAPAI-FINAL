const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('../src/infrastructure/config/database');

async function cleanMocks() {
  console.log('[DB-CLEAN] Starting cleanup of mock seed data...');
  try {
    // Delete messages of mock conversations
    const msgRes = await query(`
      DELETE FROM messages 
      WHERE conversation_id IN (
        SELECT id FROM conversations WHERE session_id LIKE 'dev-session%'
      ) OR phone IN ('+5511999999999', '+5511888888888', '+5511777777777', '+5511666666666', '+5511555555555')
    `);
    console.log(`[DB-CLEAN] Deleted ${msgRes.rowCount || 0} mock messages.`);

    // Delete mock conversations
    const convRes = await query(`
      DELETE FROM conversations 
      WHERE session_id LIKE 'dev-session%' 
         OR lead_id IN (SELECT id FROM leads WHERE phone IN ('+5511999999999', '+5511888888888', '+5511777777777', '+5511666666666', '+5511555555555'))
    `);
    console.log(`[DB-CLEAN] Deleted ${convRes.rowCount || 0} mock conversations.`);

    // Delete mock leads
    const leadRes = await query(`
      DELETE FROM leads 
      WHERE phone IN ('+5511999999999', '+5511888888888', '+5511777777777', '+5511666666666', '+5511555555555')
    `);
    console.log(`[DB-CLEAN] Deleted ${leadRes.rowCount || 0} mock leads.`);

    // Delete mock campaigns
    const campRes = await query(`
      DELETE FROM campaigns 
      WHERE id LIKE 'dev-campaign%'
    `);
    console.log(`[DB-CLEAN] Deleted ${campRes.rowCount || 0} mock campaigns.`);

    // Delete mock sessions
    const sessRes = await query(`
      DELETE FROM sessions 
      WHERE session_id LIKE 'dev-session%'
    `);
    console.log(`[DB-CLEAN] Deleted ${sessRes.rowCount || 0} mock sessions.`);

    console.log('[DB-CLEAN] Mock seed data successfully removed from database.');
    process.exit(0);
  } catch (err) {
    console.error('[DB-CLEAN] Error cleaning mock data:', err);
    process.exit(1);
  }
}

cleanMocks();
