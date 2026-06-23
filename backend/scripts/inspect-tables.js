require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL.replace('@postgres:', '@127.0.0.1:') });

async function inspect() {
  try {
    const table = 'contacts';
    const constraints = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) 
      FROM pg_constraint c 
      JOIN pg_namespace n ON n.oid = c.connamespace 
      WHERE conrelid = '${table}'::regclass
    `);
    console.log(`--- ${table.toUpperCase()} CONSTRAINTS ---`);
    console.log(constraints.rows);

    const indexes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = '${table}'
    `);
    console.log(`--- ${table.toUpperCase()} INDEXES ---`);
    console.log(indexes.rows);

    const leadsConstraints = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) 
      FROM pg_constraint c 
      WHERE conrelid = 'leads'::regclass
    `);
    console.log('--- LEADS CONSTRAINTS ---');
    console.log(leadsConstraints.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
inspect();
