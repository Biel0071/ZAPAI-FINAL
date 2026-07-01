const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.production.local') });
dotenv.config({ path: path.join(__dirname, '.env.production') });

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapadmin123@localhost:5432/zapai_crm';
  const pool = new Pool({ connectionString });
  try {
    console.log('--- CONVERSATIONS BY FUNNEL_STAGE ---');
    const stages = await pool.query("SELECT funnel_stage, COUNT(*) FROM conversations GROUP BY funnel_stage");
    console.table(stages.rows);

    console.log('--- CONVERSATIONS BY LEAD_INTENT ---');
    const intents = await pool.query("SELECT lead_intent, COUNT(*) FROM conversations GROUP BY lead_intent");
    console.table(intents.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
