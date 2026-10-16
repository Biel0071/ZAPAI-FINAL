const { query } = require('../src/infrastructure/config/database');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== 1. DEACTIVATING/REMOVING ROGUE NATAL QUICK REPLIES ===');
  const deletedQr = await query(`
    DELETE FROM quick_replies 
    WHERE id IN ('87483cf1-66a6-4bb8-ab3c-4950c461de32', 'c21698af-28af-40a8-b33b-a35918c03a18', 'd54a80c4-f270-4017-8bf0-ec42748686f6')
       OR title ILIKE '%NATAL%'
    RETURNING id, title;
  `);
  console.log('Deleted rogue quick replies:', deletedQr.rows);

  console.log('=== 2. FIXING CONVERSATIONS ASSIGNED TO ZAIBOT ===');
  const updatedConvs = await query(`
    UPDATE conversations
    SET agent_name = 'Camila'
    WHERE agent_name ILIKE '%zaibot%'
    RETURNING id;
  `);
  console.log(`Updated ${updatedConvs.rows.length} conversations to Camila.`);

  console.log('=== 3. CLEANING ZAIBOT LEAKS FROM AI MEMORY JSON ===');
  const memoryCandidates = [
    path.join(__dirname, '..', '..', 'storage', 'data', 'ai_memory.json'),
    path.join(__dirname, '..', '..', 'src', 'infrastructure', 'data', 'ai_memory.json'),
    path.join(__dirname, '..', 'data', 'ai_memory.json'),
    '/opt/zapai/backend/data/ai_memory.json',
  ];

  for (const file of memoryCandidates) {
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf8');
        let data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const originalCount = data.length;
          // Filter out entries where AI claimed to be ZAIBOT or sent Christmas promos
          data = data.filter((item) => {
            const resp = String(item.response || '').toLowerCase();
            if (resp.includes('sou a zaibot') || resp.includes('sou o zaibot') || resp.includes('promoção de natal') || resp.includes('promocao de natal')) {
              return false;
            }
            return true;
          });
          fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
          console.log(`Cleaned ${file}: from ${originalCount} to ${data.length} entries.`);
        }
      } catch (e) {
        console.warn(`Could not process ${file}:`, e.message);
      }
    }
  }

  console.log('Done cleaning database and memory.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
