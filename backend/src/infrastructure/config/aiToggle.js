const systemSettingsRepository = require('../../data/repositories/systemSettingsRepository');

const DEFAULT_TENANT_ID = String(process.env.DEFAULT_COMPANY_ID || 'default').trim() || 'default';
const SETTINGS_PREFIX = 'ai_enabled_v2';
const enabledByTenant = new Map();
const hydratedTenants = new Set();
const AUTOMATION_SCOPE_PREFIX = 'ai_automation_scope_v1';
const { getPhoneAliases } = require('../../../services/whatsapp/shared/identifiers');

function requireAutomationTenant(tenantId) {
  if (typeof tenantId !== 'string' || !tenantId.trim() || tenantId.length > 100) {
    throw new Error('Empresa obrigatória para configurar o alcance da IA.');
  }
  return tenantId.trim();
}

function normalizeAutomationPhone(value) {
  if (typeof value !== 'string' || value.length > 40 || !/^[+\d\s().-]+$/.test(value)) {
    throw new Error('Informe telefones válidos com código do país e DDD.');
  }
  let phone = value.replace(/\D/g, '');
  if ((phone.length === 10 || phone.length === 11) && !phone.startsWith('55')) phone = `55${phone}`;
  if (!/^[1-9]\d{9,13}$/.test(phone)) throw new Error('Telefone inválido para o alcance da IA.');
  return phone;
}

async function resolveAutomationPhone({ companyId, sessionId, phone }, dependencies) {
  const raw = phone.trim().toLowerCase();
  if (raw.length > 64 || raw.endsWith('@g.us')) throw new Error('Destinatário inválido.');
  if (/^\d{15}(?:@lid)?$/.test(raw)) {
    const query = dependencies.query || require('./database').query;
    const jid = raw.endsWith('@lid') ? raw : `${raw}@lid`;
    const row = (await query(`SELECT l.phone FROM conversations c
      INNER JOIN leads l ON l.id=c.lead_id AND l.company_id=c.company_id
      WHERE c.company_id=$1 AND c.session_id=$2 AND c.remote_jid=$3 LIMIT 1`, [companyId, sessionId, jid])).rows[0];
    // Use the raw tenant-owned database value; repository/global LID maps cannot prove ownership.
    if (!row?.phone) throw new Error('Telefone deste LID não comprovado na conexão.');
    return normalizeAutomationPhone(row.phone);
  }
  return normalizeAutomationPhone(raw.replace(/@(s\.whatsapp\.net|c\.us)$/, ''));
}

function normalizeAutomationScope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value), 'utf8') > 8192) {
    throw new Error('Alcance da automação inválido ou muito grande.');
  }
  if (value.mode === 'all') return { mode: 'all', sessionId: null, phones: [] };
  if (value.mode !== 'selected' || typeof value.sessionId !== 'string' || !/^[\w.:-]{1,100}$/.test(value.sessionId)
    || !Array.isArray(value.phones) || value.phones.length > 100) {
    throw new Error('Selecione uma conexão e no máximo 100 telefones para o alcance da IA.');
  }
  const phones = [];
  const aliases = new Set();
  for (const rawPhone of value.phones) {
    const phone = normalizeAutomationPhone(rawPhone);
    const candidateAliases = getPhoneAliases(phone);
    if (!candidateAliases.some(alias => aliases.has(alias))) phones.push(phone);
    candidateAliases.forEach(alias => aliases.add(alias));
  }
  return { mode: 'selected', sessionId: value.sessionId, phones };
}

async function getAutomationScope(tenantId) {
  const companyId = requireAutomationTenant(tenantId);
  const setting = await systemSettingsRepository.getSetting(`${AUTOMATION_SCOPE_PREFIX}:${companyId}`);
  if (!setting) return { mode: 'all', sessionId: null, phones: [] };
  return normalizeAutomationScope(JSON.parse(setting.value));
}

async function setAutomationScope(value, tenantId, dependencies = {}) {
  const companyId = requireAutomationTenant(tenantId);
  const scope = normalizeAutomationScope(value);
  if (scope.mode === 'selected') {
    const assertSession = dependencies.assertSession || require('../../../services/aiMemoryEngine').assertSession;
    await assertSession(companyId, scope.sessionId);
  }
  await systemSettingsRepository.setSetting(`${AUTOMATION_SCOPE_PREFIX}:${companyId}`, JSON.stringify(scope));
  return scope;
}

async function getAutomationPermission({ companyId, sessionId, phone } = {}, dependencies = {}) {
  try {
    requireAutomationTenant(companyId);
    if (typeof sessionId !== 'string' || !sessionId.trim() || typeof phone !== 'string' || !phone.trim()) {
      return { allowed: false, reason: 'automation_context_missing' };
    }
    const readGlobal = dependencies.getAIEnabled || getAIEnabled;
    if (!(await readGlobal(companyId))) return { allowed: false, reason: 'global_ai_off' };
    const normalizedPhone = await resolveAutomationPhone({ companyId, sessionId, phone }, dependencies);
    const readScope = dependencies.getAutomationScope || getAutomationScope;
    const scope = normalizeAutomationScope(await readScope(companyId));
    if (scope.mode === 'all') return { allowed: true, reason: 'automation_scope_all' };
    if (scope.sessionId !== sessionId) return { allowed: false, reason: 'automation_session_outside_scope' };
    const aliases = new Set(getPhoneAliases(normalizedPhone));
    const allowed = scope.phones.some(candidate => getPhoneAliases(candidate).some(alias => aliases.has(alias)));
    return { allowed, reason: allowed ? 'automation_scope_selected' : 'automation_phone_outside_scope' };
  } catch (error) {
    return { allowed: false, reason: 'automation_scope_unavailable' };
  }
}

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT_ID).trim() || DEFAULT_TENANT_ID;
}

function settingKey(tenantId) {
  return `${SETTINGS_PREFIX}:${normalizeTenantId(tenantId)}`;
}

function parseBoolean(value) {
  return String(value).toLowerCase() === 'true';
}

async function initAIToggle(tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);

  try {
    let setting = await systemSettingsRepository.getSetting(settingKey(normalizedTenantId));
    if (!setting && normalizedTenantId === DEFAULT_TENANT_ID) {
      setting = await systemSettingsRepository.getSetting('ai_enabled');
    }
    enabledByTenant.set(normalizedTenantId, setting ? parseBoolean(setting.value) : false);
  } catch (error) {
    enabledByTenant.set(normalizedTenantId, false);
    console.warn(`[AI][tenant=${normalizedTenantId}] failed to load persisted toggle:`, error.message || error);
  } finally {
    hydratedTenants.add(normalizedTenantId);
  }

  return enabledByTenant.get(normalizedTenantId) === true;
}

async function getAIEnabled(tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!hydratedTenants.has(normalizedTenantId)) {
    await initAIToggle(normalizedTenantId);
  }
  return enabledByTenant.get(normalizedTenantId) === true;
}

async function setAIEnabled(value, tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const enabled = Boolean(value);

  await systemSettingsRepository.setSetting(settingKey(normalizedTenantId), String(enabled));
  enabledByTenant.set(normalizedTenantId, enabled);
  hydratedTenants.add(normalizedTenantId);

  console.log(enabled ? `[AI][tenant=${normalizedTenantId}] enabled` : `[AI][tenant=${normalizedTenantId}] disabled`);
  return enabled;
}

async function enableAI(tenantId = DEFAULT_TENANT_ID) {
  return setAIEnabled(true, tenantId);
}

async function disableAI(tenantId = DEFAULT_TENANT_ID) {
  return setAIEnabled(false, tenantId);
}

function isAIEnabled(tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  return enabledByTenant.get(normalizedTenantId) === true;
}

module.exports = {
  disableAI,
  enableAI,
  getAIEnabled,
  initAIToggle,
  isAIEnabled,
  normalizeTenantId,
  setAIEnabled,
  getAutomationScope,
  setAutomationScope,
  getAutomationPermission,
  normalizeAutomationScope,
};
