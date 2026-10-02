const { spawn } = require('child_process');

const cmd = process.argv.slice(2).join(' ');
if (!cmd) {
  console.error('Usage: node scripts/vps_exec.js <command>');
  process.exit(1);
}

const ssh = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@209.50.241.22', 'bash'], {
  stdio: ['pipe', 'inherit', 'inherit']
});

ssh.stdin.write(cmd + '\n');
ssh.stdin.end();

ssh.on('close', (code) => {
  process.exit(code || 0);
});
