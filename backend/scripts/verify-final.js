require('dotenv').config();
const { Pool } = require('pg');

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  connectionString = connectionString.replace('@postgres:', '@127.0.0.1:');
}

const pool = new Pool({ connectionString });

async function run() {
  try {
    console.log('=== FINAL PROJECT VERIFICATION ===\n');

    // 1. Sessions
    const sessions = await pool.query('SELECT id, session_id, session_name, status, phone_number FROM sessions');
    console.log('1. SESSIONS:', sessions.rows.length, 'total');
    sessions.rows.forEach(s => console.log(`   - [${s.status}] ${s.session_name} (${s.phone_number})`));

    // 2. Leads
    const leads = await pool.query('SELECT count(*) as total FROM leads');
    console.log('\n2. LEADS:', leads.rows[0].total, 'total');

    // 3. Duplicate check
    const dupes = await pool.query("SELECT phone, count(*) as c FROM leads GROUP BY phone HAVING count(*) > 1");
    console.log('   Duplicate leads by phone:', dupes.rows.length === 0 ? 'NONE ✓' : dupes.rows.length + ' FOUND ✗');

    // 4. Conversations
    const convos = await pool.query('SELECT count(*) as total FROM conversations');
    console.log('\n3. CONVERSATIONS:', convos.rows[0].total, 'total');

    // 5. Messages
    const msgs = await pool.query('SELECT count(*) as total FROM messages');
    console.log('\n4. MESSAGES:', msgs.rows[0].total, 'total');

    // 6. Messages by type
    const msgTypes = await pool.query("SELECT type, count(*) as c FROM messages GROUP BY type ORDER BY c DESC");
    console.log('   By type:');
    msgTypes.rows.forEach(r => console.log(`     - ${r.type}: ${r.c}`));

    // 7. Contacts
    const contacts = await pool.query('SELECT count(*) as total FROM contacts');
    console.log('\n5. CONTACTS:', contacts.rows[0].total, 'total');

    // 8. Recent messages (last 5)
    const recent = await pool.query("SELECT id, direction, type, content, created_at FROM messages ORDER BY created_at DESC LIMIT 5");
    console.log('\n6. RECENT MESSAGES (last 5):');
    recent.rows.forEach(m => {
      const preview = m.content ? m.content.substring(0, 60) : '(no content)';
      console.log(`   - [${m.direction}] ${m.type}: ${preview} (${m.created_at})`);
    });

    console.log('\n=== VERIFICATION COMPLETE ===');

  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
  }
}
run();
