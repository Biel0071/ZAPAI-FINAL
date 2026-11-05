const { execSync } = require('child_process');

console.log('--- DEPLOYING FULL SYSTEM (FRONTEND + PUPPET BACKEND) TO VPS (209.50.241.22) ---');
try {
  if (!process.argv.includes('--skip-build')) {
    console.log('0. Compiling fresh production frontend bundle...');
    execSync('npm run build:frontend', { stdio: 'inherit' });
  } else {
    console.log('0. Skipping build as requested (--skip-build)...');
  }

  console.log('1. Packaging and uploading frontend_code.tar.gz via scp...');
  execSync('tar -czf frontend_code.tar.gz -C frontend-official/dist .', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 frontend_code.tar.gz root@209.50.241.22:/tmp/frontend_code.tar.gz', { stdio: 'inherit' });
  
  console.log('2. Unpacking in OpenResty (/www/zapai/ and /etc/icontainer/...)...');
  execSync('ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 root@209.50.241.22 "tar -xzf /tmp/frontend_code.tar.gz -C /www/zapai/ && rm -f /tmp/frontend_code.tar.gz"', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 frontend-official/public/assets/catalog/bloco_10_100un*.png root@209.50.241.22:/www/zapai/assets/catalog/', { stdio: 'inherit' });
  execSync('ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 root@209.50.241.22 "mkdir -p /www/zapai/assets/catalog/real && cp -f /www/zapai/assets/catalog/bloco_10_100un*.png /www/zapai/assets/catalog/real/ 2>/dev/null; mkdir -p /opt/zapai/backend/assets/catalog/real && cp -f /www/zapai/assets/catalog/bloco_10_100un*.png /opt/zapai/backend/assets/catalog/ && cp -f /www/zapai/assets/catalog/bloco_10_100un*.png /opt/zapai/backend/assets/catalog/real/"', { stdio: 'inherit' });

  console.log('3. Uploading unified backend files...');
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/src/data/repositories/productRepository.js root@209.50.241.22:/opt/zapai/backend/src/data/repositories/productRepository.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/commerce/NativeProductSender.js root@209.50.241.22:/opt/zapai/backend/services/commerce/NativeProductSender.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/commerce/CatalogSyncEngine.js root@209.50.241.22:/opt/zapai/backend/services/commerce/CatalogSyncEngine.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/webbridge/WebCatalogExtractor.js root@209.50.241.22:/opt/zapai/backend/services/webbridge/WebCatalogExtractor.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/webbridge/PuppetManipulator.js root@209.50.241.22:/opt/zapai/backend/services/webbridge/PuppetManipulator.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/webbridge/WebBridgeStoreSync.js root@209.50.241.22:/opt/zapai/backend/services/webbridge/WebBridgeStoreSync.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/webbridge/WebBridgeSessionManager.js root@209.50.241.22:/opt/zapai/backend/services/webbridge/WebBridgeSessionManager.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/orchestrator/adapters/WhatsAppWebAdapter.js root@209.50.241.22:/opt/zapai/backend/services/orchestrator/adapters/WhatsAppWebAdapter.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/services/connectionService.legacy.js root@209.50.241.22:/opt/zapai/backend/services/connectionService.legacy.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/src/api/controllers/webBridgeController.js root@209.50.241.22:/opt/zapai/backend/src/api/controllers/webBridgeController.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/src/api/routes/webBridgeRoutes.js root@209.50.241.22:/opt/zapai/backend/src/api/routes/webBridgeRoutes.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/src/api/controllers/productsController.js root@209.50.241.22:/opt/zapai/backend/src/api/controllers/productsController.js', { stdio: 'inherit' });
  execSync('scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 backend/src/api/routes/products.js root@209.50.241.22:/opt/zapai/backend/src/api/routes/products.js', { stdio: 'inherit' });

  console.log('4. Ensuring asset upload directories and restarting zapflow-api PM2 process on VPS...');
  execSync('ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 root@209.50.241.22 "mkdir -p /www/zapai/assets/catalog/uploads /etc/icontainer/apps/openresty/openresty/www/zapai/assets/catalog/uploads && chmod -R 777 /www/zapai/assets/catalog/uploads && pm2 restart zapflow-api"', { stdio: 'inherit' });

  console.log('DEPLOY COMPLETED SUCCESSFULLY!');
  process.exit(0);
} catch (error) {
  console.error('Deploy error:', error.message);
  process.exit(1);
}

