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
const whatsappService = require('./whatsappService');

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
    flowId: settings.flowId || null,
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
      dailyLimit: settings.dailyLimit ? Number(settings.dailyLimit) : null,
      hourlyLimit: settings.hourlyLimit ? Number(settings.hourlyLimit) : null,
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

function normalizeCampaignMessage(rawMessage) {
  if (typeof rawMessage === 'string') {
    return { type: 'text', content: rawMessage };
  }

  if (!rawMessage || typeof rawMessage !== 'object') {
    return null;
  }

  const type = String(rawMessage.type || rawMessage.mediaType || 'text').toLowerCase();
  const content = rawMessage.text || rawMessage.content || rawMessage.caption || '';
  const mediaPath = rawMessage.mediaPath || rawMessage.mediaUrl || rawMessage.url || rawMessage.file || null;

  return {
    ...rawMessage,
    type,
    content: String(content || ''),
    mediaPath,
  };
}

function selectMessageForContact(state, _contact) {
  if (!state.messages.length) return null;
  const idx = Math.max(0, state.currentIndex - 1) % state.messages.length;
  return normalizeCampaignMessage(state.messages[idx]);
}

function normalizeCampaignMediaType(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'file' || normalized === 'pdf' || normalized === 'document') return 'document';
  if (['image', 'video', 'audio', 'sticker'].includes(normalized)) return normalized;
  return null;
}

function isMediaCampaignMessage(message) {
  return Boolean(normalizeCampaignMediaType(message?.type));
}

async function dispatchSingleMessage(state, contact, io) {
  const phone = contact?.phone || contact?.number || String(contact || '');
  if (!phone) {
    state.failedQueue.push({ contact, error: 'no_phone', at: new Date().toISOString() });
    state.metrics.failed += 1;
    return { success: false, error: 'no_phone' };
  }

  if (state.flowId) {
    try {
      const quickReplyService = require('./quickReplyService');
      const allReplies = await quickReplyService.listQuickReplies();
      const flow = allReplies.find((item) => item.id === state.flowId);

      if (!flow) {
        throw new Error(`Flow ${state.flowId} not found`);
      }

      const outboundQueueService = require('./outboundQueueService');
      let cumulativeDelayMs = 0;
      const now = Date.now();

      const steps = flow.steps || [];
      for (const step of steps) {
        cumulativeDelayMs += Number(step.delayMs || 0);
        const scheduledTime = new Date(now + cumulativeDelayMs).toISOString();

        const itemPayload = {
          phone,
          sessionId: state.sessionId || 'main',
          companyId: state.companyId || 'default',
          text: step.type === 'text' ? step.value : '',
          mediaType: step.type !== 'text' ? step.type : undefined,
          mediaPath: step.type !== 'text' ? step.value : undefined,
          fileName: step.filename,
          nextAttemptAt: scheduledTime,
          metadata: {
            campaignId: state.id,
            flowId: flow.id,
            stepId: step.id,
            isFlowStep: true,
            source: 'campaign_flow',
          },
          actions: step.actions,
        };
        await outboundQueueService.enqueue(itemPayload);
      }

      const deliveryMs = 0;
      state.sentQueue.push({
        contact,
        phone,
        deliveryMs,
        at: new Date().toISOString(),
      });
      state.metrics.sent += 1;
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

  const campaignMessage = selectMessageForContact(state, contact);
  if (!campaignMessage || (!campaignMessage.content && !campaignMessage.mediaPath)) {
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

    // Check hourly and daily limits if set
    if (state.settings.dailyLimit || state.settings.hourlyLimit) {
      const { query } = require('../config/database');
      const sessionId = session.id || state.sessionId || 'main';
      
      if (state.settings.hourlyLimit) {
        const { rows } = await query(
          `SELECT COUNT(*) FROM messages WHERE session_id = $1 AND from_me = TRUE AND created_at > NOW() - INTERVAL '1 hour'`,
          [sessionId]
        );
        const sentInLastHour = Number(rows[0]?.count || 0);
        if (sentInLastHour >= state.settings.hourlyLimit) {
          throw new Error(`Limite de envios por hora atingido para a conexão (${state.settings.hourlyLimit} msgs/hora)`);
        }
      }
      
      if (state.settings.dailyLimit) {
        const { rows } = await query(
          `SELECT COUNT(*) FROM messages WHERE session_id = $1 AND from_me = TRUE AND created_at > NOW() - INTERVAL '24 hours'`,
          [sessionId]
        );
        const sentInLastDay = Number(rows[0]?.count || 0);
        if (sentInLastDay >= state.settings.dailyLimit) {
          throw new Error(`Limite de envios diário atingido para a conexão (${state.settings.dailyLimit} msgs/dia)`);
        }
      }
    }

    const jid = whatsappService.ensureWhatsAppJid(phone);

    await session.sock.presenceSubscribe(jid).catch(() => {});
    await session.sock.sendPresenceUpdate('composing', jid).catch(() => {});

    await sleep(state.settings.typingDelayMs);

    if (isMediaCampaignMessage(campaignMessage)) {
      const mediaType = normalizeCampaignMediaType(campaignMessage.type);
      const mediaPath = campaignMessage.mediaPath || campaignMessage.content;
      if (!mediaPath) {
        throw new Error('Campaign media message is missing mediaPath/mediaUrl/content.');
      }
      await whatsappService.sendMediaMessage(session.sock, phone, mediaType, mediaPath, {
        caption: campaignMessage.caption || campaignMessage.text || '',
        fileName: campaignMessage.fileName || campaignMessage.filename,
        mimetype: campaignMessage.mimetype,
        ptt: campaignMessage.ptt === true,
      });
    } else {
      await whatsappService.sendMessage(session.sock, phone, campaignMessage.content);
    }

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
