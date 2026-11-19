'use strict';

const axios = require('axios');
const { query } = require('../src/infrastructure/config/database');
const credentialVault = require('./aiCredentialVault');
const layaDecisionService = require('./layaDecisionService');
const zaiUsageService = require('./zaiUsageService');

const HEALTH_CACHE = new Map();
const OLLAMA_DISCOVERY_CACHE = { timestamp: 0, models: [], warmModels: [], online: false, error: null, latencyMs: null };
const OLLAMA_TTL_MS = 15 * 1000;
const QUOTA_COOLDOWN_MS = 15 * 60 * 1000;
const TRANSIENT_COOLDOWN_MS = 2 * 60 * 1000;

const ROUTING_MODES = Object.freeze(['AUTO', 'FAST', 'QUALITY', 'LOCAL', 'SPECIFIC']);

const MODEL_PRICING_AND_LIMITS = Object.freeze({
  'qwen2.5:3b': { category: 'local', contextWindow: 32768, maxOutputTokens: 4096, supportsTemperature: true, inputPer1M: 0, outputPer1M: 0, qualityScore: 78, speedScore: 86 },
  'granite3.1-moe:3b': { category: 'local', contextWindow: 131072, maxOutputTokens: 4096, supportsTemperature: true, inputPer1M: 0, outputPer1M: 0, qualityScore: 82, speedScore: 84 },
  'qwen2.5-coder:3b': { category: 'local', contextWindow: 32768, maxOutputTokens: 4096, supportsTemperature: true, inputPer1M: 0, outputPer1M: 0, qualityScore: 76, speedScore: 85 },
  'deepseek-r1:1.5b': { category: 'local', contextWindow: 32768, maxOutputTokens: 4096, supportsTemperature: true, inputPer1M: 0, outputPer1M: 0, qualityScore: 74, speedScore: 88 },
  'qwen3.5:0.8b': { category: 'local', contextWindow: 32768, maxOutputTokens: 2048, supportsTemperature: true, inputPer1M: 0, outputPer1M: 0, qualityScore: 68, speedScore: 95 },
  'qwen2.5:0.5b': { category: 'local', contextWindow: 32768, maxOutputTokens: 2048, supportsTemperature: true, inputPer1M: 0, outputPer1M: 0, qualityScore: 60, speedScore: 98 },
  'llama-3.3-70b-versatile': { category: 'free_tier', contextWindow: 131072, maxOutputTokens: 8192, supportsTemperature: true, inputPer1M: 0.59, outputPer1M: 0.79, qualityScore: 91, speedScore: 97 },
  'llama-3.1-8b-instant': { category: 'free_tier', contextWindow: 131072, maxOutputTokens: 8192, supportsTemperature: true, inputPer1M: 0.05, outputPer1M: 0.08, qualityScore: 79, speedScore: 99 },
  'gpt-4o-mini': { category: 'paid', contextWindow: 128000, maxOutputTokens: 16384, supportsTemperature: true, inputPer1M: 0.15, outputPer1M: 0.60, qualityScore: 89, speedScore: 90 },
  'gpt-4o': { category: 'paid', contextWindow: 128000, maxOutputTokens: 16384, supportsTemperature: true, inputPer1M: 2.50, outputPer1M: 10.00, qualityScore: 96, speedScore: 82 },
  'gpt-4.1-mini': { category: 'paid', contextWindow: 128000, maxOutputTokens: 16384, supportsTemperature: true, inputPer1M: 0.40, outputPer1M: 1.60, qualityScore: 92, speedScore: 89 },
  'gemini-2.5-flash': { category: 'free_tier', contextWindow: 1048576, maxOutputTokens: 8192, supportsTemperature: true, inputPer1M: 0.15, outputPer1M: 0.60, qualityScore: 90, speedScore: 92 },
  'gemini-2.5-pro': { category: 'paid', contextWindow: 1048576, maxOutputTokens: 8192, supportsTemperature: true, inputPer1M: 1.25, outputPer1M: 5.00, qualityScore: 96, speedScore: 80 },
  'claude-3-5-sonnet-20241022': { category: 'paid', contextWindow: 200000, maxOutputTokens: 8192, supportsTemperature: true, inputPer1M: 3.00, outputPer1M: 15.00, qualityScore: 97, speedScore: 84 },
  'claude-3-5-haiku-20241022': { category: 'paid', contextWindow: 200000, maxOutputTokens: 8192, supportsTemperature: true, inputPer1M: 0.80, outputPer1M: 4.00, qualityScore: 86, speedScore: 94 },
  'deepseek-chat': { category: 'paid', contextWindow: 65536, maxOutputTokens: 8192, supportsTemperature: true, inputPer1M: 0.27, outputPer1M: 1.10, qualityScore: 90, speedScore: 85 },
  'meta-llama/llama-3.3-70b-instruct:free': { category: 'free_tier', contextWindow: 131072, maxOutputTokens: 4096, supportsTemperature: true, inputPer1M: 0, outputPer1M: 0, qualityScore: 88, speedScore: 82 },
  '@cf/meta/llama-3.1-8b-instruct': { category: 'free_tier', contextWindow: 8192, maxOutputTokens: 2048, supportsTemperature: true, inputPer1M: 0, outputPer1M: 0, qualityScore: 76, speedScore: 88 },
  // Laya (decisão): custo é por token de entrada em créditos do provedor; não estimado aqui.
  'multilingual': { category: 'decision', contextWindow: 1024, maxOutputTokens: 0, supportsTemperature: false, inputPer1M: 0, outputPer1M: 0, qualityScore: 0, speedScore: 99 },
  'english': { category: 'decision', contextWindow: 512, maxOutputTokens: 0, supportsTemperature: false, inputPer1M: 0, outputPer1M: 0, qualityScore: 0, speedScore: 99 },
  'typed-decisions': { category: 'decision', contextWindow: 1024, maxOutputTokens: 0, supportsTemperature: false, inputPer1M: 0, outputPer1M: 0, qualityScore: 0, speedScore: 99 },
});

const PROVIDER_DEFINITIONS = Object.freeze([
  {
    id: 'zai',
    name: 'PROVEDOR ZAI (Automático Gerenciado)',
    kind: 'managed',
    requiresClientKey: false,
    supportsLocal: true,
    defaultModel: 'qwen2.5:3b',
    models: ['granite3.1-moe:3b', 'qwen2.5:3b', 'qwen3.5:0.8b', 'deepseek-r1:1.5b'],
  },
  {
    id: 'ollama',
    name: 'Ollama Local Runtime',
    kind: 'local',
    requiresClientKey: false,
    supportsLocal: true,
    defaultModel: 'qwen2.5:3b',
    models: [], // Populated live from /api/tags
  },
  {
    id: 'groq',
    name: 'Groq Cloud LPU',
    kind: 'cloud',
    requiresClientKey: true,
    supportsLocal: false,
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    id: 'openai',
    name: 'OpenAI Platform',
    kind: 'cloud',
    requiresClientKey: true,
    supportsLocal: false,
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini API',
    kind: 'cloud',
    requiresClientKey: true,
    supportsLocal: false,
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    kind: 'cloud',
    requiresClientKey: true,
    supportsLocal: false,
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek AI',
    kind: 'cloud',
    requiresClientKey: true,
    supportsLocal: false,
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter Gateway',
    kind: 'cloud',
    requiresClientKey: true,
    supportsLocal: false,
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: ['meta-llama/llama-3.3-70b-instruct:free'],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    kind: 'cloud',
    requiresClientKey: true,
    supportsLocal: false,
    defaultModel: '@cf/meta/llama-3.1-8b-instruct',
    models: ['@cf/meta/llama-3.1-8b-instruct'],
  },
  {
    // Provedor de DECISÃO (triagem fast lane). Não gera texto: nunca entra na cadeia de chat.
    id: 'laya',
    name: 'Laya Fast Lane (Decisão/Triagem)',
    kind: 'decision',
    requiresClientKey: true,
    supportsLocal: false,
    defaultModel: 'multilingual',
    models: ['multilingual', 'english', 'typed-decisions'],
  },
]);

function getOllamaRootUrl() {
  const configured = String(process.env.OLLAMA_BASE_URL || process.env.VPS_AI_BASE_URL || 'http://127.0.0.1:11434/v1').trim();
  return configured.replace(/\/v1\/?$/i, '').replace(/\/+$/, '');
}

function resolveBaseUrl(providerId) {
  const p = credentialVault.normalizeProviderId(providerId);
  if (p === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta/openai';
  if (p === 'groq') return 'https://api.groq.com/openai/v1';
  if (p === 'deepseek') return 'https://api.deepseek.com/v1';
  if (p === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (p === 'claude') return 'https://api.anthropic.com/v1';
  if (p === 'laya') return layaDecisionService.getBaseUrl();
  if (p === 'cloudflare') {
    const acc = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    return acc
      ? `https://api.cloudflare.com/client/v4/accounts/${acc}/ai/v1`
      : (process.env.CLOUDFLARE_AI_BASE_URL || '');
  }
  if (p === 'zai' || p === 'ollama') {
    return String(process.env.OLLAMA_BASE_URL || process.env.VPS_AI_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
  }
  return 'https://api.openai.com/v1';
}

function normalizeRoutingMode(mode) {
  const upper = String(mode || 'AUTO').trim().toUpperCase();
  if (ROUTING_MODES.includes(upper)) return upper;
  if (upper === 'PROVIDER_ESPECIFICO' || upper === 'MANUAL') return 'SPECIFIC';
  return 'AUTO';
}

function getModelMeta(modelId, providerId = '') {
  const known = MODEL_PRICING_AND_LIMITS[String(modelId || '').trim()];
  if (known) return known;
  const isLocal = providerId === 'ollama' || providerId === 'zai';
  return {
    category: isLocal ? 'local' : 'paid',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsTemperature: true,
    inputPer1M: isLocal ? 0 : 0.5,
    outputPer1M: isLocal ? 0 : 1.5,
    qualityScore: 72,
    speedScore: 80,
  };
}

function estimateCostUsd(modelId, promptTokens = 0, completionTokens = 0, providerId = '') {
  const meta = getModelMeta(modelId, providerId);
  const inputCost = (Math.max(0, Number(promptTokens) || 0) / 1_000_000) * (meta.inputPer1M || 0);
  const outputCost = (Math.max(0, Number(completionTokens) || 0) / 1_000_000) * (meta.outputPer1M || 0);
  return Number((inputCost + outputCost).toFixed(6));
}

function getHealthKey(companyId = 'default', providerId, modelId = '') {
  return `${String(companyId || 'default')}:${credentialVault.normalizeProviderId(providerId)}:${String(modelId || '')}`;
}

function recordProviderHealth(companyId, providerId, modelId, { ok, latencyMs = null, error = null, statusCode = null }) {
  const key = getHealthKey(companyId, providerId, modelId);
  const lowerErr = String(error || '').toLowerCase();
  let status = ok ? 'available' : 'unavailable';
  let blockedUntil = 0;

  if (!ok) {
    if (statusCode === 401 || statusCode === 403 || /invalid api key|incorrect api key|unauthorized/.test(lowerErr)) {
      status = 'unauthorized';
      blockedUntil = Date.now() + QUOTA_COOLDOWN_MS;
    } else if (statusCode === 402 || statusCode === 429 || /quota|insufficient|credit|billing/.test(lowerErr)) {
      status = 'quota_exceeded';
      blockedUntil = Date.now() + QUOTA_COOLDOWN_MS;
    } else {
      status = 'degraded';
      blockedUntil = Date.now() + TRANSIENT_COOLDOWN_MS;
    }
  }

  HEALTH_CACHE.set(key, {
    status,
    latencyMs: latencyMs != null ? Math.round(latencyMs) : null,
    error: ok ? null : String(error || '').slice(0, 300),
    blockedUntil,
    lastTestedAt: new Date().toISOString(),
  });
}

function getRecordedHealth(companyId, providerId, modelId = '') {
  const exact = HEALTH_CACHE.get(getHealthKey(companyId, providerId, modelId));
  const generic = HEALTH_CACHE.get(getHealthKey(companyId, providerId, ''));
  const entry = exact || generic || null;
  if (!entry) {
    return { status: 'unknown', blocked: false, latencyMs: null, lastTestedAt: null, error: null };
  }
  const blocked = entry.blockedUntil > Date.now();
  return {
    status: blocked ? entry.status : (entry.status === 'available' ? 'available' : 'unknown'),
    blocked,
    latencyMs: entry.latencyMs,
    lastTestedAt: entry.lastTestedAt,
    error: entry.error,
  };
}

async function discoverOllamaModels({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - OLLAMA_DISCOVERY_CACHE.timestamp < OLLAMA_TTL_MS) {
    return { ...OLLAMA_DISCOVERY_CACHE };
  }

  const rootUrl = getOllamaRootUrl();
  const startedAt = Date.now();
  try {
    const [res, psRes] = await Promise.all([
      axios.get(`${rootUrl}/api/tags`, { timeout: 3500 }),
      axios.get(`${rootUrl}/api/ps`, { timeout: 2000 }).catch(() => ({ data: { models: [] } })),
    ]);
    const rawModels = Array.isArray(res.data?.models) ? res.data.models : [];
    const models = rawModels
      .map((m) => String(m.name || m.model || '').trim())
      .filter((name) => name && !name.includes('minilm') && !name.includes('embed'));
    const rawWarm = Array.isArray(psRes.data?.models) ? psRes.data.models : [];
    const warmModels = rawWarm
      .map((m) => String(m.name || m.model || '').trim())
      .filter((name) => name && !name.includes('minilm') && !name.includes('embed'));
    OLLAMA_DISCOVERY_CACHE.timestamp = now;
    OLLAMA_DISCOVERY_CACHE.models = models;
    OLLAMA_DISCOVERY_CACHE.warmModels = warmModels;
    OLLAMA_DISCOVERY_CACHE.online = true;
    OLLAMA_DISCOVERY_CACHE.error = null;
    OLLAMA_DISCOVERY_CACHE.latencyMs = Date.now() - startedAt;
    recordProviderHealth('__master__', 'ollama', '', { ok: true, latencyMs: OLLAMA_DISCOVERY_CACHE.latencyMs });
    recordProviderHealth('__master__', 'zai', '', { ok: true, latencyMs: OLLAMA_DISCOVERY_CACHE.latencyMs });
  } catch (err) {
    OLLAMA_DISCOVERY_CACHE.timestamp = now;
    OLLAMA_DISCOVERY_CACHE.models = [];
    OLLAMA_DISCOVERY_CACHE.warmModels = [];
    OLLAMA_DISCOVERY_CACHE.online = false;
    OLLAMA_DISCOVERY_CACHE.error = err.message;
    OLLAMA_DISCOVERY_CACHE.latencyMs = Date.now() - startedAt;
    recordProviderHealth('__master__', 'ollama', '', { ok: false, error: err.message });
  }
  return { ...OLLAMA_DISCOVERY_CACHE };
}

async function getRouterPolicy(companyId = 'default') {
  const normCompany = String(companyId || 'default').trim() || 'default';
  try {
    const res = await query(`SELECT * FROM ai_router_policies WHERE company_id = $1 LIMIT 1`, [normCompany]);
    if (res.rows[0]) {
      return {
        companyId: res.rows[0].company_id,
        defaultMode: normalizeRoutingMode(res.rows[0].default_mode),
        fallbackEnabled: res.rows[0].fallback_enabled !== false,
        zaiEnabled: res.rows[0].zai_enabled !== false,
        dailyZaiLimit: Number(res.rows[0].daily_zai_limit || 200),
        preferredProviders: Array.isArray(res.rows[0].preferred_providers) ? res.rows[0].preferred_providers : ['zai', 'groq', 'openai', 'gemini', 'openrouter'],
        updatedBy: res.rows[0].updated_by || null,
        updatedAt: res.rows[0].updated_at || null,
      };
    }
  } catch {
    // table unavailable during bootstrap tests
  }
  return {
    companyId: normCompany,
    defaultMode: 'AUTO',
    fallbackEnabled: true,
    zaiEnabled: true,
    dailyZaiLimit: Number(process.env.ZAI_FREE_DAILY_LIMIT || 200),
    preferredProviders: ['zai', 'groq', 'openai', 'gemini', 'openrouter'],
    updatedBy: null,
    updatedAt: null,
  };
}

async function upsertRouterPolicy(companyId = 'default', patch = {}, actor = {}) {
  const normCompany = String(companyId || 'default').trim() || 'default';
  const current = await getRouterPolicy(normCompany);
  const nextMode = normalizeRoutingMode(patch.defaultMode || current.defaultMode);
  const fallbackEnabled = patch.fallbackEnabled !== undefined ? Boolean(patch.fallbackEnabled) : current.fallbackEnabled;
  const zaiEnabled = patch.zaiEnabled !== undefined ? Boolean(patch.zaiEnabled) : current.zaiEnabled;
  const dailyZaiLimit = patch.dailyZaiLimit !== undefined ? Math.max(0, Number(patch.dailyZaiLimit) || 0) : current.dailyZaiLimit;
  const preferredProviders = Array.isArray(patch.preferredProviders)
    ? patch.preferredProviders.map(credentialVault.normalizeProviderId).filter(Boolean)
    : current.preferredProviders;
  const actorName = String(actor?.username || actor?.name || 'system');

  const res = await query(
    `INSERT INTO ai_router_policies (
      company_id, default_mode, fallback_enabled, zai_enabled, daily_zai_limit, preferred_providers, updated_by, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
    ON CONFLICT (company_id) DO UPDATE SET
      default_mode = EXCLUDED.default_mode,
      fallback_enabled = EXCLUDED.fallback_enabled,
      zai_enabled = EXCLUDED.zai_enabled,
      daily_zai_limit = EXCLUDED.daily_zai_limit,
      preferred_providers = EXCLUDED.preferred_providers,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *`,
    [normCompany, nextMode, fallbackEnabled, zaiEnabled, dailyZaiLimit, JSON.stringify(preferredProviders), actorName]
  );

  return {
    companyId: res.rows[0].company_id,
    defaultMode: res.rows[0].default_mode,
    fallbackEnabled: res.rows[0].fallback_enabled,
    zaiEnabled: res.rows[0].zai_enabled,
    dailyZaiLimit: res.rows[0].daily_zai_limit,
    preferredProviders: res.rows[0].preferred_providers,
    updatedBy: res.rows[0].updated_by,
    updatedAt: res.rows[0].updated_at,
  };
}

async function getProviderCatalog({ companyId = 'default', agentKey = '', includeMaster = false, forceDiscovery = false } = {}) {
  const [ollamaInfo, policy, credentials] = await Promise.all([
    discoverOllamaModels({ force: forceDiscovery }),
    getRouterPolicy(companyId),
    credentialVault.listMaskedCredentials({ companyId, includeMaster }),
  ]);

  const installedSet = new Set(ollamaInfo.models);
  const providers = [];

  for (const def of PROVIDER_DEFINITIONS) {
    const providerCred = await credentialVault.resolveEffectiveCredential({
      companyId,
      agentKey,
      providerId: def.id,
    });

    const isLocalGroup = def.id === 'ollama' || def.id === 'zai';
    const rawModels = def.id === 'ollama'
      ? ollamaInfo.models
      : (def.id === 'zai'
        ? (ollamaInfo.models.length > 0 ? [...new Set(['granite3.1-moe:3b', 'qwen2.5:3b', ...ollamaInfo.models])] : def.models)
        : def.models);

    const hasConfiguredCredential = def.id === 'zai'
      ? (policy.zaiEnabled && (ollamaInfo.online || Boolean(providerCred?.apiKey)))
      : (def.id === 'ollama' ? ollamaInfo.online : Boolean(providerCred?.apiKey));

    const models = rawModels.map((modelId) => {
      const meta = getModelMeta(modelId, def.id);
      const localInstalled = !isLocalGroup || installedSet.size === 0 ? true : installedSet.has(modelId);
      const health = getRecordedHealth(companyId, def.id, modelId);
      const masterHealth = getRecordedHealth('__master__', def.id, modelId);
      const resolvedHealth = health.status !== 'unknown' ? health : masterHealth;

      const available = isLocalGroup
        ? (ollamaInfo.online && localInstalled && !resolvedHealth.blocked && (def.id !== 'zai' || policy.zaiEnabled))
        : (hasConfiguredCredential && !resolvedHealth.blocked);

      return {
        id: modelId,
        providerId: def.id,
        category: meta.category,
        available,
        active: available && (providerCred?.defaultModel === modelId || def.defaultModel === modelId),
        isDefault: def.defaultModel === modelId,
        requiresKey: def.requiresClientKey,
        localInstalled: isLocalGroup ? installedSet.has(modelId) : false,
        contextWindow: meta.contextWindow,
        maxOutputTokens: meta.maxOutputTokens,
        supportsTemperature: meta.supportsTemperature,
        inputCostPer1M: meta.inputPer1M,
        outputCostPer1M: meta.outputPer1M,
        qualityScore: meta.qualityScore,
        speedScore: meta.speedScore,
        healthStatus: available ? (resolvedHealth.status === 'unknown' ? 'available' : resolvedHealth.status) : (resolvedHealth.blocked ? resolvedHealth.status : 'unavailable'),
        latencyMs: resolvedHealth.latencyMs || (isLocalGroup ? ollamaInfo.latencyMs : null),
        lastTestedAt: resolvedHealth.lastTestedAt,
        lastError: resolvedHealth.error,
      };
    });

    const activeAvailable = models.some((m) => m.available);
    const maskedMatch = credentials.find((c) => c.provider_id === def.id && c.enabled);

    providers.push({
      id: def.id,
      name: def.name,
      kind: def.kind,
      requiresClientKey: def.requiresClientKey,
      hasCredential: hasConfiguredCredential,
      credentialScope: providerCred?.scope || (def.id === 'zai' ? 'master' : null),
      credentialHint: maskedMatch?.key_hint || providerCred?.keyHint || null,
      defaultModel: providerCred?.defaultModel || def.defaultModel,
      healthStatus: activeAvailable ? 'healthy' : (hasConfiguredCredential ? 'degraded' : 'unconfigured'),
      latencyMs: isLocalGroup ? ollamaInfo.latencyMs : (maskedMatch?.last_latency_ms || null),
      lastTestedAt: maskedMatch?.last_tested_at || null,
      models,
    });
  }

  return {
    companyId,
    routingModes: ROUTING_MODES,
    policy,
    ollama: {
      online: ollamaInfo.online,
      installedCount: ollamaInfo.models.length,
      installedModels: ollamaInfo.models,
      warmModels: ollamaInfo.warmModels || [],
      latencyMs: ollamaInfo.latencyMs,
      error: ollamaInfo.error,
    },
    providers,
    credentials,
  };
}

async function selectExecutionCandidates({
  companyId = 'default',
  agentKey = '',
  routingMode = 'AUTO',
  providerId = '',
  modelId = '',
} = {}) {
  const mode = normalizeRoutingMode(routingMode);
  const catalog = await getProviderCatalog({ companyId, agentKey, includeMaster: true });
  const requestedProvider = credentialVault.normalizeProviderId(providerId);
  const requestedModel = String(modelId || '').trim();

  const poolCandidates = [];
  for (const prov of catalog.providers) {
    if (prov.kind === 'decision') continue; // Laya decide/classifica; não gera resposta de chat.
    if (mode === 'LOCAL' && prov.id !== 'ollama' && prov.id !== 'zai') continue;
    if (!prov.hasCredential && prov.id !== 'zai') continue;

    const cred = await credentialVault.resolveEffectiveCredential({
      companyId,
      agentKey,
      providerId: prov.id,
    });
    if (!cred && prov.id !== 'zai') continue;

    const availableModels = prov.models.filter((m) => m.available);
    const selectedModels = availableModels.length > 0
      ? availableModels
      : (prov.id === 'zai' && catalog.ollama.installedModels[0] ? [{ ...getModelMeta(catalog.ollama.installedModels[0], 'zai'), id: catalog.ollama.installedModels[0], available: true }] : []);

    for (const m of selectedModels) {
      poolCandidates.push({
        providerId: prov.id,
        modelId: m.id,
        apiKey: cred?.apiKey || '',
        credentialId: cred?.credentialId || null,
        credentialScope: cred?.scope || (prov.id === 'zai' ? 'master' : 'company'),
        baseUrl: resolveBaseUrl(prov.id),
        category: m.category,
        qualityScore: m.qualityScore || 75,
        speedScore: m.speedScore || 80,
        latencyMs: m.latencyMs || 9999,
      });
    }
  }

  // SPECIFIC honors requested provider+model first, even if cooldown wasn't cleared yet
  if (mode === 'SPECIFIC' && requestedProvider) {
    const specificCred = await credentialVault.resolveEffectiveCredential({
      companyId,
      agentKey,
      providerId: requestedProvider,
    });
    const resolvedModel = (!requestedModel || requestedModel === 'auto')
      ? (specificCred?.defaultModel || PROVIDER_DEFINITIONS.find((p) => p.id === requestedProvider)?.defaultModel || 'qwen2.5:3b')
      : requestedModel;

    const primarySpecific = {
      providerId: requestedProvider,
      modelId: resolvedModel,
      apiKey: specificCred?.apiKey || '',
      credentialId: specificCred?.credentialId || null,
      credentialScope: specificCred?.scope || (requestedProvider === 'zai' ? 'master' : 'company'),
      baseUrl: resolveBaseUrl(requestedProvider),
      isPrimaryRequest: true,
    };

    const rest = poolCandidates.filter(
      (c) => !(c.providerId === primarySpecific.providerId && c.modelId === primarySpecific.modelId)
    );
    return catalog.policy.fallbackEnabled ? [primarySpecific, ...rest] : [primarySpecific];
  }

  const warmSet = new Set(catalog.ollama?.warmModels || []);
  poolCandidates.sort((a, b) => {
    const aIsLocal = a.providerId === 'zai' || a.providerId === 'ollama';
    const bIsLocal = b.providerId === 'zai' || b.providerId === 'ollama';
    const aWarm = aIsLocal && warmSet.has(a.modelId) ? 1 : 0;
    const bWarm = bIsLocal && warmSet.has(b.modelId) ? 1 : 0;

    if (mode === 'FAST') {
      if (aWarm !== bWarm) return bWarm - aWarm;
      return (b.speedScore - a.speedScore) || (a.latencyMs - b.latencyMs);
    }
    if (mode === 'QUALITY') {
      return (b.qualityScore - a.qualityScore) || (a.latencyMs - b.latencyMs);
    }
    if (mode === 'LOCAL') {
      if (aWarm !== bWarm) return bWarm - aWarm;
      const aLocal = a.providerId === 'ollama' ? 0 : 1;
      const bLocal = b.providerId === 'ollama' ? 0 : 1;
      return (aLocal - bLocal) || (b.qualityScore - a.qualityScore);
    }
    // AUTO: balance tier (warm RAM-resident Ollama > managed ZAI > local > free tier > paid), preference bonus, then quality
    const tierScore = (item) => {
      const isLocalItem = item.providerId === 'zai' || item.providerId === 'ollama';
      let score = 30;
      if (item.providerId === 'zai' && item.modelId === 'qwen2.5:3b') score = 10;
      else if (item.providerId === 'zai') score = 12;
      else if (item.providerId === 'ollama') score = 15;
      else if (item.category === 'free_tier') score = 20;

      if (isLocalItem && warmSet.has(item.modelId)) {
        score -= 6;
      } else if (isLocalItem && warmSet.size === 0 && (item.modelId === 'qwen2.5:0.5b' || item.modelId === 'granite3.1-moe:3b')) {
        score -= 2;
      }
      if (isLocalItem && /deepseek-r1|qwen3\.5/i.test(item.modelId) && item.modelId !== requestedModel) {
        score += 6;
      }

      if (requestedProvider && item.providerId === requestedProvider) {
        score -= (requestedModel && requestedModel !== 'auto' && item.modelId === requestedModel) ? 8 : 5;
      }
      return score;
    };
    const diffTier = tierScore(a) - tierScore(b);
    if (diffTier !== 0) return diffTier;
    return b.qualityScore - a.qualityScore;
  });

  // Ensure ZAI local default is always included as final safe fallback unless mode === 'LOCAL' with Ollama offline
  if (poolCandidates.length === 0 && mode !== 'LOCAL' && catalog.policy.zaiEnabled) {
    const zaiCred = await credentialVault.resolveEffectiveCredential({ companyId, agentKey, providerId: 'zai' });
    poolCandidates.push({
      providerId: 'zai',
      modelId: catalog.ollama.installedModels[0] || 'qwen2.5:3b',
      apiKey: zaiCred?.apiKey || '',
      credentialId: zaiCred?.credentialId || null,
      credentialScope: 'master',
      baseUrl: resolveBaseUrl('zai'),
    });
  }

  return poolCandidates;
}

async function callSingleCandidate(candidate, { systemPrompt, messages, temperature, maxTokens, timeoutMs = 45000 }) {
  const startedAt = Date.now();
  const modelMeta = getModelMeta(candidate.modelId, candidate.providerId);
  const warnings = [];

  let safeMaxTokens = Math.max(32, Math.min(Number(maxTokens) || 600, modelMeta.maxOutputTokens || 4096));
  if (Number(maxTokens) > (modelMeta.maxOutputTokens || 4096)) {
    warnings.push(`max_tokens ajustado para limite do modelo ${candidate.modelId}: ${safeMaxTokens}`);
  }

  let safeTemp = Number.isFinite(Number(temperature)) ? Number(temperature) : 0.7;
  if (!modelMeta.supportsTemperature) {
    warnings.push(`O modelo ${candidate.modelId} não suporta controle de temperatura; parâmetro omitido.`);
  } else if (safeTemp < 0 || safeTemp > 1.5) {
    safeTemp = Math.min(1.5, Math.max(0, safeTemp));
    warnings.push(`Temperatura ajustada ao intervalo suportado (${safeTemp}).`);
  }

  if (candidate.providerId === 'claude') {
    const nonSystem = (messages || []).filter((m) => m.role === 'user' || m.role === 'assistant');
    const res = await axios.post(
      `${candidate.baseUrl}/messages`,
      {
        model: candidate.modelId,
        max_tokens: safeMaxTokens,
        ...(modelMeta.supportsTemperature ? { temperature: safeTemp } : {}),
        system: systemPrompt,
        messages: nonSystem,
      },
      {
        headers: {
          'x-api-key': candidate.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: timeoutMs,
      }
    );
    const reply = String(res.data?.content?.[0]?.text || '').trim();
    const promptTokens = Number(res.data?.usage?.input_tokens || 0);
    const completionTokens = Number(res.data?.usage?.output_tokens || 0);
    const totalTokens = promptTokens + completionTokens;
    return {
      reply,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs: Date.now() - startedAt,
      warnings,
      effectiveTemperature: modelMeta.supportsTemperature ? safeTemp : null,
      effectiveMaxTokens: safeMaxTokens,
    };
  }

  if (!candidate.baseUrl) {
    throw new Error(`Endpoint não configurado para o provedor ${candidate.providerId}`);
  }

  const chatMessages = messages?.[0]?.role === 'system'
    ? messages
    : [{ role: 'system', content: systemPrompt }, ...(messages || [])];

  if (candidate.providerId === 'zai' || candidate.providerId === 'ollama') {
    const rootUrl = getOllamaRootUrl();
    try {
      const nativeRes = await axios.post(
        `${rootUrl}/api/chat`,
        {
          model: candidate.modelId,
          messages: chatMessages,
          stream: false,
          think: false,
          keep_alive: '30m',
          options: {
            num_thread: 1,
            num_ctx: 1024,
            num_predict: safeMaxTokens,
            ...(modelMeta.supportsTemperature ? { temperature: safeTemp } : {}),
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(candidate.apiKey ? { Authorization: `Bearer ${candidate.apiKey}` } : {}),
          },
          timeout: timeoutMs,
        }
      );
      const reply = String(nativeRes.data?.message?.content || nativeRes.data?.response || '').trim();
      const promptTokens = Number(nativeRes.data?.prompt_eval_count || 0);
      const completionTokens = Number(nativeRes.data?.eval_count || 0);
      const totalTokens = promptTokens + completionTokens;
      return {
        reply,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - startedAt,
        warnings,
        effectiveTemperature: modelMeta.supportsTemperature ? safeTemp : null,
        effectiveMaxTokens: safeMaxTokens,
      };
    } catch (nativeErr) {
      if (nativeErr?.response?.status !== 404) {
        throw nativeErr;
      }
      // If OLLAMA_BASE_URL points to an OpenAI-compatible gateway without /api/chat, fall back to /chat/completions
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (candidate.apiKey) {
    headers.Authorization = `Bearer ${candidate.apiKey}`;
  }

  const res = await axios.post(
    `${candidate.baseUrl}/chat/completions`,
    {
      model: candidate.modelId,
      messages: chatMessages,
      ...(modelMeta.supportsTemperature ? { temperature: safeTemp } : {}),
      max_tokens: safeMaxTokens,
    },
    { headers, timeout: timeoutMs }
  );

  const reply = String(res.data?.choices?.[0]?.message?.content || '').trim();
  const promptTokens = Number(res.data?.usage?.prompt_tokens || 0);
  const completionTokens = Number(res.data?.usage?.completion_tokens || 0);
  const totalTokens = Number(res.data?.usage?.total_tokens || (promptTokens + completionTokens));

  return {
    reply,
    promptTokens,
    completionTokens,
    totalTokens,
    latencyMs: Date.now() - startedAt,
    warnings,
    effectiveTemperature: modelMeta.supportsTemperature ? safeTemp : null,
    effectiveMaxTokens: safeMaxTokens,
  };
}

async function executeChatCompletion({
  companyId = 'default',
  agentKey = '',
  userId = 'default',
  role = 'user',
  routingMode = 'AUTO',
  providerId = '',
  modelId = '',
  systemPrompt = '',
  messages = [],
  temperature = 0.7,
  maxTokens = 600,
  timeoutMs = 45000,
  dryRun = false,
} = {}) {
  const mode = normalizeRoutingMode(routingMode);
  const candidates = await selectExecutionCandidates({
    companyId,
    agentKey,
    routingMode: mode,
    providerId,
    modelId,
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      error: 'Nenhum provedor ou modelo disponível para o modo selecionado.',
      routingMode: mode,
      attempts: [],
    };
  }

  const attempts = [];
  const deadLocalOrigins = new Set();
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const isLocalCandidate = candidate.providerId === 'zai' || candidate.providerId === 'ollama';
    if (isLocalCandidate && deadLocalOrigins.has(getOllamaRootUrl())) {
      attempts.push({ providerId: candidate.providerId, modelId: candidate.modelId, ok: false, error: 'Ollama local indisponível/timeout anterior' });
      continue;
    }
    if (!isLocalCandidate && !candidate.apiKey) {
      attempts.push({ providerId: candidate.providerId, modelId: candidate.modelId, ok: false, error: 'API key ausente' });
      continue;
    }

    if (candidate.providerId === 'zai' && !dryRun) {
      const quotaRes = await zaiUsageService.consumeUsage({ companyId, userId, role }).catch(() => ({ ok: true }));
      if (quotaRes && quotaRes.ok === false) {
        attempts.push({ providerId: candidate.providerId, modelId: candidate.modelId, ok: false, error: quotaRes.error });
        continue;
      }
    }

    try {
      let res = await callSingleCandidate(candidate, {
        systemPrompt,
        messages,
        temperature,
        maxTokens,
        timeoutMs,
      });
      if (!res.reply) {
        // Retry once with gentle sampling floor before marking candidate as empty
        res = await callSingleCandidate(candidate, {
          systemPrompt,
          messages,
          temperature: Math.max(0.4, Number(temperature) || 0.4),
          maxTokens: Math.max(64, Number(maxTokens) || 64),
          timeoutMs,
        });
      }
      if (!res.reply) {
        const emptyErr = new Error('Resposta vazia retornada pelo modelo');
        emptyErr.isEmptyReply = true;
        throw emptyErr;
      }

      let promptTokens = res.promptTokens;
      let completionTokens = res.completionTokens;
      let totalTokens = res.totalTokens;
      if (totalTokens === 0) {
        promptTokens = Math.ceil((String(systemPrompt).length + JSON.stringify(messages).length) / 4);
        completionTokens = Math.ceil(res.reply.length / 4);
        totalTokens = promptTokens + completionTokens;
      }

      const estimatedCostUsd = estimateCostUsd(candidate.modelId, promptTokens, completionTokens, candidate.providerId);
      recordProviderHealth(companyId, candidate.providerId, candidate.modelId, { ok: true, latencyMs: res.latencyMs });
      if (candidate.credentialId) {
        await credentialVault.updateCredentialHealth(candidate.credentialId, {
          healthStatus: 'healthy',
          latencyMs: res.latencyMs,
          markUsed: true,
        });
      }

      return {
        ok: true,
        reply: res.reply,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        routingMode: mode,
        credentialScope: candidate.credentialScope,
        latencyMs: res.latencyMs,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        fallbackActivated: i > 0,
        parameterWarnings: res.warnings,
        effectiveTemperature: res.effectiveTemperature,
        effectiveMaxTokens: res.effectiveMaxTokens,
        attempts: [...attempts, { providerId: candidate.providerId, modelId: candidate.modelId, ok: true, latencyMs: res.latencyMs }],
      };
    } catch (err) {
      const statusCode = err?.response?.status || null;
      const errCode = String(err?.code || '').toUpperCase();
      const errMsg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Erro de provedor';
      const isTransportFailure =
        !err?.isEmptyReply &&
        (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND'].includes(errCode) ||
          statusCode >= 502 ||
          statusCode === 499);
      if (isLocalCandidate && isTransportFailure) {
        deadLocalOrigins.add(getOllamaRootUrl());
      }
      recordProviderHealth(companyId, candidate.providerId, candidate.modelId, {
        ok: false,
        error: errMsg,
        statusCode,
      });
      if (candidate.credentialId) {
        await credentialVault.updateCredentialHealth(candidate.credentialId, {
          healthStatus: statusCode === 429 || statusCode === 402 ? 'quota_exceeded' : 'degraded',
          error: errMsg,
        });
      }
      attempts.push({
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        ok: false,
        statusCode,
        error: errMsg,
      });
    }
  }

  return {
    ok: false,
    error: attempts[attempts.length - 1]?.error || 'Todos os candidatos do Model Router falharam.',
    routingMode: mode,
    attempts,
  };
}

async function probeProvider({ providerId, modelId = '', apiKey = '', scope = 'company', companyId = 'default', agentKey = '', credentialId = null, actor = {} }) {
  const normProvider = credentialVault.normalizeProviderId(providerId);
  let resolvedKey = String(apiKey || '').trim();
  let targetCredId = credentialId;

  if (!resolvedKey || resolvedKey.includes('••••') || resolvedKey.includes('*****')) {
    const resolved = await credentialVault.resolveEffectiveCredential({ companyId, agentKey, providerId: normProvider });
    resolvedKey = resolved?.apiKey || '';
    targetCredId = targetCredId || resolved?.credentialId || null;
  }

  if (normProvider === 'zai' || normProvider === 'ollama') {
    await discoverOllamaModels({ force: true });
  }

  const def = PROVIDER_DEFINITIONS.find((p) => p.id === normProvider);
  const chosenModel = String(modelId || '').trim() || (def?.id === 'ollama' ? (OLLAMA_DISCOVERY_CACHE.models[0] || 'qwen2.5:3b') : def?.defaultModel) || 'qwen2.5:3b';

  if (normProvider !== 'zai' && normProvider !== 'ollama' && !resolvedKey) {
    return {
      ok: false,
      providerId: normProvider,
      modelId: chosenModel,
      healthStatus: 'unconfigured',
      error: 'API key ausente para teste de conexão.',
    };
  }

  try {
    const res = def?.kind === 'decision'
      ? await layaDecisionService.probe({
        apiKey: resolvedKey,
        model: chosenModel,
        baseUrl: resolveBaseUrl(normProvider),
      })
      : await callSingleCandidate(
        {
          providerId: normProvider,
          modelId: chosenModel,
          apiKey: resolvedKey,
          baseUrl: resolveBaseUrl(normProvider),
        },
        {
          systemPrompt: 'Responda apenas OK.',
          messages: [{ role: 'user', content: 'OK' }],
          temperature: 0,
          maxTokens: 16,
          timeoutMs: 15000,
        }
      );

    recordProviderHealth(scope === 'master' ? '__master__' : companyId, normProvider, chosenModel, {
      ok: true,
      latencyMs: res.latencyMs,
    });
    if (targetCredId) {
      await credentialVault.updateCredentialHealth(targetCredId, {
        healthStatus: 'healthy',
        latencyMs: res.latencyMs,
      });
    }
    await credentialVault.recordAuditEvent({
      companyId: scope === 'master' ? '__master__' : companyId,
      scope,
      agentKey: agentKey || null,
      providerId: normProvider,
      action: 'tested',
      actor,
      detail: { modelId: chosenModel, ok: true, latencyMs: res.latencyMs },
    });

    return {
      ok: true,
      providerId: normProvider,
      modelId: chosenModel,
      healthStatus: 'healthy',
      latencyMs: res.latencyMs,
      response: res.reply,
    };
  } catch (err) {
    const statusCode = err?.response?.status || null;
    const errMsg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Falha de conexão';
    const healthStatus = statusCode === 401 || statusCode === 403
      ? 'unauthorized'
      : statusCode === 402 || statusCode === 429
        ? 'quota_exceeded'
        : 'degraded';

    recordProviderHealth(scope === 'master' ? '__master__' : companyId, normProvider, chosenModel, {
      ok: false,
      statusCode,
      error: errMsg,
    });
    if (targetCredId) {
      await credentialVault.updateCredentialHealth(targetCredId, {
        healthStatus,
        error: errMsg,
      });
    }
    await credentialVault.recordAuditEvent({
      companyId: scope === 'master' ? '__master__' : companyId,
      scope,
      agentKey: agentKey || null,
      providerId: normProvider,
      action: 'tested_failed',
      actor,
      detail: { modelId: chosenModel, ok: false, statusCode, error: errMsg.slice(0, 200) },
    });

    return {
      ok: false,
      providerId: normProvider,
      modelId: chosenModel,
      healthStatus,
      statusCode,
      error: errMsg,
    };
  }
}

module.exports = {
  ROUTING_MODES,
  PROVIDER_DEFINITIONS,
  MODEL_PRICING_AND_LIMITS,
  normalizeRoutingMode,
  resolveBaseUrl,
  getModelMeta,
  estimateCostUsd,
  discoverOllamaModels,
  getRouterPolicy,
  upsertRouterPolicy,
  getProviderCatalog,
  selectExecutionCandidates,
  executeChatCompletion,
  probeProvider,
};
