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
const bcrypt = require('bcrypt');

async function seedAdmin() {
  console.log('==========================================');
  console.log('ZAPAI ADMIN USER SEED');
  console.log('==========================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(1);
  }

  const adminUsername = process.env.AUTH_DEFAULT_USERNAME || 'admin';
  const adminPassword = process.env.AUTH_DEFAULT_PASSWORD || 'admin123';
  const adminTenantId = process.env.AUTH_DEFAULT_TENANT_ID || 'default';

  console.log('Admin username:', adminUsername);
  console.log('Admin tenant:', adminTenantId);
  console.log('Password will be hashed\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
          role VARCHAR(50) DEFAULT 'admin',
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
    await client.query(`
      INSERT INTO users (username, password_hash, tenant_id, role, is_active, updated_at)
      VALUES ($1, $2, $3, 'admin', true, NOW())
      ON CONFLICT (username) 
      DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        tenant_id = EXCLUDED.tenant_id,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `, [adminUsername, passwordHash, adminTenantId]);
    console.log('✓ Admin user upserted');

    // Verify admin user
    const result = await client.query(
      'SELECT username, tenant_id, role, is_active FROM users WHERE username = $1',
      [adminUsername]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to verify admin user creation');
    }

    const admin = result.rows[0];
    console.log('\nAdmin user verified:');
    console.log(`  Username: ${admin.username}`);
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
