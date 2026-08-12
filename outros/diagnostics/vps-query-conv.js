const { pool } = require('./backend/src/infrastructure/config/database');
pool.query("SELECT * FROM conversations WHERE id = 16").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
