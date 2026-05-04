const SYSTEM_INFO_SQL = `
  CREATE TABLE IF NOT EXISTS system_info (
    id INTEGER PRIMARY KEY DEFAULT 1,
    version VARCHAR(100) NOT NULL DEFAULT '0.0.0',
    last_update TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT system_info_singleton CHECK (id = 1)
  );

  INSERT INTO system_info (id, version, last_update, created_at, updated_at)
  VALUES (1, '0.0.0', NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
`;

module.exports = {
  version: '007_system_info',
  description: 'Create singleton system_info table for app version and deployment timestamps',
  up: async (client) => {
    await client.query(SYSTEM_INFO_SQL);
  },
  down: async () => {},
};
