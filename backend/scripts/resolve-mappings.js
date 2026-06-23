require('dotenv').config();
const registry = require('../services/whatsapp/state/registry');
const lidMapper = require('../services/whatsapp/shared/lidMapper');
const { Pool } = require('pg');
const connectionString = process.env.DATABASE_URL.replace('@postgres:', '@127.0.0.1:');
const pool = new Pool({ connectionString });

async function resolve() {
  console.log('--- ACTIVE SESSIONS ---', Object.keys(registry.activeSessions || {}));

  for (const [sessionName, session] of Object.entries(registry.activeSessions || {})) {
    const sock = session.sock;
    console.log(`Session: ${sessionName}`);
    if (sock) {
      console.log(`  sock.lidMapping size/keys:`, sock.lidMapping ? (sock.lidMapping instanceof Map ? sock.lidMapping.size : Object.keys(sock.lidMapping).length) : 0);
      const mapping = sock.lidMapping;
      if (mapping) {
        if (mapping instanceof Map) {
          for (const [lid, jid] of mapping.entries()) {
            const lidDigits = String(lid).split('@')[0];
            const jidDigits = String(jid).split('@')[0];
            console.log(`    Mapping (Map): ${lidDigits} <-> ${jidDigits}`);
            await lidMapper.saveMapping(lidDigits, jidDigits);
          }
        } else if (typeof mapping === 'object') {
          for (const [lid, jid] of Object.entries(mapping)) {
            const lidDigits = String(lid).split('@')[0];
            const jidDigits = String(jid).split('@')[0];
            console.log(`    Mapping (Obj): ${lidDigits} <-> ${jidDigits}`);
            await lidMapper.saveMapping(lidDigits, jidDigits);
          }
        }
      }

      const store = session.realtimeStore;
      if (store?.contacts) {
        console.log(`  realtimeStore contacts count:`, Object.keys(store.contacts).length);
        for (const [id, contact] of Object.entries(store.contacts)) {
          if (contact && contact.lid && contact.id && contact.id.endsWith('@s.whatsapp.net')) {
            const lidDigits = String(contact.lid).split('@')[0];
            const jidDigits = String(contact.id).split('@')[0];
            console.log(`    Mapping (Contact): ${lidDigits} <-> ${jidDigits}`);
            await lidMapper.saveMapping(lidDigits, jidDigits);
          }
        }
      }
    }
  }

  // Check mappings database
  const result = await pool.query('SELECT * FROM whatsapp_lid_mappings');
  console.log('--- WHATSAPP LID MAPPINGS IN DB ---');
  console.log(result.rows);

  await pool.end();
}

// Since the script needs to run inside the running app context, we can require it in a routing file or just run it. 
// But wait! If we run it as a standalone script, registry.activeSessions will be empty because it starts a new process!
// Ah! Registry.activeSessions is only populated inside the running backend process.
// To run it inside the running app context, we can trigger it via a temporary HTTP endpoint or inspect via a custom script that we require/call!
resolve();
