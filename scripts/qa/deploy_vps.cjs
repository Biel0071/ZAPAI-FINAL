const { execSync } = require('child_process');

console.log('1. Deploying backend files to VPS...');
execSync(`scp backend/src/api/controllers/productsController.js root@209.50.241.22:/opt/zapai/backend/src/api/controllers/productsController.js`, { stdio: 'inherit' });

console.log('2. Restarting PM2 zapflow-api...');
execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "pm2 restart zapflow-api"`, { stdio: 'inherit' });

console.log('3. Triggering database sync for all 19 products in PostgreSQL...');
const syncScript = `
const { syncWhatsAppCatalogInternal } = require('/opt/zapai/backend/src/api/controllers/productsController.js');
async function run() {
  const res = await syncWhatsAppCatalogInternal({ companyId: 'default', sessionId: 'main', forceClean: true });
  console.log('Sync result total:', res.total);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
`;
const b64 = Buffer.from(syncScript).toString('base64');
execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "NODE_PATH=/opt/zapai/backend/node_modules node -e \\"eval(Buffer.from('${b64}', 'base64').toString('utf8'))\\""`, { stdio: 'inherit' });

console.log('4. Deploying frontend dist to /www/zapai/ on VPS...');
execSync(`scp -r frontend-official/dist/* root@209.50.241.22:/www/zapai/`, { stdio: 'inherit' });

console.log('DEPLOY TO VPS COMPLETED SUCCESSFULLY!');
