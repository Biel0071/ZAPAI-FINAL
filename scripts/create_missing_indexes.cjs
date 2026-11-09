const { execSync } = require('child_process');

function run() {
  const sql = `
  CREATE INDEX IF NOT EXISTS idx_messages_remote_jid_created_at ON messages (remote_jid, created_at DESC);
  `;
  const res = execSync(`ssh root@209.50.241.22 "psql -U postgres -d zapai_crm -c \\"${sql.replace(/\n/g, ' ')}\\""`, { encoding: 'utf8', timeout: 30000 });
  console.log(res);
}
run();
