const { execSync } = require('child_process');

try {
  const cmd = 'ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 root@209.50.241.22 "ls -la /www/zapai/assets/catalog"';
  const out = execSync(cmd, { encoding: 'utf8' });
  console.log('VPS /www/zapai/assets/catalog:\n', out);
} catch (e) {
  console.error('Error:', e.message);
}
