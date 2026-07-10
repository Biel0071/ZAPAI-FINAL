const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established successfully!');
  conn.exec('cd /opt/zapai && git fetch origin main && git reset --hard origin/main && bash deploy/auto-deploy.sh', (err, stream) => {
    if (err) {
      console.error('Error executing command:', err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log('SSH command finished with exit code: ' + code);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
}).connect({
  host: '209.50.241.22',
  port: 22,
  username: 'root',
  password: 'S53yi4RYq8j4DCGp',
  readyTimeout: 30000
});
