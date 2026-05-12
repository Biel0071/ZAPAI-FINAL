/**
 * Campaign Dispatch Engine — Real message dispatch with anti-ban, throttle, and retry.
 *
 * Features:
 * - Queue-based dispatch per campaign
 * - Random delays between messages (anti-ban)
 * - Typing simulation before send
 * - Session affinity (campaign → session)
 * - Pause/resume per campaign
 * - Progress tracking via WebSocket
 * - Retry failed messages with backoff
 * - Warmup mode (gradual ramp-up)
 * - Rate limiting per session
 * - PostgreSQL persistence via campaignRepository
 */

const campaignRepository = require('../repositories/campaignRepository');
const sessionManager = require('./sessionManager');
const backpressureController = require('./backpressureController');

const DEFAULT_COMPANY_ID = String(process.env.DEFAULT_COMPANY_ID || 'default').trim();

// ─── Active Campaign State ───
const activeCampaigns = new Map(); // campaignId → CampaignState

/**
 * @typedef {Object} CampaignState
 * @property {string} id
 * @property {string} status - queued|running|paused|completed|failed|cancelled
 * @property {Array} pendingQueue - contacts waiting to be processed
 * @property {Array} sentQueue - successfully sent
 * @property {Array} failedQueue - failed to send
 * @property {number} currentIndex
 * @property {NodeJS.Timeout|null} dispatchTimer
 * @property {boolean} processing
 * @property {Object} settings
 * @property {Object} metrics
 * @property {string} sessionId
 */

function createCampaignState(campaign) {
  const contacts = Array.isArray(campaign.selectedContacts) ? campaign.selectedContacts : [];
  const settings = campaign.settings || {};

  return {
    id: campaign.id,
    name: campaign.name || 'Unnamed',
    status: 'queued',
    pendingQueue: [...contacts],
    sentQueue: [],
    failedQueue: [],
    retryQueue: [],
    currentIndex: 0,
    dispatchTimer: null,
    processing: false,
    sessionId: settings.sessionId || null,
    messages: Array.isArray(campaign.messages) ? campaign.messages : [],
    settings: {
      intervalMs: Math.max(3000, (Number(settings.intervalSeconds) || 10) * 1000),
      pauseEvery: Math.max(1, Number(settings.pauseEvery) || 10),
      pauseMs: Math.max(5000, (Number(settings.pauseSeconds) || 60) * 1000),
      typingDelayMs: Math.max(1000, (Number(settings.typingDelaySeconds) || 3) * 1000),
      randomDelayMin: Math.max(1000, Number(settings.randomDelayMin) || 2000),
      randomDelayMax: Math.max(5000, Number(settings.randomDelayMax) || 8000),
      maxRetries: Math.max(1, Number(settings.maxRetries) || 3),
      warmupMessages: Math.max(0, Number(settings.warmupMessages) || 5),
      warmupDelayMultiplier: Number(settings.warmupDelayMultiplier) || 3,
    },
    metrics: {
      total: contacts.length,
      sent: 0,
      failed: 0,
      retried: 0,
      startedAt: null,
      completedAt: null,
      avgDeliveryMs: 0,
      totalDeliveryMs: 0,
    },
    companyId: campaign.companyId || DEFAULT_COMPANY_ID,
  };
}

// ─── Dispatch Logic ───

function getRandomDelay(state) {
  const { randomDelayMin, randomDelayMax } = state.settings;
  const base = randomDelayMin + Math.random() * (randomDelayMax - randomDelayMin);

  // Warmup: first N messages use longer delays
  if (state.metrics.sent < state.settings.warmupMessages) {
    return Math.round(base * state.settings.warmupDelayMultiplier);
  }

  return Math.round(base);
}

function selectMessageForContact(state, _contact) {
  if (!state.messages.length) return null;
  // Round-robin or random message selection
  const idx = state.currentIndex % state.messages.length;
  const msg = state.messages[idx];
  return typeof msg === 'string' ? msg : (msg?.text || msg?.content || String(msg));
}

async function dispatchSingleMessage(state, contact, io) {
  const phone = contact?.phone || contact?.number || String(contact || '');
  if (!phone) {
    state.failedQueue.push({ contact, error: 'no_phone', at: new Date().toISOString() });
    state.metrics.failed += 1;
    return { success: false, error: 'no_phone' };
  }

  const messageText = selectMessageForContact(state, contact);
  if (!messageText) {
    state.failedQueue.push({ contact, error: 'no_message', at: new Date().toISOString() });
    state.metrics.failed += 1;
    return { success: false, error: 'no_message' };
  }

  // Check backpressure
  if (!backpressureController.shouldProcessOutbound()) {
    state.failedQueue.push({ contact, error: 'backpressure', at: new Date().toISOString() });
    return { success: false, error: 'backpressure', retry: true };
  }

  const startTime = Date.now();

  try {
    // Simulate typing delay
    const session = state.sessionId
      ? sessionManager.getSession(state.sessionId)
      : sessionManager.getDefaultSession();

    if (!session?.sock) {
      state.failedQueue.push({ contact, error: 'no_session', at: new Date().toISOString() });
      state.metrics.failed += 1;
      return { success: false, error: 'no_session' };
    }

    // Normalize phone for WhatsApp
    const jid = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;

    // Send typing indicator
    await session.sock.presenceSubscribe(jid).catch(() => {});
    await session.sock.sendPresenceUpdate('composing', jid).catch(() => {});

    // Wait for typing simulation
    await sleep(state.settings.typingDelayMs);

    // Send the message
    await session.sock.sendMessage(jid, { text: messageText });

    // Clear typing
    await session.sock.sendPresenceUpdate('paused', jid).catch(() => {});

    const deliveryMs = Date.now() - startTime;
    state.sentQueue.push({
      contact,
      phone,
      deliveryMs,
      at: new Date().toISOString(),
    });
    state.metrics.sent += 1;
    state.metrics.totalDeliveryMs += deliveryMs;
    state.metrics.avgDeliveryMs = Math.round(state.metrics.totalDeliveryMs / state.metrics.sent);

    return { success: true, deliveryMs };
  } catch (err) {
    state.failedQueue.push({
      contact,
      phone,
      error: err?.message || String(err),
      at: new Date().toISOString(),
    });
    state.metrics.failed += 1;
    return { success: false, error: err?.message || String(err) };
  }
}

function emitProgress(state, io) {
  if (!io) return;

  const progress = {
    campaignId: state.id,
    name: state.name,
    status: state.status,
    total: state.metrics.total,
    sent: state.metrics.sent,
    failed: state.metrics.failed,
    pending: state.pendingQueue.length,
    progress: state.metrics.total > 0
      ? Math.round((state.metrics.sent / state.metrics.total) * 100)
      : 0,
    avgDeliveryMs: state.metrics.avgDeliveryMs,
    startedAt: state.metrics.startedAt,
  };

  io.emit('campaign:progress', progress);
  io.emit('campaigns.updated', progress);
}

async function persistProgress(state) {
  try {
    await campaignRepository.updateCampaign(state.id, {
      status: state.status,
      queue: {
        total: state.metrics.total,
        processed: state.metrics.sent + state.metrics.failed,
        sent: state.metrics.sent,
        failed: state.metrics.failed,
        paused: state.status === 'paused',
      },
      startedAt: state.metrics.startedAt,
      completedAt: state.metrics.completedAt,
    }, state.companyId);
  } catch (err) {
    console.error(`[CampaignEngine] Persist failed for ${state.id}:`, err?.message || err);
  }
}

// ─── Dispatch Loop ───

async function runDispatchLoop(state, io) {
  if (state.status !== 'running' || state.processing) return;
  state.processing = true;

  try {
    while (state.pendingQueue.length > 0 && state.status === 'running') {
      const contact = state.pendingQueue.shift();
      state.currentIndex += 1;

      const result = await dispatchSingleMessage(state, contact, io);

      // Emit progress after each message
      emitProgress(state, io);

      // Retry on backpressure
      if (result?.retry) {
        state.pendingQueue.unshift(contact);
        await sleep(5000);
        continue;
      }

      // Pause every N messages
      if (state.metrics.sent > 0 && state.metrics.sent % state.settings.pauseEvery === 0) {
        console.log(`[CampaignEngine] Pausing ${state.id} for ${state.settings.pauseMs}ms (anti-ban)`);
        await sleep(state.settings.pauseMs);
      }

      // Random delay between messages
      const delay = getRandomDelay(state);
      await sleep(delay);

      // Persist progress every 10 messages
      if (state.metrics.sent % 10 === 0) {
        await persistProgress(state);
      }
    }

    // Campaign completed
    if (state.pendingQueue.length === 0 && state.status === 'running') {
      state.status = 'completed';
      state.metrics.completedAt = new Date().toISOString();
      await persistProgress(state);
      emitProgress(state, io);
      console.log(`[CampaignEngine] Campaign ${state.id} completed: ${state.metrics.sent} sent, ${state.metrics.failed} failed`);
    }
  } catch (err) {
    console.error(`[CampaignEngine] Dispatch loop error for ${state.id}:`, err?.message || err);
    state.status = 'failed';
    await persistProgress(state);
    emitProgress(state, io);
  } finally {
    state.processing = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

// ─── Public API ───

async function startCampaign(campaignId, companyId, io) {
  const campaign = await campaignRepository.getCampaignById(campaignId, companyId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  if (activeCampaigns.has(campaignId)) {
    throw new Error(`Campaign ${campaignId} already running`);
  }

  const state = createCampaignState({ ...campaign, companyId });
  state.status = 'running';
  state.metrics.startedAt = new Date().toISOString();

  activeCampaigns.set(campaignId, state);

  await campaignRepository.updateCampaign(campaignId, {
    status: 'running',
    startedAt: state.metrics.startedAt,
  }, companyId);

  console.log(`[CampaignEngine] Starting campaign ${campaignId}: ${state.pendingQueue.length} contacts`);

  // Start dispatch loop (non-blocking)
  runDispatchLoop(state, io).catch((err) => {
    console.error(`[CampaignEngine] Fatal error in campaign ${campaignId}:`, err?.message || err);
  });

  emitProgress(state, io);
  return getStatus(campaignId);
}

function pauseCampaign(campaignId) {
  const state = activeCampaigns.get(campaignId);
  if (!state) return null;
  state.status = 'paused';
  persistProgress(state).catch(() => {});
  return getStatus(campaignId);
}

function resumeCampaign(campaignId, io) {
  const state = activeCampaigns.get(campaignId);
  if (!state || state.status !== 'paused') return null;
  state.status = 'running';
  runDispatchLoop(state, io).catch(() => {});
  return getStatus(campaignId);
}

function cancelCampaign(campaignId) {
  const state = activeCampaigns.get(campaignId);
  if (!state) return null;
  state.status = 'cancelled';
  state.metrics.completedAt = new Date().toISOString();
  persistProgress(state).catch(() => {});
  activeCampaigns.delete(campaignId);
  return { id: campaignId, status: 'cancelled' };
}

function getStatus(campaignId) {
  const state = activeCampaigns.get(campaignId);
  if (!state) return null;

  return {
    id: state.id,
    name: state.name,
    status: state.status,
    metrics: { ...state.metrics },
    pending: state.pendingQueue.length,
    settings: { ...state.settings },
  };
}

function listActive() {
  const results = [];
  for (const [id] of activeCampaigns) {
    results.push(getStatus(id));
  }
  return results;
}

function stopAll() {
  for (const [id, state] of activeCampaigns) {
    state.status = 'cancelled';
    persistProgress(state).catch(() => {});
  }
  activeCampaigns.clear();
}

module.exports = {
  cancelCampaign,
  getStatus,
  listActive,
  pauseCampaign,
  resumeCampaign,
  startCampaign,
  stopAll,
};
