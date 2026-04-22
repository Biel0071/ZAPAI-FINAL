const fs = require('fs/promises');
const path = require('path');

const MIGRATIONS_TABLE = 'schema_migrations';

function getMigrationsDirectory() {
  return path.join(__dirname, '..', 'migrations');
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version VARCHAR(255) PRIMARY KEY,
      description TEXT,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function loadMigrationFiles(migrationsDir = getMigrationsDirectory()) {
  const files = await fs.readdir(migrationsDir);
  return files
    .filter((name) => name.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

async function getAppliedVersions(client) {
  const result = await client.query(`SELECT version FROM ${MIGRATIONS_TABLE}`);
  return new Set(result.rows.map((row) => String(row.version)));
}

async function runMigrations({ pool, migrationsDir } = {}) {
  if (!pool) {
    throw new Error('Migration runner requires a pg pool.');
  }

  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);

    const files = await loadMigrationFiles(migrationsDir);
    const appliedVersions = await getAppliedVersions(client);
    const executed = [];

    for (const fileName of files) {
      const migrationPath = path.join(migrationsDir || getMigrationsDirectory(), fileName);
      delete require.cache[require.resolve(migrationPath)];
      const migration = require(migrationPath);
      const version = String(migration.version || fileName.replace(/\.js$/, ''));
      const description = migration.description || fileName;

      if (appliedVersions.has(version)) {
        continue;
      }

      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${fileName} does not export an up() function.`);
      }

      await client.query('BEGIN');
      await migration.up(client);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (version, description, applied_at) VALUES ($1, $2, NOW())`,
        [version, description]
      );
      await client.query('COMMIT');

      executed.push({ description, version });
      appliedVersions.add(version);
    }

    const result = await client.query(`SELECT version, description, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY applied_at ASC`);

    return {
      appliedVersions: result.rows,
      executed,
      pendingCount: Math.max(0, files.length - appliedVersions.size),
      totalMigrations: files.length,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors because original failure is more useful.
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  MIGRATIONS_TABLE,
  runMigrations,
};
