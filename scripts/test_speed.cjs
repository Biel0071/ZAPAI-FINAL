const { execSync } = require('child_process');

function run() {
  const sql = `
  SELECT id, conversation_id, from_me, content, created_at
  FROM messages
  WHERE conversation_id = 17085
  ORDER BY created_at ASC;
  `;
  const res = execSync(`ssh root@209.50.241.22 "psql -U postgres -d zapai_crm -c \\"${sql.replace(/\n/g, ' ')}\\""`, { encoding: 'utf8', timeout: 10000 });
  console.log(res);
}
run();
