'use strict';

module.exports = {
  version: '056_versioned_agent_prompt_templates',
  description: 'Add versioned platform and tenant prompt templates with explicit lifecycle',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_prompt_templates (
        id VARCHAR(36) PRIMARY KEY,
        scope VARCHAR(16) NOT NULL CHECK (scope IN ('platform', 'company')),
        company_id VARCHAR(100),
        template_key VARCHAR(100) NOT NULL,
        niche VARCHAR(100) NOT NULL,
        title VARCHAR(160) NOT NULL,
        description VARCHAR(500) NOT NULL DEFAULT '',
        source_template_id VARCHAR(36),
        source_version INTEGER,
        created_by VARCHAR(160),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        archived_at TIMESTAMPTZ,
        CONSTRAINT ck_ai_prompt_template_scope_company CHECK (
          (scope = 'platform' AND company_id IS NULL) OR
          (scope = 'company' AND company_id IS NOT NULL)
        ),
        CONSTRAINT uq_ai_prompt_template_scope_owner UNIQUE (id, scope, company_id),
        CONSTRAINT uq_ai_prompt_template_company_owner UNIQUE (id, company_id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_template_platform_key
        ON ai_prompt_templates(template_key) WHERE scope = 'platform';
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_template_company_key
        ON ai_prompt_templates(company_id, template_key) WHERE scope = 'company';
      CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_company
        ON ai_prompt_templates(company_id, niche, updated_at DESC) WHERE scope = 'company';
      CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_platform
        ON ai_prompt_templates(niche, updated_at DESC) WHERE scope = 'platform';

      CREATE TABLE IF NOT EXISTS ai_prompt_template_versions (
        id VARCHAR(36) PRIMARY KEY,
        template_id VARCHAR(36) NOT NULL,
        scope VARCHAR(16) NOT NULL CHECK (scope IN ('platform', 'company')),
        company_id VARCHAR(100),
        version INTEGER NOT NULL CHECK (version > 0),
        status VARCHAR(16) NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
        prompt_text TEXT NOT NULL,
        required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
        unresolved_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
        guardrails JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by VARCHAR(160),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        published_at TIMESTAMPTZ,
        CONSTRAINT ck_ai_prompt_template_version_scope_company CHECK (
          (scope = 'platform' AND company_id IS NULL) OR
          (scope = 'company' AND company_id IS NOT NULL)
        ),
        CONSTRAINT fk_ai_prompt_template_version_owner
          FOREIGN KEY (template_id, scope, company_id)
          REFERENCES ai_prompt_templates(id, scope, company_id) ON DELETE CASCADE,
        CONSTRAINT fk_ai_prompt_template_version_template
          FOREIGN KEY (template_id) REFERENCES ai_prompt_templates(id) ON DELETE CASCADE,
        CONSTRAINT uq_ai_prompt_template_version UNIQUE (template_id, version)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_template_one_published
        ON ai_prompt_template_versions(template_id) WHERE status = 'published';
      CREATE INDEX IF NOT EXISTS idx_ai_prompt_template_versions_scope
        ON ai_prompt_template_versions(scope, company_id, template_id, version DESC);

      CREATE TABLE IF NOT EXISTS ai_store_prompt_templates (
        company_id VARCHAR(100) NOT NULL,
        store_id TEXT NOT NULL,
        template_id VARCHAR(36) NOT NULL,
        scope VARCHAR(16) NOT NULL DEFAULT 'company' CHECK (scope = 'company'),
        created_by VARCHAR(160),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (company_id, store_id),
        CONSTRAINT fk_ai_store_prompt_template_store
          FOREIGN KEY (company_id, store_id) REFERENCES ai_stores(company_id, id) ON DELETE CASCADE,
        CONSTRAINT fk_ai_store_prompt_template_company_template
          FOREIGN KEY (template_id, scope, company_id) REFERENCES ai_prompt_templates(id, scope, company_id) ON DELETE RESTRICT
      );
    `);
  },
  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS ai_store_prompt_templates;
      DROP TABLE IF EXISTS ai_prompt_template_versions;
      DROP TABLE IF EXISTS ai_prompt_templates;
    `);
  },
};
