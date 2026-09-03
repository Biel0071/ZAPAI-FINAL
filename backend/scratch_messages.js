const db = require('./src/infrastructure/config/database');
const { activeSessions } = require('./services/whatsapp/state/registry');

async function run() {
  const result = await db.query('SELECT id, status, text, remote_jid, created_at, from_me, whatsapp_message_id FROM messages WHERE from_me = true ORDER BY created_at DESC LIMIT 5');
  console.log("=== ÚLTIMAS 5 MENSAGENS ENVIADAS (from_me) ===");
  console.log(JSON.stringify(result.rows, null, 2));

  console.log("\n=== SESSÕES ATIVAS NO REGISTRY ===");
  if (activeSessions) {
    Object.keys(activeSessions).forEach(key => {
      const s = activeSessions[key];
      console.log(`- Sessão: ${key}, Phone: ${s.phone}, Status: ${s.status}, JID: ${s.sock?.user?.id}`);
    });
  } else {
    console.log("activeSessions é null");
  }

  process.exit(0);
}
run();
