'use strict';

const { query, pool } = require('../../infrastructure/config/database');
const crypto = require('crypto');

const PLATFORM_SCOPE = 'platform';
const COMPANY_SCOPE = 'company';
const ALLOWED_PLACEHOLDERS = new Set([
  'agent.name',
  'agent.role',
  'store.name',
  'store.verifiedFacts',
  'contact.name',
  'contact.phone',
]);

function validateContent(input, { publishing = false } = {}) {
  const promptText = String(input?.promptText || '').trim();
  if (!promptText || promptText.length > 16000) throw new Error('O prompt deve ter entre 1 e 16000 caracteres.');
  const placeholders = [...promptText.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((match) => match[1].trim());
  if (placeholders.some((token) => !ALLOWED_PLACEHOLDERS.has(token))) throw new Error('O template contém um campo dinâmico não permitido.');
  if (/R\$\s*\d|(?:desconto|frete grátis|entrega garantida)\s+\d/iu.test(promptText)) {
    throw new Error('Templates não podem declarar valores comerciais; use fatos verificados da loja.');
  }

  const requiredFields = Array.isArray(input?.requiredFields) ? input.requiredFields : [];
  const unresolvedFacts = Array.isArray(input?.unresolvedFacts) ? input.unresolvedFacts : [];
  const guardrails = Array.isArray(input?.guardrails) ? input.guardrails : [];
  if (requiredFields.length > 40 || unresolvedFacts.length > 40 || guardrails.length > 40) throw new Error('O template excede o limite de campos.');
  const cleanList = (items, label) => items.map((item) => {
    const value = typeof item === 'string' ? item : item?.label;
    const text = String(value || '').trim();
    if (!text || text.length > 240) throw new Error(`${label} inválido.`);
    return typeof item === 'string' ? text : { ...item, label: text };
  });
  if (publishing && unresolvedFacts.length) throw new Error('Resolva ou remova os fatos pendentes antes de publicar.');
  return {
    promptText,
    requiredFields: cleanList(requiredFields, 'Campo obrigatório'),
    unresolvedFacts: cleanList(unresolvedFacts, 'Fato pendente'),
    guardrails: cleanList(guardrails, 'Regra de segurança'),
  };
}

async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function ownerWhere(scope, companyId) {
  return scope === PLATFORM_SCOPE
    ? { sql: "scope='platform' AND company_id IS NULL", params: [] }
    : { sql: "scope='company' AND company_id=$1", params: [companyId] };
}

async function createTemplate({ scope, companyId = null, templateKey, niche, title, description = '', promptText, requiredFields, unresolvedFacts, guardrails, createdBy, sourceTemplateId = null, sourceVersion = null }) {
  if (![PLATFORM_SCOPE, COMPANY_SCOPE].includes(scope)) throw new Error('Escopo de template inválido.');
  if (scope === COMPANY_SCOPE && !companyId) throw new Error('Empresa obrigatória.');
  const key = String(templateKey || '').trim().toLowerCase();
  const cleanNiche = String(niche || '').trim().toLowerCase();
  const cleanTitle = String(title || '').trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,99}$/.test(key)) throw new Error('Chave de template inválida.');
  if (!cleanNiche || cleanNiche.length > 100 || !cleanTitle || cleanTitle.length > 160) throw new Error('Nicho ou título inválido.');
  const content = validateContent({ promptText, requiredFields, unresolvedFacts, guardrails });
  const templateId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  return inTransaction(async (client) => {
    await client.query(
      `INSERT INTO ai_prompt_templates
         (id, scope, company_id, template_key, niche, title, description, source_template_id, source_version, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [templateId, scope, companyId, key, cleanNiche, cleanTitle, String(description).trim().slice(0, 500), sourceTemplateId, sourceVersion, createdBy || null]
    );
    const version = await client.query(
      `INSERT INTO ai_prompt_template_versions
         (id, template_id, scope, company_id, version, status, prompt_text, required_fields, unresolved_facts, guardrails, created_by)
       VALUES ($1,$2,$3,$4,1,'draft',$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)
       RETURNING *`,
      [versionId, templateId, scope, companyId, content.promptText, JSON.stringify(content.requiredFields), JSON.stringify(content.unresolvedFacts), JSON.stringify(content.guardrails), createdBy || null]
    );
    return { id: templateId, scope, companyId, templateKey: key, niche: cleanNiche, title: cleanTitle, description, version: version.rows[0] };
  });
}

async function listAvailable(companyId, { includeDrafts = false, niche = null } = {}) {
  const params = [companyId];
  const visibility = includeDrafts
    ? "(t.scope='platform' AND v.status='published') OR (t.scope='company' AND t.company_id=$1 AND v.version=(SELECT MAX(v2.version) FROM ai_prompt_template_versions v2 WHERE v2.template_id=t.id))"
    : "(t.scope='platform' AND v.status='published') OR (t.scope='company' AND t.company_id=$1 AND v.status='published')";
  let nicheFilter = '';
  if (niche) { params.push(String(niche).trim().toLowerCase()); nicheFilter = `AND t.niche=$${params.length}`; }
  const result = await query(
    `SELECT t.id, t.scope, t.company_id, t.template_key, t.niche, t.title, t.description,
            t.source_template_id, t.source_version, t.updated_at,
            v.id AS version_id, v.version, v.status, v.prompt_text, v.required_fields,
            v.unresolved_facts, v.guardrails, v.published_at
       FROM ai_prompt_templates t
       JOIN ai_prompt_template_versions v ON v.template_id=t.id
      WHERE (${visibility}) AND t.archived_at IS NULL ${nicheFilter}
      ORDER BY t.scope, t.niche, t.title, v.version DESC`,
    params
  );
  return result.rows;
}

async function listPlatform({ limit = 50, offset = 0, niche = null, status = null } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const params = [safeLimit, safeOffset];
  let filters = "t.scope='platform'";
  if (niche) { params.push(String(niche).trim().toLowerCase()); filters += ` AND t.niche=$${params.length}`; }
  if (status && ['draft', 'published', 'archived'].includes(status)) { params.push(status); filters += ` AND v.status=$${params.length}`; }
  const result = await query(
    `SELECT t.id,t.template_key,t.niche,t.title,t.description,t.created_by,t.created_at,t.updated_at,t.archived_at,
            v.id AS version_id,v.version,v.status,v.prompt_text,v.required_fields,v.unresolved_facts,v.guardrails,v.created_by AS version_created_by,v.created_at AS version_created_at,v.published_at
       FROM ai_prompt_templates t JOIN ai_prompt_template_versions v ON v.template_id=t.id
      WHERE ${filters} ORDER BY t.niche,t.title,v.version DESC LIMIT $1 OFFSET $2`,
    params
  );
  return result.rows;
}

async function getOwnedTemplate(scope, companyId, templateId, client = { query }) {
  const owner = ownerWhere(scope, companyId);
  const result = await client.query(
    `SELECT * FROM ai_prompt_templates WHERE id=$${owner.params.length + 1} AND ${owner.sql} FOR UPDATE`,
    [...owner.params, templateId]
  );
  return result.rows[0] || null;
}

async function clonePublishedPlatformTemplate(companyId, sourceTemplateId, createdBy) {
  const source = await query(
    `SELECT t.*,v.version,v.prompt_text,v.required_fields,v.unresolved_facts,v.guardrails
       FROM ai_prompt_templates t JOIN ai_prompt_template_versions v ON v.template_id=t.id
      WHERE t.id=$1 AND t.scope='platform' AND t.archived_at IS NULL AND v.status='published'`,
    [sourceTemplateId]
  );
  if (!source.rows[0]) throw new Error('Versão publicada do template não encontrada.');
  const row = source.rows[0];
  return createTemplate({
    scope: COMPANY_SCOPE, companyId, templateKey: `${row.template_key}-${crypto.randomUUID().slice(0, 8)}`,
    niche: row.niche, title: row.title, description: row.description, promptText: row.prompt_text,
    requiredFields: row.required_fields, unresolvedFacts: row.unresolved_facts, guardrails: row.guardrails,
    createdBy, sourceTemplateId: row.id, sourceVersion: row.version,
  });
}

async function createDraftVersion({ scope, companyId = null, templateId, createdBy }) {
  return inTransaction(async (client) => {
    const template = await getOwnedTemplate(scope, companyId, templateId, client);
    if (!template || template.archived_at) throw new Error('Template não encontrado.');
    const previous = await client.query(
      `SELECT * FROM ai_prompt_template_versions WHERE template_id=$1 ORDER BY version DESC LIMIT 1`, [templateId]
    );
    const prior = previous.rows[0];
    const versionNo = Number(prior?.version || 0) + 1;
    const result = await client.query(
      `INSERT INTO ai_prompt_template_versions
         (id,template_id,scope,company_id,version,status,prompt_text,required_fields,unresolved_facts,guardrails,created_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7::jsonb,$8::jsonb,$9::jsonb,$10) RETURNING *`,
      [crypto.randomUUID(), templateId, scope, companyId, versionNo, prior?.prompt_text || '', JSON.stringify(prior?.required_fields || []), JSON.stringify(prior?.unresolved_facts || []), JSON.stringify(prior?.guardrails || []), createdBy || null]
    );
    return result.rows[0];
  });
}

async function updateDraftVersion({ scope, companyId = null, templateId, versionId, input }) {
  const content = validateContent(input);
  const owner = ownerWhere(scope, companyId);
  const updateOwner = owner.sql.replace(/\bscope\b/g, 't.scope').replace(/\bcompany_id\b/g, 't.company_id');
  const values = [...owner.params, templateId, versionId, content.promptText, JSON.stringify(content.requiredFields), JSON.stringify(content.unresolvedFacts), JSON.stringify(content.guardrails)];
  const result = await query(
    `UPDATE ai_prompt_template_versions v
        SET prompt_text=$${values.length - 3},required_fields=$${values.length - 2}::jsonb,
            unresolved_facts=$${values.length - 1}::jsonb,guardrails=$${values.length}::jsonb
       FROM ai_prompt_templates t
      WHERE v.template_id=t.id AND t.id=$${owner.params.length + 1} AND ${updateOwner}
        AND v.id=$${owner.params.length + 2} AND v.status='draft'
      RETURNING v.*`, values
  );
  if (!result.rows[0]) throw new Error('Rascunho não encontrado ou não editável.');
  return result.rows[0];
}

async function publishVersion({ scope, companyId = null, templateId, versionId }) {
  return inTransaction(async (client) => {
    const template = await getOwnedTemplate(scope, companyId, templateId, client);
    if (!template || template.archived_at) throw new Error('Template não encontrado.');
    const values = scope === PLATFORM_SCOPE ? [templateId, versionId] : [templateId, companyId, versionId];
    const ownerFilter = scope === PLATFORM_SCOPE ? "scope='platform' AND company_id IS NULL" : "scope='company' AND company_id=$2";
    const verIdIndex = values.length;
    const target = await client.query(
      `SELECT * FROM ai_prompt_template_versions WHERE template_id=$1 AND ${ownerFilter} AND id=$${verIdIndex} FOR UPDATE`, values
    );
    const row = target.rows[0];
    if (!row || row.status !== 'draft') throw new Error('Somente rascunhos do template podem ser publicados.');
    validateContent({ promptText: row.prompt_text, requiredFields: row.required_fields, unresolvedFacts: row.unresolved_facts, guardrails: row.guardrails }, { publishing: true });
    await client.query(`UPDATE ai_prompt_template_versions SET status='archived' WHERE template_id=$1 AND status='published'`, [templateId]);
    const published = await client.query(
      `UPDATE ai_prompt_template_versions SET status='published',published_at=NOW() WHERE id=$1 AND template_id=$2 RETURNING *`,
      [versionId, templateId]
    );
    await client.query('UPDATE ai_prompt_templates SET updated_at=NOW() WHERE id=$1', [templateId]);
    return published.rows[0];
  });
}

async function archiveTemplate({ scope, companyId = null, templateId }) {
  return inTransaction(async (client) => {
    const template = await getOwnedTemplate(scope, companyId, templateId, client);
    if (!template) return false;
    await client.query(`UPDATE ai_prompt_template_versions SET status='archived' WHERE template_id=$1`, [templateId]);
    await client.query(`UPDATE ai_prompt_templates SET archived_at=NOW(),updated_at=NOW() WHERE id=$1`, [templateId]);
    return true;
  });
}

async function setStoreTemplate(companyId, storeId, templateId, createdBy) {
  const result = await query(
    `INSERT INTO ai_store_prompt_templates(company_id,store_id,template_id,created_by)
     SELECT s.company_id,s.id,t.id,$4 FROM ai_stores s
     JOIN ai_prompt_templates t ON t.id=$3 AND t.company_id=s.company_id AND t.scope='company' AND t.archived_at IS NULL
     WHERE s.company_id=$1 AND s.id=$2 AND EXISTS (
       SELECT 1 FROM ai_prompt_template_versions v WHERE v.template_id=t.id AND v.status='published'
     )
     ON CONFLICT(company_id,store_id) DO UPDATE SET template_id=EXCLUDED.template_id,created_by=EXCLUDED.created_by,created_at=NOW()
     RETURNING company_id,store_id,template_id`,
    [companyId, storeId, templateId, createdBy || null]
  );
  if (!result.rows[0]) throw new Error('Loja ou template não pertence à empresa.');
  return result.rows[0];
}

async function getStoreTemplate(companyId, storeId) {
  const result = await query(
    `SELECT t.id AS template_id,t.title,t.niche,v.id AS version_id,v.version,v.prompt_text
       FROM ai_store_prompt_templates st
       JOIN ai_prompt_templates t ON t.id=st.template_id AND t.company_id=st.company_id AND t.scope='company' AND t.archived_at IS NULL
       JOIN ai_prompt_template_versions v ON v.template_id=t.id AND v.status='published'
      WHERE st.company_id=$1 AND st.store_id=$2`,
    [companyId, storeId]
  );
  return result.rows[0] || null;
}

module.exports = {
  PLATFORM_SCOPE,
  COMPANY_SCOPE,
  validateContent,
  createTemplate,
  listAvailable,
  listPlatform,
  clonePublishedPlatformTemplate,
  createDraftVersion,
  updateDraftVersion,
  publishVersion,
  archiveTemplate,
  setStoreTemplate,
  getStoreTemplate,
};
