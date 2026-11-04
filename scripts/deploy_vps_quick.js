const { execSync } = require('child_process');

console.log('--- DEPLOYING FULL SYSTEM (FRONTEND + PUPPET BACKEND) TO VPS (209.50.241.22) ---');
try {
  console.log('1. Packaging and uploading frontend_code.tar.gz via scp...');
  execSync('tar --exclude="*.png" --exclude="*.jpg" --exclude="*.jpeg" -czf frontend_code.tar.gz -C frontend-official/dist .', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 frontend_code.tar.gz root@209.50.241.22:/tmp/frontend_code.tar.gz', { stdio: 'inherit' });
  
  console.log('2. Unpacking in OpenResty (/www/zapai/ and /etc/icontainer/...)...');
  execSync('ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 root@209.50.241.22 "tar -xzf /tmp/frontend_code.tar.gz -C /www/zapai/ && tar -xzf /tmp/frontend_code.tar.gz -C /etc/icontainer/apps/openresty/openresty/www/zapai/ && rm -f /tmp/frontend_code.tar.gz"', { stdio: 'inherit' });

  console.log('3. Uploading unified backend files...');
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/webbridge/PuppetManipulator.js root@209.50.241.22:/opt/zapai/backend/services/webbridge/PuppetManipulator.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/webbridge/WebBridgeStoreSync.js root@209.50.241.22:/opt/zapai/backend/services/webbridge/WebBridgeStoreSync.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/webbridge/WebBridgeSessionManager.js root@209.50.241.22:/opt/zapai/backend/services/webbridge/WebBridgeSessionManager.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/orchestrator/adapters/WhatsAppWebAdapter.js root@209.50.241.22:/opt/zapai/backend/services/orchestrator/adapters/WhatsAppWebAdapter.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/connectionService.legacy.js root@209.50.241.22:/opt/zapai/backend/services/connectionService.legacy.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/src/api/controllers/webBridgeController.js root@209.50.241.22:/opt/zapai/backend/src/api/controllers/webBridgeController.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/src/api/routes/webBridgeRoutes.js root@209.50.241.22:/opt/zapai/backend/src/api/routes/webBridgeRoutes.js', { stdio: 'inherit' });

  console.log('4. Restarting zapflow-api PM2 process on VPS...');
  execSync('ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 root@209.50.241.22 "pm2 restart zapflow-api"', { stdio: 'inherit' });

  console.log('DEPLOY COMPLETED SUCCESSFULLY!');
  process.exit(0);
} catch (error) {
  console.error('Deploy error:', error.message);
  process.exit(1);
}

