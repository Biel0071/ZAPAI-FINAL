const { query } = require('../src/infrastructure/config/database');

async function main() {
  const res = await query("SELECT selected_contacts FROM campaigns WHERE id = 'cmp-recuperacao-02102026'");
  const contacts = res.rows[0]?.selected_contacts || [];
  console.log(`Checking ${contacts.length} campaign contacts...`);

  let resolvedCount = 0;
  let unresolvedCount = 0;

  for (const c of contacts) {
    const rawPhone = String(c.phone || '').replace(/\D/g, '');
    const isLid = rawPhone.length >= 14 && !rawPhone.startsWith('55');

    if (!isLid && rawPhone.startsWith('55') && rawPhone.length >= 12 && rawPhone.length <= 13) {
      resolvedCount++;
      continue;
    }

    // Try to find real phone
    const cleanLid = String(c.remoteJid || c.phone || '').replace(/\D/g, '');

    // 1. check whatsapp_lid_mappings
    const mapping = await query("SELECT phone FROM whatsapp_lid_mappings WHERE lid = $1", [cleanLid]);
    if (mapping.rows[0]?.phone) {
      console.log(`[MAP] Found phone in lid_mappings: LID ${cleanLid} -> ${mapping.rows[0].phone} (${c.name})`);
      resolvedCount++;
      continue;
    }

    // 2. check leads table for this conversation
    if (c.conversationId) {
      const conv = await query("SELECT c.lead_id, l.phone, l.name FROM conversations c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1", [c.conversationId]);
      const lPhone = String(conv.rows[0]?.phone || '').replace(/\D/g, '');
      if (lPhone.startsWith('55') && lPhone.length >= 12 && lPhone.length <= 13) {
        console.log(`[LEAD] Found phone in leads: Conv ${c.conversationId} -> ${lPhone} (${c.name})`);
        resolvedCount++;
        continue;
      }
    }

    // 3. check messages table for any participant or text containing phone
    if (c.conversationId) {
      const msgs = await query(`
        SELECT remote_jid, text 
        FROM messages 
        WHERE conversation_id = $1 
        ORDER BY created_at ASC 
        LIMIT 20
      `, [c.conversationId]);
      let foundInMsg = false;
      for (const m of msgs.rows) {
        if (m.remote_jid && m.remote_jid.endsWith('@s.whatsapp.net')) {
          const p = m.remote_jid.split('@')[0];
          if (p.startsWith('55')) {
            console.log(`[MSG-JID] Found phone in msg remote_jid: Conv ${c.conversationId} -> ${p} (${c.name})`);
            resolvedCount++;
            foundInMsg = true;
            break;
          }
        }
      }
      if (foundInMsg) continue;
    }

    unresolvedCount++;
    console.log(`[UNRESOLVED] LID ${cleanLid} (${c.name}) convId=${c.conversationId}`);
  }

  console.log(`\nSummary: Resolved: ${resolvedCount} | Unresolved LID: ${unresolvedCount}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
