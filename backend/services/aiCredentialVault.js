'use strict';

const crypto = require('crypto');
const { query } = require('../src/infrastructure/config/database');

const VAULT_PREFIX = 'enc:v2:';

const PROVIDER_ALIASES = Object.freeze({
  anthropic: 'claude',
  google: 'gemini',
  vps: 'zai',
  vps_engine: 'zai',
  vps_api: 'zai',
  api_platform: 'zai',
  cloudflare_ai: 'cloudflare',
  workers_ai: 'cloudflare',
  laya_studio: 'laya',
  laya_fast_lane: 'laya',
  fastlane: 'laya',
  fast_lane: 'laya',
});

function normalizeProviderId(providerId) {
  const raw = String(providerId || '').trim().toLowerCase();
  if (!raw) return '';
  return PROVIDER_ALIASES[raw] || raw;
}

function normalizeScope(scope) {
  const raw = String(scope || 'company').trim().toLowerCase();
  if (raw === 'master' || raw === 'company' || raw === 'agent') return raw;
  return 'company';
}

function getVaultMasterKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  if (!secret) {
    throw new Error('ENCRYPTION_KEY_MISSING');
  }
  return crypto.createHash('sha256').update(`zai:vault:v2:${secret}`).digest();
}

function getLegacyKey(useFallback = false) {
  const secret = useFallback
    ? (process.env.JWT_SECRET || 'ZAPFLOW_SECURE_SALT_KEY_2026')
    : (process.env.ENCRYPTION_KEY || '');
  return crypto.createHash('sha256').update(secret).digest();
}

function maskSecret(rawKey) {
  const value = String(rawKey || '').trim();
  if (!value) return '';
  if (value.includes('••••') || value.includes('*****')) return value;
  if (value.length <= 8) return '••••••••';
  if (value.startsWith('sk-') && value.length > 11) {
    return `sk-••••${value.slice(-4)}`;
  }
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

function buildAad(scope = 'company', companyId = 'default', agentKey = '', providerId = '') {
  return Buffer.from(
    `${normalizeScope(scope)}:${String(companyId || 'default')}:${String(agentKey || '')}:${normalizeProviderId(providerId)}`,
    'utf8'
  );
}

function encryptSecret(plainText, { scope = 'company', companyId = 'default', agentKey = '', providerId = '' } = {}) {
  const raw = String(plainText || '').trim();
  if (!raw) return '';
  const key = getVaultMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(buildAad(scope, companyId, agentKey, providerId));
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VAULT_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decryptSecret(cipherText, context = {}) {
  const raw = String(cipherText || '').trim();
  if (!raw) return '';

  if (raw.startsWith(VAULT_PREFIX)) {
    const body = raw.slice(VAULT_PREFIX.length);
    const [ivB64, tagB64, dataB64] = body.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('DECRYPTION_FAILED');
    }
    const key = getVaultMasterKey();
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(buildAad(context.scope, context.companyId, context.agentKey, context.providerId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  // Backward compatibility with legacy AES-256-CBC `ivHex:cipherHex`
  if (raw.includes(':')) {
    const parts = raw.split(':');
    const ivHex = parts.shift();
    const cipherHex = parts.join(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedBuf = Buffer.from(cipherHex, 'hex');

    for (const useFallback of [false, true]) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', getLegacyKey(useFallback), iv);
        return Buffer.concat([decipher.update(encryptedBuf), decipher.final()]).toString('utf8');
      } catch {
        // try next legacy key
      }
    }
    throw new Error('DECRYPTION_FAILED');
  }

  // Legacy plaintext fallback only if explicitly migrated or raw test literal
  return raw;
}

function sanitizeActor(actor = {}) {
  return {
    actorId: actor?.id != null ? String(actor.id) : (actor?.sub != null ? String(actor.sub) : 'system'),
    actorName: String(actor?.username || actor?.name || actor?.email || 'system').slice(0, 120),
  };
}

async function recordAuditEvent({ companyId = 'default', scope = 'company', agentKey = null, providerId, action, actor = {}, detail = {} }) {
  try {
    const { actorId, actorName } = sanitizeActor(actor);
    const safeDetail = { ...detail };
    delete safeDetail.apiKey;
    delete safeDetail.api_key;
    delete safeDetail.secret;
    delete safeDetail.encrypted_key;

    await query(
      `INSERT INTO ai_credential_audit_log (
        company_id, scope, agent_key, provider_id, action, actor_id, actor_name, detail, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
      [
        String(companyId || 'default'),
        normalizeScope(scope),
        agentKey ? String(agentKey) : null,
        normalizeProviderId(providerId),
        String(action || 'updated'),
        actorId,
        actorName,
        JSON.stringify(safeDetail),
      ]
    );
  } catch (err) {
    console.warn('[aiCredentialVault] Failed to write credential audit log:', err.message);
  }
}

async function saveCredential({
  scope = 'company',
  companyId = 'default',
  agentKey = '',
  providerId,
  apiKey,
  defaultModel = null,
  label = null,
  enabled = true,
  actor = {},
}) {
  const normScope = normalizeScope(scope);
  const normProvider = normalizeProviderId(providerId);
  const normCompany = normScope === 'master' ? '__master__' : (String(companyId || 'default').trim() || 'default');
  const normAgent = normScope === 'agent' ? String(agentKey || '').trim().toLowerCase() : '';

  if (!normProvider) {
    throw new Error('providerId é obrigatório.');
  }
  if (normScope === 'agent' && !normAgent) {
    throw new Error('agentKey é obrigatório para credencial em escopo de agente.');
  }

  const rawSecret = String(apiKey || '').trim();
  const isMaskedInput = rawSecret.includes('••••') || rawSecret.includes('*****');

  const existingRes = await query(
    `SELECT * FROM ai_provider_credentials
     WHERE scope = $1 AND company_id = $2 AND agent_key = $3 AND provider_id = $4
     LIMIT 1`,
    [normScope, normCompany, normAgent, normProvider]
  );
  const existing = existingRes.rows[0] || null;

  let encryptedKey;
  let keyHint;
  if (!rawSecret || isMaskedInput) {
    if (!existing) {
      throw new Error('API key válida é obrigatória para cadastrar nova credencial.');
    }
    encryptedKey = existing.encrypted_key;
    keyHint = existing.key_hint;
  } else {
    encryptedKey = encryptSecret(rawSecret, {
      scope: normScope,
      companyId: normCompany,
      agentKey: normAgent,
      providerId: normProvider,
    });
    keyHint = maskSecret(rawSecret);
  }

  const { actorName } = sanitizeActor(actor);
  const isRotation = Boolean(existing && rawSecret && !isMaskedInput);
  const action = existing ? (isRotation ? 'rotated' : 'updated') : 'created';

  const res = await query(
    `INSERT INTO ai_provider_credentials (
      scope, company_id, agent_key, provider_id, label, encrypted_key, key_hint,
      default_model, enabled, health_status, created_by, revoked_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unknown', $10, NULL, NOW(), NOW())
    ON CONFLICT (scope, company_id, agent_key, provider_id) DO UPDATE SET
      label = COALESCE(EXCLUDED.label, ai_provider_credentials.label),
      encrypted_key = EXCLUDED.encrypted_key,
      key_hint = EXCLUDED.key_hint,
      default_model = COALESCE(EXCLUDED.default_model, ai_provider_credentials.default_model),
      enabled = EXCLUDED.enabled,
      health_status = CASE WHEN $11 THEN 'unknown' ELSE ai_provider_credentials.health_status END,
      revoked_at = NULL,
      updated_at = NOW()
    RETURNING id, scope, company_id, agent_key, provider_id, label, key_hint, default_model,
              enabled, health_status, last_tested_at, last_latency_ms, last_error, last_used_at,
              created_by, revoked_at, created_at, updated_at`,
    [
      normScope,
      normCompany,
      normAgent,
      normProvider,
      label ? String(label).slice(0, 120) : null,
      encryptedKey,
      keyHint,
      defaultModel ? String(defaultModel).trim() : null,
      enabled !== false,
      actorName,
      isRotation,
    ]
  );

  await recordAuditEvent({
    companyId: normCompany,
    scope: normScope,
    agentKey: normAgent || null,
    providerId: normProvider,
    action,
    actor,
    detail: {
      credentialId: res.rows[0]?.id,
      defaultModel: defaultModel || res.rows[0]?.default_model || null,
      enabled: enabled !== false,
      keyHint,
    },
  });

  return res.rows[0];
}

async function revokeCredential({ id, companyId = 'default', allowMaster = false, actor = {} }) {
  const existingRes = await query(`SELECT * FROM ai_provider_credentials WHERE id = $1 LIMIT 1`, [Number(id)]);
  const row = existingRes.rows[0];
  if (!row) return null;

  if (row.scope === 'master' && !allowMaster) {
    throw new Error('FORBIDDEN_MASTER_CREDENTIAL');
  }
  if (row.scope !== 'master' && String(row.company_id) !== String(companyId) && !allowMaster) {
    throw new Error('FORBIDDEN_TENANT_CREDENTIAL');
  }

  const res = await query(
    `UPDATE ai_provider_credentials
     SET enabled = FALSE, revoked_at = NOW(), health_status = 'revoked', updated_at = NOW()
     WHERE id = $1
     RETURNING id, scope, company_id, agent_key, provider_id, label, key_hint, default_model,
               enabled, health_status, last_tested_at, last_latency_ms, last_used_at, revoked_at, updated_at`,
    [Number(id)]
  );

  await recordAuditEvent({
    companyId: row.company_id,
    scope: row.scope,
    agentKey: row.agent_key || null,
    providerId: row.provider_id,
    action: 'revoked',
    actor,
    detail: { credentialId: row.id, keyHint: row.key_hint },
  });

  return res.rows[0];
}

function getEnvCredentialForProvider(providerId) {
  const p = normalizeProviderId(providerId);
  if (p === 'zai') {
    const key = String(process.env.VPS_AI_API_KEY || process.env.API_PLATFORM_KEY || process.env.GRG_AIPLATFORM_KEY || '').trim();
    return key ? { apiKey: key, source: 'env_master', keyHint: maskSecret(key) } : null;
  }
  const envMap = {
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    cloudflare: process.env.CLOUDFLARE_API_TOKEN,
    ollama: process.env.OLLAMA_API_KEY || '',
  };
  const key = String(envMap[p] || '').trim();
  if (p === 'ollama') {
    return { apiKey: key, source: 'local_runtime', keyHint: key ? maskSecret(key) : 'local' };
  }
  return key ? { apiKey: key, source: 'env_master', keyHint: maskSecret(key) } : null;
}

async function resolveEffectiveCredential({ companyId = 'default', agentKey = '', providerId, allowLegacyProviderKeys = true }) {
  const normProvider = normalizeProviderId(providerId);
  const normCompany = String(companyId || 'default').trim() || 'default';
  const normAgent = String(agentKey || '').trim().toLowerCase();

  // Precedence: 1. Agent -> 2. Company -> 3. Legacy company provider_keys -> 4. Master -> 5. Master env
  const rowsRes = await query(
    `SELECT *
     FROM ai_provider_credentials
     WHERE provider_id = $1
       AND enabled = TRUE
       AND revoked_at IS NULL
       AND (
         (scope = 'agent' AND company_id = $2 AND agent_key = $3)
         OR (scope = 'company' AND company_id = $2 AND agent_key = '')
         OR (scope = 'master' AND company_id = '__master__')
       )`,
    [normProvider, normCompany, normAgent]
  ).catch(() => ({ rows: [] }));

  const priorityOrder = { agent: 1, company: 2, master: 4 };
  const sorted = [...(rowsRes.rows || [])].sort((a, b) => (priorityOrder[a.scope] || 9) - (priorityOrder[b.scope] || 9));

  for (const row of sorted) {
    try {
      const apiKey = decryptSecret(row.encrypted_key, {
        scope: row.scope,
        companyId: row.company_id,
        agentKey: row.agent_key,
        providerId: row.provider_id,
      });
      if (apiKey || normProvider === 'ollama' || normProvider === 'zai') {
        return {
          credentialId: row.id,
          scope: row.scope,
          companyId: row.company_id,
          agentKey: row.agent_key || null,
          providerId: normProvider,
          defaultModel: row.default_model || null,
          apiKey,
          keyHint: row.key_hint || maskSecret(apiKey),
          healthStatus: row.health_status || 'unknown',
          source: `vault_${row.scope}`,
        };
      }
    } catch (err) {
      console.warn(`[aiCredentialVault] Failed to decrypt vault row ${row.id} (${row.scope}/${normProvider}):`, err.message);
    }
  }

  // Legacy company `provider_keys` table fallback (isolated strictly by tenant_id = normCompany)
  if (allowLegacyProviderKeys) {
    const providerVariants = normProvider === 'claude'
      ? ['claude', 'anthropic']
      : normProvider === 'gemini'
        ? ['gemini', 'google']
        : normProvider === 'zai'
          ? ['zai', 'vps_engine', 'vps', 'api_platform']
          : [normProvider];
    const legacyRes = await query(
      `SELECT id, provider, api_key, model, enabled
       FROM provider_keys
       WHERE tenant_id = $1
         AND enabled = TRUE
         AND LOWER(provider) = ANY($2::text[])
       ORDER BY id DESC LIMIT 1`,
      [normCompany, providerVariants]
    ).catch(() => ({ rows: [] }));

    if (legacyRes.rows[0]) {
      const row = legacyRes.rows[0];
      try {
        const apiKey = decryptSecret(row.api_key);
        return {
          credentialId: `legacy:${row.id}`,
          scope: 'company',
          companyId: normCompany,
          agentKey: null,
          providerId: normProvider,
          defaultModel: row.model || null,
          apiKey,
          keyHint: maskSecret(apiKey),
          healthStatus: 'unknown',
          source: 'legacy_provider_keys',
        };
      } catch (err) {
        console.warn(`[aiCredentialVault] Legacy provider_keys decrypt failed for row ${row.id}:`, err.message);
      }
    }
  }

  // Master environment credential (only for ZAI/Ollama infrastructure or Master-configured global providers)
  const envCred = getEnvCredentialForProvider(normProvider);
  if (envCred) {
    return {
      credentialId: null,
      scope: 'master',
      companyId: '__master__',
      agentKey: null,
      providerId: normProvider,
      defaultModel: null,
      apiKey: envCred.apiKey,
      keyHint: envCred.keyHint,
      healthStatus: 'unknown',
      source: envCred.source,
    };
  }

  return null;
}

async function listMaskedCredentials({ companyId = 'default', includeMaster = false } = {}) {
  const normCompany = String(companyId || 'default').trim() || 'default';
  const vaultRes = await query(
    `SELECT id, scope, company_id, agent_key, provider_id, label, key_hint, default_model,
            enabled, health_status, last_tested_at, last_latency_ms, last_error, last_used_at,
            created_by, revoked_at, created_at, updated_at
     FROM ai_provider_credentials
     WHERE ($1::boolean = TRUE AND scope = 'master')
        OR (scope IN ('company', 'agent') AND company_id = $2)
     ORDER BY CASE scope WHEN 'master' THEN 1 WHEN 'company' THEN 2 ELSE 3 END, provider_id ASC, updated_at DESC`,
    [Boolean(includeMaster), normCompany]
  ).catch(() => ({ rows: [] }));

  const legacyRes = await query(
    `SELECT id, tenant_id, provider, api_key, model, enabled, created_at, updated_at
     FROM provider_keys
     WHERE tenant_id = $1
     ORDER BY id DESC`,
    [normCompany]
  ).catch(() => ({ rows: [] }));

  const legacyMapped = (legacyRes.rows || []).map((r) => {
    let hint = '••••';
    try {
      hint = maskSecret(decryptSecret(r.api_key));
    } catch {
      hint = '••••(chave legada)';
    }
    return {
      id: `legacy:${r.id}`,
      scope: 'company',
      company_id: r.tenant_id,
      agent_key: '',
      provider_id: normalizeProviderId(r.provider),
      label: `Chave legada (${r.provider})`,
      key_hint: hint,
      default_model: r.model,
      enabled: r.enabled === true,
      health_status: 'unknown',
      last_tested_at: null,
      last_latency_ms: null,
      last_error: null,
      last_used_at: null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      legacy: true,
    };
  });

  return [...(vaultRes.rows || []), ...legacyMapped];
}

async function listAuditLogs({ companyId = 'default', includeMaster = false, limit = 60 } = {}) {
  const normCompany = String(companyId || 'default').trim() || 'default';
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 60));
  const res = await query(
    `SELECT id, company_id, scope, agent_key, provider_id, action, actor_id, actor_name, detail, created_at
     FROM ai_credential_audit_log
     WHERE ($1::boolean = TRUE AND scope = 'master')
        OR company_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [Boolean(includeMaster), normCompany, safeLimit]
  ).catch(() => ({ rows: [] }));
  return res.rows || [];
}

async function updateCredentialHealth(credentialId, { healthStatus, latencyMs = null, error = null, markUsed = false } = {}) {
  if (!credentialId || String(credentialId).startsWith('legacy:')) return;
  try {
    await query(
      `UPDATE ai_provider_credentials
       SET health_status = COALESCE($2, health_status),
           last_tested_at = CASE WHEN $2 IS NOT NULL THEN NOW() ELSE last_tested_at END,
           last_latency_ms = COALESCE($3, last_latency_ms),
           last_error = $4,
           last_used_at = CASE WHEN $5 THEN NOW() ELSE last_used_at END,
           updated_at = NOW()
       WHERE id = $1`,
      [Number(credentialId), healthStatus || null, latencyMs != null ? Math.round(Number(latencyMs)) : null, error ? String(error).slice(0, 400) : null, Boolean(markUsed)]
    );
  } catch {
    // non-fatal telemetry update
  }
}

module.exports = {
  VAULT_PREFIX,
  normalizeProviderId,
  normalizeScope,
  maskSecret,
  encryptSecret,
  decryptSecret,
  saveCredential,
  revokeCredential,
  resolveEffectiveCredential,
  listMaskedCredentials,
  listAuditLogs,
  recordAuditEvent,
  updateCredentialHealth,
  getEnvCredentialForProvider,
};
