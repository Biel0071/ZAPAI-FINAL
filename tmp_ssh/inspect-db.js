const { query } = require('../backend/config/database');

async function run() {
  console.log('--- INSPECTING SESSIONS IN DATABASE ---');
  try {
    const res = await query(`
      SELECT company_id, session_id, session_name, status, phone_number
      FROM sessions
    `);
    console.log('Sessions found:', res.rows.length);
    for (const row of res.rows) {
      console.log(row);
    }
  } catch (err) {
    console.error('Error during query:', err);
  }
}

run();
