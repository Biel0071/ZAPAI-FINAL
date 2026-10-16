const { query } = require('../src/infrastructure/config/database');

async function check() {
  const camp = await query("SELECT selected_contacts FROM campaigns WHERE id = 'cmp-recuperacao-02102026'");
  const contacts = camp.rows[0]?.selected_contacts || [];
  console.log('Total contacts:', contacts.length);

  let lidCount = 0;
  let phoneCount = 0;
  for (const c of contacts) {
    const isLid = String(c.phone).includes('@lid') || (String(c.phone).length >= 14 && !String(c.phone).startsWith('55'));
    if (isLid) lidCount++; else phoneCount++;
  }
  console.log('Contacts with LID as phone:', lidCount, '| Contacts with real phone:', phoneCount);

  // Check how many of these LIDs have mappings in whatsapp_lid_mappings table
  const lidMappings = await query("SELECT COUNT(1) FROM whatsapp_lid_mappings");
  console.log('Total whatsapp_lid_mappings in DB:', lidMappings.rows[0]?.count);

  const sampleMappings = await query("SELECT * FROM whatsapp_lid_mappings LIMIT 10");
  console.log('Sample whatsapp_lid_mappings:', sampleMappings.rows);

  // Sample 5 contacts with LID and check if their conversation or messages has phone
  for (const c of contacts.slice(0, 8)) {
    console.log('--- Contact:', c.name, 'phone:', c.phone, 'remoteJid:', c.remoteJid, 'convId:', c.conversationId);
    if (c.conversationId) {
      const conv = await query("SELECT c.id, c.remote_jid, l.phone as lead_phone, l.name as lead_name FROM conversations c LEFT JOIN leads l ON l.id = c.lead_id WHERE c.id = $1", [c.conversationId]);
      console.log('   Conv row:', conv.rows[0]);
      const msg = await query("SELECT remote_jid, sender, substring(text from 1 for 50) as prev FROM messages WHERE conversation_id = $1 AND direction = 'incoming' ORDER BY created_at DESC LIMIT 1", [c.conversationId]);
      console.log('   Last incoming msg:', msg.rows[0]);
    }
  }
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
