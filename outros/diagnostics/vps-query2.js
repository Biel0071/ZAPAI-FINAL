const { pool } = require('./backend/src/infrastructure/config/database');
pool.query("SELECT * FROM messages WHERE phone = '553193807167' ORDER BY created_at DESC LIMIT 1").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
