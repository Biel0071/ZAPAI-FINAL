const { execSync } = require('child_process');

const code = `
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zapai_crm'
});

async function run() {
  await client.connect();
  console.log('--- MESSAGES FOR DEPOSITO MATERIAL V A ---');
  
  // Find conversation
  const convRes = await client.query("SELECT id, name, phone, remote_jid, last_message, unread_count FROM conversations WHERE name ILIKE '%deposito%' OR phone ILIKE '%3193672075%' OR remote_jid ILIKE '%3193672075%'");
  console.log('Conversations matching:', convRes.rows);
  
  if (convRes.rows.length > 0) {
    for (const c of convRes.rows) {
      console.log('=== Checking messages for conv id:', c.id, 'phone:', c.phone, 'remote_jid:', c.remote_jid);
      const msgRes = await client.query("SELECT id, conversation_id, phone, remote_jid, text, media_type, media_path, from_me, created_at, status FROM messages WHERE conversation_id = $1 OR phone = $2 OR remote_jid = $3 ORDER BY created_at ASC", [c.id, c.phone, c.remote_jid]);
      console.log('Total messages found:', msgRes.rows.length);
      for (const m of msgRes.rows) {
        console.log(\`[\${m.created_at}] from_me=\${m.from_me} type=\${m.media_type} path=\${m.media_path} status=\${m.status} text: \${(m.text||'').slice(0, 60)}\`);
      }
    }
  }

  // Also search any message with 'bloco' or 'dmr'
  const anyMsg = await client.query("SELECT id, conversation_id, phone, remote_jid, text, media_type, from_me, created_at FROM messages WHERE text ILIKE '%dmr%' OR text ILIKE '%bloco%' ORDER BY created_at DESC LIMIT 10");
  console.log('--- Messages with dmr or bloco ---');
  for (const m of anyMsg.rows) {
    console.log(\`[\${m.created_at}] conv=\${m.conversation_id} phone=\${m.phone} jid=\${m.remote_jid} from_me=\${m.from_me} type=\${m.media_type} text: \${(m.text||'').slice(0, 60)}\`);
  }

  await client.end();
}

run().catch(console.error);
`;

try {
  execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "node -e \\"${code.replace(/"/g, '\\"').replace(/\$/g, '\\$')}\\""`, { stdio: 'inherit' });
} catch (e) {
  console.error(e.message);
}
