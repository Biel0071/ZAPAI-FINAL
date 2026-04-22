const { query } = require('../config/database');

async function getSetting(key) {
  const result = await query(
    `
      SELECT key, value
      FROM system_settings
      WHERE key = $1
      LIMIT 1
    `,
    [key]
  );

  return result.rows[0] || null;
}

async function setSetting(key, value) {
  const result = await query(
    `
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
      RETURNING key, value, updated_at
    `,
    [key, value]
  );

  return result.rows[0] || null;
}

module.exports = {
  getSetting,
  setSetting,
};