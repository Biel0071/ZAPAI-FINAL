const { execSync } = require('child_process');
const cmd = "sudo -u postgres psql -d zapai_crm -c 'SELECT id, remote_jid, tags FROM conversations ORDER BY id DESC LIMIT 10;'";
const out = execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "${cmd}"`).toString();
console.log(out);

