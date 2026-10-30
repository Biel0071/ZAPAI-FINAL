const { execSync } = require('child_process');

console.log('1. Moving backend files into place on VPS...');
execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "cp /tmp/messageRepository.js /opt/zapai/backend/src/data/repositories/messageRepository.js; cp /tmp/shared.js /opt/zapai/backend/src/api/controllers/messages/shared.js; cp /tmp/collectionOps.js /opt/zapai/backend/src/api/controllers/messages/sync/collectionOps.js; cp /tmp/senders.js /opt/zapai/backend/services/whatsapp/outbound/senders.js; pm2 restart zapflow-api"`, { stdio: 'inherit' });

console.log('2. Deploying frontend dist to /www/zapai/ on VPS...');
execSync(`scp -r frontend-official/dist/* root@209.50.241.22:/www/zapai/`, { stdio: 'inherit' });

console.log('3. Restarting nginx / services if needed...');
execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "nginx -s reload || systemctl reload nginx || true"`, { stdio: 'inherit' });

console.log('DEPLOY TO VPS COMPLETED SUCCESSFULLY!');
