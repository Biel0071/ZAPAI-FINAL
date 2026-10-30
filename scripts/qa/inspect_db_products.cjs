const { execSync } = require('child_process');

const script = `
const db = require('/opt/zapai/backend/src/infrastructure/config/database');
async function run() {
  const res = await db.query('SELECT id, name, price, images FROM products ORDER BY id LIMIT 25;');
  console.log('DB PRODUCTS COUNT:', res.rows.length);
  console.log('PRODUCTS:', JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
`;

const b64 = Buffer.from(script).toString('base64');
execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "NODE_PATH=/opt/zapai/backend/node_modules node -e \\"eval(Buffer.from('${b64}', 'base64').toString('utf8'))\\""`, { stdio: 'inherit' });
