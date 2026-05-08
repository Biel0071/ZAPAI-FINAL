#!/usr/bin/env node

/**
 * ZAPAI - Admin User Seed Script
 * 
 * This script creates or updates the admin user in the database.
 * It uses the credentials from .env.production.
 * 
 * Usage: node scripts/seed-admin.js
 */

require('dotenv').config({ path: '.env.production' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
  console.log('==========================================');
  console.log('ZAPAI ADMIN USER SEED');
  console.log('==========================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(1);
  }

  const adminUsername = process.env.AUTH_DEFAULT_USERNAME || 'admin@admin.com';
  const adminPassword = process.env.AUTH_DEFAULT_PASSWORD || 'admin123';
  const adminTenantId = process.env.AUTH_DEFAULT_TENANT_ID || 'default';
  const adminEmail = process.env.AUTH_DEFAULT_EMAIL || adminUsername;
  const adminRole = process.env.AUTH_DEFAULT_ROLE || 'master_admin';

  console.log('Admin username:', adminUsername);
  console.log('Admin tenant:', adminTenantId);
  console.log('Password will be hashed\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: String(process.env.DB_SSL || '').trim().toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();

    // Check if users table exists, if not create it
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('Creating users table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          tenant_id VARCHAR(100) DEFAULT 'default',
          role VARCHAR(50) DEFAULT 'master_admin',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✓ Users table created');
    }

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    console.log('✓ Password hashed');

    // Upsert admin user
    console.log('Upserting admin user...');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT');
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'master_admin'");
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT false');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'enterprise'");
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_limit INTEGER DEFAULT 999');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()');

    await client.query(`
      INSERT INTO users (username, email, password_hash, tenant_id, role, blocked, is_active, plan, whatsapp_limit, updated_at)
      VALUES ($1, $2, $3, $4, $5, false, true, 'enterprise', 999, NOW())
      ON CONFLICT (username) 
      DO UPDATE SET 
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        tenant_id = EXCLUDED.tenant_id,
        role = EXCLUDED.role,
        blocked = false,
        is_active = EXCLUDED.is_active,
        plan = EXCLUDED.plan,
        whatsapp_limit = EXCLUDED.whatsapp_limit,
        updated_at = NOW()
    `, [adminUsername, adminEmail, passwordHash, adminTenantId, adminRole]);
    console.log('✓ Admin user upserted');

    // Verify admin user
    const result = await client.query(
      'SELECT username, email, tenant_id, role, is_active FROM users WHERE username = $1',
      [adminUsername]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to verify admin user creation');
    }

    const admin = result.rows[0];
    console.log('\nAdmin user verified:');
    console.log(`  Username: ${admin.username}`);
    console.log(`  Email: ${admin.email || adminUsername}`);
    console.log(`  Tenant: ${admin.tenant_id}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  Active: ${admin.is_active}`);

    client.release();

    console.log('\n==========================================');
    console.log('ADMIN USER SEED COMPLETE');
    console.log('==========================================\n');
    console.log('Login credentials:');
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('\n⚠  Keep these credentials secure!\n');

    return { success: true, admin };
  } catch (error) {
    console.error('\n==========================================');
    console.error('ADMIN USER SEED FAILED');
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
  seedAdmin()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { seedAdmin };
