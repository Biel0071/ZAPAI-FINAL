const { query } = require('../src/infrastructure/config/database');

async function check() {
  const msgs = await query(`
    SELECT id, conversation_id, remote_jid, status, direction, sender, whatsapp_message_id, created_at, text 
    FROM messages 
    WHERE sender = 'campaign' 
    ORDER BY created_at DESC 
    LIMIT 25
  `);
  console.log('Total campaign messages found:', msgs.rows.length);
  for (const m of msgs.rows) {
    console.log(`[${m.created_at.toISOString()}] Msg ${m.id} -> JID: ${m.remote_jid} | WAMsgId: ${m.whatsapp_message_id} | Status: ${m.status} | Text: ${m.text?.substring(0, 40)}...`);
  }

  // Also check any messages created today (02/10) regardless of sender
  const todayMsgs = await query(`
    SELECT id, conversation_id, remote_jid, status, direction, sender, whatsapp_message_id, created_at, text 
    FROM messages 
    WHERE created_at >= '2026-10-02 00:00:00' 
    ORDER BY created_at DESC 
    LIMIT 25
  `);
  console.log('\nTotal messages created today (02/10):', todayMsgs.rows.length);
  for (const m of todayMsgs.rows) {
    console.log(`[${m.created_at.toISOString()}] (${m.direction}/${m.sender || 'none'}/${m.status}) [Conv ${m.conversation_id}] -> JID: ${m.remote_jid} | Msg: ${m.text?.substring(0, 40)}...`);
  }

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
