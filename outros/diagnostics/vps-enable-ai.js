const { pool } = require('./backend/src/infrastructure/config/database');
pool.query("UPDATE conversations SET ai_enabled = true WHERE id = 16").then(res => {
  console.log("Updated ai_enabled for conversation 16");
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
