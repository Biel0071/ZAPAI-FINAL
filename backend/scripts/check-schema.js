require('dotenv').config();
const { Pool } = require('pg');
let c = process.env.DATABASE_URL;
if (c) c = c.replace('@postgres:', '@127.0.0.1:');
const p = new Pool({ connectionString: c });
(async () => {
  const r = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='messages' ORDER BY ordinal_position");
  r.rows.forEach(c => console.log(c.column_name, '-', c.data_type));
  console.log('---');
  // Check a recent message raw
  const r2 = await p.query('SELECT * FROM messages ORDER BY id DESC LIMIT 3');
  r2.rows.forEach(m => console.log(JSON.stringify(m)));
  await p.end();
})();
