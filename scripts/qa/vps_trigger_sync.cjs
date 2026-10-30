const { execSync } = require('child_process');

const remoteScript = `
const http = require('http');

function req(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    r.on('error', reject);
    if (postData) r.write(postData);
    r.end();
  });
}

async function main() {
  const login = await req('/api/auth/login', 'POST', { username: 'zapadmin', password: 'zapadmin1010' });
  const token = login.token;
  console.log('Login token:', !!token);

  console.log('Calling POST /api/products/sync...');
  const syncRes = await req('/api/products/sync', 'POST', { sessionId: 'main', forceClean: true }, token);
  console.log('Sync response:', JSON.stringify(syncRes, null, 2));

  console.log('Listing products after sync...');
  const prods = await req('/api/products', 'GET', null, token);
  console.log('Total products in database:', Array.isArray(prods?.data) ? prods.data.length : prods);
  if (Array.isArray(prods?.data)) {
    console.table(prods.data.map(p => ({
      name: p.name,
      price: p.price,
      imagesCount: p.images?.length,
      category: p.category
    })));
  }
}

main().catch(console.error);
`;

const b64 = Buffer.from(remoteScript).toString('base64');
const out = execSync(`ssh root@209.50.241.22 "node -e \\"eval(Buffer.from('${b64}', 'base64').toString('utf8'))\\""`);
console.log(out.toString());
