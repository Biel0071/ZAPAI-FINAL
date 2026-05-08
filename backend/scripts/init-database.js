#!/usr/bin/env node

/**
 * ZAPAI - Database Initialization Script
 * 
 * This script initializes the PostgreSQL database and runs migrations.
 * It should be run before starting the backend in production.
 * 
 * Usage: node scripts/init-database.js
 */

require('dotenv').config({ path: '.env.production' });
const { Pool } = require('pg');
const { runMigrations } = require('../services/migrationRunner');

async function initDatabase() {
  console.log('==========================================');
  console.log('ZAPAI DATABASE INITIALIZATION');
  console.log('==========================================\n');

  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set in environment');
    console.error('Please set DATABASE_URL in .env.production');
    process.exit(1);
  }

  console.log('DATABASE_URL configured:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

  // Create pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: String(process.env.DB_SSL || '').trim().toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Test connection
    console.log('\n[1/3] Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✓ Database connected at:', result.rows[0].now);

    // Run migrations
    console.log('\n[2/3] Running migrations...');
    const migrationResult = await runMigrations({ pool });
    console.log('✓ Migrations completed');
    console.log(`  - Total migrations: ${migrationResult.totalMigrations}`);
    console.log(`  - Executed: ${migrationResult.executed.length}`);
    console.log(`  - Pending: ${migrationResult.pendingCount}`);

    // Test read/write
    console.log('\n[3/3] Testing read/write operations...');
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('db_init_test', 'success', NOW())
      ON CONFLICT (key) DO UPDATE SET value = 'success', updated_at = NOW()
    `);
    const testResult = await client.query("SELECT value FROM system_settings WHERE key = 'db_init_test'");
    await client.query('COMMIT');
    console.log('✓ Read/write test passed');
    console.log(`  - Test value: ${testResult.rows[0].value}`);
    client.release();

    console.log('\n==========================================');
    console.log('DATABASE INITIALIZATION COMPLETE');
    console.log('==========================================\n');

    return { success: true, migrationResult };
  } catch (error) {
    console.error('\n==========================================');
    console.error('DATABASE INITIALIZATION FAILED');
    console.error('==========================================\n');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('Database ready for production use.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { initDatabase };
