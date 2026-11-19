const fs = require('fs');
try {
  const creds = JSON.parse(fs.readFileSync('/opt/zapai/data/sessions/main/creds.json'));
  console.log('CREDS:', JSON.stringify({ me: creds.me, registered: creds.registered }, null, 2));
} catch (e) {
  console.error(e.message);
}

