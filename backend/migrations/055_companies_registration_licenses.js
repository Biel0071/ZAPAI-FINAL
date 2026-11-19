'use strict';

module.exports = {
  version: '055_companies_registration_licenses',
  description: 'Add canonical companies, approval requests, plans and single-use company licenses while preserving legacy access',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(128) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        responsible_name VARCHAR(160),
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        legacy_access BOOLEAN NOT NULL DEFAULT true,
        zai_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
      INSERT INTO companies (id, name)
      SELECT tenant_id, tenant_id FROM users WHERE tenant_id IS NOT NULL AND tenant_id <> ''
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO companies (id, name)
      SELECT DISTINCT company_id, company_id FROM ai_stores WHERE company_id IS NOT NULL AND company_id <> ''
      ON CONFLICT (id) DO NOTHING;
      DO $$
      DECLARE target_table TEXT;
      BEGIN
        FOREACH target_table IN ARRAY ARRAY['sessions','conversations','messages','contacts','campaigns','digital_attendants'] LOOP
          IF to_regclass(target_table) IS NOT NULL AND EXISTS (
            SELECT 1 FROM information_schema.columns c WHERE c.table_schema = current_schema() AND c.table_name = target_table AND c.column_name IN ('company_id','tenant_id')
          ) THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = current_schema() AND c.table_name = target_table AND c.column_name = 'company_id') THEN
              EXECUTE format('INSERT INTO companies (id, name) SELECT DISTINCT company_id, company_id FROM %I WHERE company_id IS NOT NULL AND company_id <> '''' ON CONFLICT (id) DO NOTHING', target_table);
            ELSE
              EXECUTE format('INSERT INTO companies (id, name) SELECT DISTINCT tenant_id, tenant_id FROM %I WHERE tenant_id IS NOT NULL AND tenant_id <> '''' ON CONFLICT (id) DO NOTHING', target_table);
            END IF;
          END IF;
        END LOOP;
      END $$;

      CREATE TABLE IF NOT EXISTS company_registration_links (
        id BIGSERIAL PRIMARY KEY,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_by VARCHAR(128) NOT NULL,
        used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS company_registration_requests (
        id BIGSERIAL PRIMARY KEY,
        link_id BIGINT NOT NULL REFERENCES company_registration_links(id),
        company_name VARCHAR(200) NOT NULL,
        responsible_name VARCHAR(160) NOT NULL,
        username VARCHAR(80) NOT NULL,
        email VARCHAR(254) NOT NULL,
        password_hash TEXT NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        reviewed_by VARCHAR(128),
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (link_id)
      );
      CREATE INDEX IF NOT EXISTS idx_company_registration_status ON company_registration_requests(status, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_company_registration_username ON company_registration_requests (lower(username)) WHERE status = 'pending';
      CREATE UNIQUE INDEX IF NOT EXISTS uq_company_registration_email ON company_registration_requests (lower(email)) WHERE status = 'pending';

      CREATE TABLE IF NOT EXISTS license_plans (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        modules JSONB NOT NULL DEFAULT '[]'::jsonb,
        number_limit INTEGER NOT NULL DEFAULT 0 CHECK (number_limit >= 0),
        active BOOLEAN NOT NULL DEFAULT true,
        created_by VARCHAR(128) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS company_licenses (
        id BIGSERIAL PRIMARY KEY,
        company_id VARCHAR(128) NOT NULL REFERENCES companies(id),
        plan_id BIGINT NOT NULL REFERENCES license_plans(id),
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ,
        redeemed_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_by VARCHAR(128) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_company_licenses_company ON company_licenses(company_id, redeemed_at, revoked_at);
      CREATE TABLE IF NOT EXISTS user_module_permissions (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module VARCHAR(32) NOT NULL CHECK (module IN ('inbox', 'contacts', 'campaigns')),
        enabled BOOLEAN NOT NULL DEFAULT true,
        updated_by VARCHAR(128) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, module)
      );
      CREATE TABLE IF NOT EXISTS company_migration_reports (
        id BIGSERIAL PRIMARY KEY,
        report JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO company_migration_reports (report) VALUES (
        jsonb_build_object(
          'companies', (SELECT COUNT(*) FROM companies),
          'legacyAccessCompanies', (SELECT COUNT(*) FROM companies WHERE legacy_access = true),
          'usersLinkedByTenantId', (SELECT COUNT(*) FROM users u JOIN companies c ON c.id = u.tenant_id WHERE u.deleted_at IS NULL),
          'storesLinkedByCompanyId', (SELECT COUNT(*) FROM ai_stores s JOIN companies c ON c.id = s.company_id)
        )
      );
    `);
  },
  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS company_licenses;
      DROP TABLE IF EXISTS license_plans;
      DROP TABLE IF EXISTS user_module_permissions;
      DROP TABLE IF EXISTS company_migration_reports;
      DROP TABLE IF EXISTS company_registration_requests;
      DROP TABLE IF EXISTS company_registration_links;
      DROP TABLE IF EXISTS companies;
      ALTER TABLE users DROP COLUMN IF EXISTS is_active;
    `);
  },
};
