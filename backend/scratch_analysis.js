const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });
dotenv.config({ path: path.join(__dirname, '../backend/.env.production.local') });
dotenv.config({ path: path.join(__dirname, '../backend/.env.production') });

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapadmin123@localhost:5432/zapai_crm';
  const pool = new Pool({ connectionString });
  try {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("=== TABLES ===");
    for (let row of tables.rows) {
      console.log(row.table_name);
      const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${row.table_name}'`);
      console.log(cols.rows.map(c => `  - ${c.column_name} (${c.data_type})`).join('\n'));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
