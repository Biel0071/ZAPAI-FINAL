const { query } = require('../src/infrastructure/config/database');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== CHECKING QUICK REPLIES TABLE ===');
  const qr = await query(`SELECT * FROM quick_replies`);
  for (const r of qr.rows) {
    const s = JSON.stringify(r);
    if (s.toLowerCase().includes('natal') || s.toLowerCase().includes('zaibot') || s.toLowerCase().includes('reserva')) {
      console.log('MATCH in quick_replies:', r);
    }
  }

  console.log('=== CHECKING ALL TABLES FOR "Aproveite a incrível promoção de Natal" OR "ZAIBOT" ===');
  const tables = ['quick_replies', 'messages', 'campaigns', 'company_settings', 'system_settings'];
  for (const t of tables) {
    try {
      const res = await query(`SELECT * FROM ${t} LIMIT 100`);
      for (const row of res.rows) {
        const str = JSON.stringify(row);
        if (str.includes('promoção de Natal') || str.includes('Sou a ZAIBOT')) {
          console.log(`MATCH in table ${t}:`, row);
        }
      }
    } catch (e) {
      // ignore table if not exists
    }
  }

  console.log('=== SCANNING BACKEND SOURCE CODE (EXCLUDING NODE_MODULES) ===');
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist' || ent.name === 'build' || ent.name === 'uploads') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scanDir(full);
      } else if (ent.isFile() && (ent.name.endsWith('.js') || ent.name.endsWith('.ts') || ent.name.endsWith('.json') || ent.name.endsWith('.cjs'))) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('promoção de Natal') || content.includes('Sou a ZAIBOT') || content.includes('natal_promo')) {
            console.log(`MATCH in file: ${full}`);
          }
        } catch (e) {}
      }
    }
  }

  scanDir(path.resolve(__dirname, '..'));

  console.log('Done scanning.');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
