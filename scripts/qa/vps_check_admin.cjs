require('/opt/zapai/backend/node_modules/dotenv').config({ path: '/opt/zapai/backend/.env' });
const { Pool } = require('/opt/zapai/backend/node_modules/pg');
const bcrypt = require('/opt/zapai/backend/node_modules/bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const res = await pool.query('SELECT id, username, email, role, password_hash FROM users');
    console.log('--- USERS IN VPS DATABASE ---');
    console.table(res.rows.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role })));

    const adminUser = res.rows.find(u => u.username === 'admin');
    const zapUser = res.rows.find(u => u.username === 'zapadmin');
    
    const candidates = ['admin', 'admin123', 'admin@123', 'admin2026', 'zapadmin', 'zapadmin1010', '123456', 'zapai', 'masteradmin'];
    if (adminUser) {
      let foundAdmin = null;
      for (const c of candidates) {
        if (await bcrypt.compare(c, adminUser.password_hash || '')) {
          foundAdmin = c;
          break;
        }
      }
      console.log('Admin user password match:', foundAdmin || 'none of the common candidates');
    }

    if (zapUser) {
      const match = await bcrypt.compare('zapadmin1010', zapUser.password_hash || '');
      console.log('zapadmin matches zapadmin1010:', match);
    }

    // Now test API login via HTTP
    const http = require('http');
    const testLogin = (username, password) => new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 4025,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ status: res.statusCode, ok: !!json.token, role: json.user?.role, username: json.user?.username });
          } catch(e) {
            resolve({ status: res.statusCode, raw: data.slice(0, 200) });
          }
        });
      });
      req.write(JSON.stringify({ username, password }));
      req.end();
    });

    console.log('\n--- TESTING /api/auth/login ---');
    console.log('1. Admin by username (admin / admin123):', await testLogin('admin', 'admin123'));
    console.log('2. Admin by email (admin@zapai.com / admin123):', await testLogin('admin@zapai.com', 'admin123'));
    console.log('3. Zapadmin by username (zapadmin / zapadmin1010):', await testLogin('zapadmin', 'zapadmin1010'));

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
