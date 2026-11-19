const { execSync } = require('child_process');

try {
  const nodeScript = `
    const { Pool } = require('/opt/zapai/backend/node_modules/pg');
    const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });
    pool.query("SELECT id, remote_jid, status, lead_temperature, funnel_stage, tags, whatsapp_labels FROM conversations WHERE remote_jid LIKE $1", ['%4998051085%'])
      .then(r => { console.log('CONV:', JSON.stringify(r.rows, null, 2)); pool.end(); })
      .catch(e => { console.error(e); pool.end(); });
  `;
  const b64 = Buffer.from(nodeScript).toString('base64');
  const out = execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "node -e \\"eval(Buffer.from('${b64}', 'base64').toString('utf8'))\\""`, { encoding: 'utf-8' });
  console.log(out);
} catch (err) {
  console.error(err.message);
  if (err.stdout) console.log(err.stdout.toString());
  if (err.stderr) console.error(err.stderr.toString());
}

