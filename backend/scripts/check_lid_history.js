const { query } = require('../src/infrastructure/config/database');

async function check() {
  const outgoingLid = await query("SELECT COUNT(1) FROM messages WHERE remote_jid LIKE '%@lid' AND from_me = TRUE");
  console.log('Outgoing messages to @lid:', outgoingLid.rows[0]?.count);

  const incomingLid = await query("SELECT COUNT(1) FROM messages WHERE remote_jid LIKE '%@lid' AND from_me = FALSE");
  console.log('Incoming messages from @lid:', incomingLid.rows[0]?.count);

  const sampleOutgoing = await query("SELECT id, remote_jid, status, substring(text from 1 for 60) as text, created_at FROM messages WHERE remote_jid LIKE '%@lid' AND from_me = TRUE ORDER BY created_at DESC LIMIT 5");
  console.log('Sample outgoing to @lid:', sampleOutgoing.rows);

  const outgoingPhone = await query("SELECT COUNT(1) FROM messages WHERE remote_jid LIKE '%@s.whatsapp.net' AND from_me = TRUE");
  console.log('\nOutgoing messages to @s.whatsapp.net:', outgoingPhone.rows[0]?.count);

  const incomingPhone = await query("SELECT COUNT(1) FROM messages WHERE remote_jid LIKE '%@s.whatsapp.net' AND from_me = FALSE");
  console.log('Incoming messages from @s.whatsapp.net:', incomingPhone.rows[0]?.count);

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
