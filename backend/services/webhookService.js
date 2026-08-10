const axios = require('axios');
const systemSettingsRepository = require('../src/data/repositories/systemSettingsRepository');

const WEBHOOK_SETTINGS_KEY = 'webhook_subscriptions_v1';

function defaultTenantKey(tenantId) {
  return String(tenantId || process.env.DEFAULT_COMPANY_ID || 'default').trim();
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function readWebhookStore() {
  const setting = await systemSettingsRepository.getSetting(WEBHOOK_SETTINGS_KEY);
  if (!setting?.value) {
    return {};
  }

  return safeJsonParse(setting.value, {});
}

async function writeWebhookStore(store) {
  await systemSettingsRepository.setSetting(WEBHOOK_SETTINGS_KEY, JSON.stringify(store || {}));
}

async function listWebhooks(tenantId) {
  const store = await readWebhookStore();
  return Array.isArray(store[defaultTenantKey(tenantId)]) ? store[defaultTenantKey(tenantId)] : [];
}

async function upsertWebhook({ tenantId, url, events = [], secret = '' }) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    throw new Error('Webhook URL is required.');
  }

  const normalizedEvents = Array.isArray(events)
    ? [...new Set(events.map((event) => String(event || '').trim()).filter(Boolean))]
    : [];

  const store = await readWebhookStore();
  const tenantKey = defaultTenantKey(tenantId);
  const existing = Array.isArray(store[tenantKey]) ? store[tenantKey] : [];
  const now = new Date().toISOString();
  const next = {
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: normalizedUrl,
    events: normalizedEvents,
    secret: String(secret || ''),
    active: true,
    updatedAt: now,
    createdAt: now,
  };

  const existingIndex = existing.findIndex((item) => item.url === normalizedUrl);
  if (existingIndex >= 0) {
    next.id = existing[existingIndex].id;
    next.createdAt = existing[existingIndex].createdAt || now;
    existing[existingIndex] = next;
  } else {
    existing.push(next);
  }

  store[tenantKey] = existing;
  await writeWebhookStore(store);

  return next;
}

async function removeWebhook({ tenantId, webhookId }) {
  const store = await readWebhookStore();
  const tenantKey = defaultTenantKey(tenantId);
  const existing = Array.isArray(store[tenantKey]) ? store[tenantKey] : [];
  const next = existing.filter((item) => item.id !== webhookId);
  store[tenantKey] = next;
  await writeWebhookStore(store);

  return next.length !== existing.length;
}

async function dispatchEvent({ tenantId, event, payload }) {
  let hooks = [];

  try {
    hooks = await listWebhooks(tenantId);
  } catch {
    return {
      delivered: 0,
      failed: 0,
      skipped: true,
    };
  }
  const targets = hooks.filter((hook) => {
    if (!hook?.active || !hook.url) {
      return false;
    }

    if (!Array.isArray(hook.events) || hook.events.length === 0) {
      return true;
    }

    return hook.events.includes(event);
  });

  const settled = await Promise.allSettled(
    targets.map((hook) =>
      axios.post(
        hook.url,
        {
          event,
          tenantId: defaultTenantKey(tenantId),
          payload: payload || {},
          occurredAt: new Date().toISOString(),
        },
        {
          timeout: 5000,
          headers: {
            'content-type': 'application/json',
            ...(hook.secret ? { 'x-webhook-secret': hook.secret } : {}),
          },
        }
      )
    )
  );

  return {
    delivered: settled.filter((item) => item.status === 'fulfilled').length,
    failed: settled.filter((item) => item.status === 'rejected').length,
  };
}

module.exports = {
  dispatchEvent,
  listWebhooks,
  removeWebhook,
  upsertWebhook,
};
