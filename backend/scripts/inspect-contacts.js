require('dotenv').config();
const { Pool } = require('pg');
const connectionString = process.env.DATABASE_URL.replace('@postgres:', '@127.0.0.1:');
const pool = new Pool({ connectionString });

async function inspect() {
  try {
    const contacts = await pool.query(`
      SELECT id, phone, name FROM contacts LIMIT 100
    `);
    console.log('--- CONTACTS ---');
    console.log(contacts.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
inspect();
