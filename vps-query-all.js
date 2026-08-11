const { pool } = require('./backend/src/infrastructure/config/database');
pool.query("SELECT phone, content, created_at, from_me, status FROM messages ORDER BY created_at DESC LIMIT 10").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
