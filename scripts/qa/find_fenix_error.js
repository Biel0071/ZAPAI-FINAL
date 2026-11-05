const { execSync } = require('child_process');

try {
  const out = execSync('grep -r "Falha interna no FÊNIX" /etc/ /opt/ /var/ /www/ /usr/ 2>/dev/null', { encoding: 'utf8' });
  console.log('Found:\n', out);
} catch (e) {
  console.log('Grep finished with output:\n', e.stdout || e.message);
}
