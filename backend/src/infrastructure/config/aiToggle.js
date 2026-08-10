const systemSettingsRepository = require('../../data/repositories/systemSettingsRepository');

const DEFAULT_TENANT_ID = String(process.env.DEFAULT_COMPANY_ID || 'default').trim() || 'default';
const SETTINGS_PREFIX = 'ai_enabled_v2';
const enabledByTenant = new Map();
const hydratedTenants = new Set();

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
  return enabledByTenant.get(normalizeTenantId(tenantId)) === true;
}

module.exports = {
  disableAI,
  enableAI,
  getAIEnabled,
  initAIToggle,
  isAIEnabled,
  normalizeTenantId,
  setAIEnabled,
};
