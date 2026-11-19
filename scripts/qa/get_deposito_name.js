const { execSync } = require('child_process');

try {
  const out = execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "node -e \\"const { Pool } = require('/opt/zapai/backend/node_modules/pg'); const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' }); pool.query('SELECT conv.id, conv.remote_jid, l.name as lead_name, l.phone as lead_phone FROM conversations conv LEFT JOIN leads l ON l.id = conv.lead_id WHERE conv.id = 12574', function(err, res) { if (err) console.error(err); else console.log(JSON.stringify(res.rows, null, 2)); pool.end(); });\\""`).toString();
  console.log(out);
} catch (e) {
  console.error(e.message);
}
