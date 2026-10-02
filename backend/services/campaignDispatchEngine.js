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

const campaignRepository = require('../src/data/repositories/campaignRepository');
const sessionManager = require('./sessionManager');
const backpressureController = require('./backpressureController');
const whatsappService = require('./whatsappService');
const conversationRepository = require('../src/data/repositories/conversationRepository');

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

function normalizeCampaignDelayMs(val, fallbackMs) {
  if (val === undefined || val === null || val === '') return fallbackMs;
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return fallbackMs;
  if (num <= 300) return Math.round(num * 1000);
  return Math.round(num);
}

function createCampaignState(campaign) {
  const contacts = Array.isArray(campaign.selectedContacts) ? campaign.selectedContacts : [];
  const settings = campaign.settings || {};

  // Human cadence target: ~100-130s average per contact (~115s for 61 leads over 2h)
  const intervalMs = normalizeCampaignDelayMs(
    settings.intervalSeconds ?? settings.intervalMs,
    115000
  );

  // Random delay between contacts: default 85s to 140s
  const randomDelayMin = settings.randomDelayMin !== undefined
    ? normalizeCampaignDelayMs(settings.randomDelayMin, 85000)
    : Math.max(3000, Math.round(intervalMs * 0.8));

  let randomDelayMax = settings.randomDelayMax !== undefined
    ? normalizeCampaignDelayMs(settings.randomDelayMax, 140000)
    : Math.max(randomDelayMin, Math.round(intervalMs * 1.2));

  if (randomDelayMax < randomDelayMin) {
    randomDelayMax = randomDelayMin;
  }

  // Typing delay with WhatsApp presence: 6 to 12s
  const typingDelayMinMs = normalizeCampaignDelayMs(
    settings.typingDelayMinSeconds ?? settings.typingDelayMin ?? (settings.typingDelaySeconds ? Number(settings.typingDelaySeconds) * 0.75 : null),
    6000
  );

  let typingDelayMaxMs = normalizeCampaignDelayMs(
    settings.typingDelayMaxSeconds ?? settings.typingDelayMax ?? (settings.typingDelaySeconds ? Number(settings.typingDelaySeconds) * 1.35 : null),
    12000
  );

  if (typingDelayMaxMs < typingDelayMinMs) {
    typingDelayMaxMs = typingDelayMinMs;
  }

  // Human attendant breaks: pause every 6 to 8 messages for 2.5 to 4 minutes (150s - 240s)
  const pauseEveryMin = Math.max(1, Number(settings.pauseEveryMin) || (settings.pauseEvery ? Math.max(1, Number(settings.pauseEvery) - 1) : 6));
  const pauseEveryMax = Math.max(pauseEveryMin, Number(settings.pauseEveryMax) || (settings.pauseEvery ? Math.max(pauseEveryMin, Number(settings.pauseEvery) + 1) : 8));
  const pauseEvery = Number(settings.pauseEvery) || Math.round((pauseEveryMin + pauseEveryMax) / 2);

  const pauseMinMs = normalizeCampaignDelayMs(
    settings.pauseMinSeconds ?? settings.pauseMin ?? (settings.pauseSeconds ? Number(settings.pauseSeconds) * 0.8 : null),
    150000
  );

  let pauseMaxMs = normalizeCampaignDelayMs(
    settings.pauseMaxSeconds ?? settings.pauseMax ?? (settings.pauseSeconds ? Number(settings.pauseSeconds) * 1.25 : null),
    240000
  );

  if (pauseMaxMs < pauseMinMs) {
    pauseMaxMs = pauseMinMs;
  }

  const initialPauseThreshold = Math.floor(Math.random() * (pauseEveryMax - pauseEveryMin + 1)) + pauseEveryMin;

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
    nextPauseThreshold: initialPauseThreshold,
    sessionId: settings.sessionId || null,
    messages: Array.isArray(campaign.messages) ? campaign.messages : [],
    flowId: settings.flowId || null,
    settings: {
      intervalMs,
      intervalSeconds: Math.round(intervalMs / 1000),
      randomDelayMin,
      randomDelayMax,
      typingDelayMinMs,
      typingDelayMaxMs,
      typingDelayMs: Math.round((typingDelayMinMs + typingDelayMaxMs) / 2),
      pauseEvery,
      pauseEveryMin,
      pauseEveryMax,
      pauseMinMs,
      pauseMaxMs,
      pauseMs: Math.round((pauseMinMs + pauseMaxMs) / 2),
      maxRetries: Math.max(1, Number(settings.maxRetries) || 3),
      warmupMessages: settings.warmupMessages !== undefined ? Math.max(0, Number(settings.warmupMessages)) : 0,
      warmupDelayMultiplier: Number(settings.warmupDelayMultiplier) || 1.5,
      dailyLimit: settings.dailyLimit ? Number(settings.dailyLimit) : null,
      hourlyLimit: settings.hourlyLimit ? Number(settings.hourlyLimit) : null,
      enableAIPostDispatch: Boolean(settings.enableAIPostDispatch),
      aiSetup: settings.aiSetup || {},
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

function isCampaignSessionConnected(session) {
  return Boolean(session?.sock && String(session.status || '').toLowerCase() === 'connected');
}

function resolveCampaignSession(preferredSessionId) {
  const preferred = preferredSessionId ? sessionManager.getSession(preferredSessionId) : null;
  if (isCampaignSessionConnected(preferred)) return preferred;

  const fallbackDefault = sessionManager.getDefaultSession?.();
  if (isCampaignSessionConnected(fallbackDefault)) return fallbackDefault;

  const connectedInfo = (sessionManager.listSessions?.() || []).find((session) =>
    String(session?.status || '').toLowerCase() === 'connected',
  );
  if (connectedInfo) {
    const connected = sessionManager.getSession(connectedInfo.sessionId || connectedInfo.id);
    if (isCampaignSessionConnected(connected)) return connected;
  }

  return preferred || fallbackDefault || null;
}

function getCampaignTypingDelay(state, messageContent = '') {
  const minMs = state.settings.typingDelayMinMs || 6000;
  const maxMs = state.settings.typingDelayMaxMs || 12000;

  if (maxMs <= minMs) return minMs;

  const rawText = typeof messageContent === 'string'
    ? messageContent
    : (messageContent?.text || messageContent?.caption || messageContent?.content || '');
  const textLen = typeof rawText === 'string' ? rawText.length : 0;
  if (textLen > 0) {
    const charDelay = textLen * 40;
    const clamped = Math.min(maxMs, Math.max(minMs, charDelay));
    const jitter = Math.floor(Math.random() * 2000) - 1000;
    const candidate = clamped + jitter;
    if (Number.isFinite(candidate)) {
      return Math.min(maxMs, Math.max(minMs, candidate));
    }
  }

  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function getRandomDelay(state) {
  const { randomDelayMin, randomDelayMax, warmupMessages, warmupDelayMultiplier } = state.settings;
  const min = Math.max(1000, Number(randomDelayMin) || 1000);
  const max = Math.max(min, Number(randomDelayMax) || min);
  const base = Math.floor(Math.random() * (max - min + 1)) + min;

  // Warmup: first N messages use longer delays
  if (warmupMessages > 0 && state.metrics.sent < warmupMessages) {
    return Math.round(base * (warmupDelayMultiplier || 1.5));
  }

  return base;
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
      const allReplies = await quickReplyService.listQuickReplies({ companyId: state.companyId });
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
    contact._backpressureRetries = (contact._backpressureRetries || 0) + 1;
    if (contact._backpressureRetries <= 5) {
      console.warn(`[CampaignEngine] Backpressure active for ${phone}, retrying (attempt ${contact._backpressureRetries}/5)...`);
      return { success: false, error: 'backpressure', retry: true };
    }
    state.failedQueue.push({ contact, phone, error: 'backpressure_exhausted', at: new Date().toISOString() });
    state.metrics.failed += 1;
    return { success: false, error: 'backpressure_exhausted' };
  }

  const startTime = Date.now();

  try {
    // Simulate typing delay
    const session = resolveCampaignSession(state.sessionId);

    if (!session?.sock) {
      contact._sessionRetries = (contact._sessionRetries || 0) + 1;
      if (contact._sessionRetries <= (state.settings.maxRetries || 3)) {
        console.warn(`[CampaignEngine] Session not ready for ${phone}, retrying in 5s (attempt ${contact._sessionRetries}/${state.settings.maxRetries || 3})...`);
        return { success: false, error: 'no_session', retry: true };
      }
      state.failedQueue.push({ contact, phone, error: 'no_session', at: new Date().toISOString() });
      state.metrics.failed += 1;
      return { success: false, error: 'no_session' };
    }

    // Check hourly and daily limits if set
    if (state.settings.dailyLimit || state.settings.hourlyLimit) {
      const { query } = require('../src/infrastructure/config/database');
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

    const dynamicTypingMs = getCampaignTypingDelay(state, campaignMessage.content);
    await interruptibleSleep(dynamicTypingMs, state);

    if (isMediaCampaignMessage(campaignMessage)) {
      const mediaType = normalizeCampaignMediaType(campaignMessage.type);
      const mediaPath = campaignMessage.mediaPath || campaignMessage.content;
      if (!mediaPath) {
        throw new Error('Campaign media message is missing mediaPath/mediaUrl/content.');
      }
      await whatsappService.sendMediaMessage(session.sock, phone, mediaType, mediaPath, {
        caption: campaignMessage.caption || campaignMessage.text || campaignMessage.content || '',
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

    // AI POST-DISPATCH ACTIVATION
    if (state.settings.enableAIPostDispatch) {
      try {
        const conversation = await conversationRepository.getConversationByPhone(phone, state.companyId);
        if (conversation) {
          // Ativa o bot e atualiza estágios caso definido via aiSetup
          const updates = { ai_enabled: true };
          if (state.settings.aiSetup?.autoFunnel) {
             updates.funnel_stage = 'Lead_Quente';
             updates.lead_temperature = 'hot';
          }
          await conversationRepository.updateConversationState(conversation.id, updates);
          
          if (state.settings.aiSetup?.autoTagging) {
             const currentTags = Array.isArray(conversation.tags) ? conversation.tags : [];
             if (!currentTags.includes('robo_ativo')) {
                currentTags.push('robo_ativo');
                await conversationRepository.updateConversationState(conversation.id, { tags: currentTags });
             }
          }
        }
      } catch (aiErr) {
        console.error(`[CampaignEngine] Failed to enable AI for ${phone}:`, aiErr.message);
      }
    }

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
    processed: state.metrics.sent + state.metrics.failed,
    progress: state.metrics.total > 0
      ? Math.round(((state.metrics.sent + state.metrics.failed) / state.metrics.total) * 100)
      : 0,
    avgDeliveryMs: state.metrics.avgDeliveryMs,
    startedAt: state.metrics.startedAt,
    inBreak: Boolean(state.inBreak),
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
        await interruptibleSleep(5000, state);
        continue;
      }

      // Human attendant break pause simulation (every 6 to 8 messages, 150-240s)
      if (state.metrics.sent > 0 && state.pendingQueue.length > 0 && state.metrics.sent >= state.nextPauseThreshold) {
        const pauseMin = state.settings.pauseMinMs || 150000;
        const pauseMax = state.settings.pauseMaxMs || 240000;
        const pauseDelay = Math.floor(Math.random() * (pauseMax - pauseMin + 1)) + pauseMin;
        console.log(`[CampaignEngine] Human break pause for ${state.id}: ${Math.round(pauseDelay / 1000)}s (simulating attendant break after ${state.metrics.sent} messages)`);
        state.inBreak = true;
        emitProgress(state, io);
        await interruptibleSleep(pauseDelay, state);
        state.inBreak = false;

        const nextGap = Math.floor(Math.random() * (state.settings.pauseEveryMax - state.settings.pauseEveryMin + 1)) + state.settings.pauseEveryMin;
        state.nextPauseThreshold = state.metrics.sent + nextGap;
      }

      // Random delay between messages (if more contacts remain and campaign is running)
      if (state.pendingQueue.length > 0 && state.status === 'running') {
        const delay = getRandomDelay(state);
        await interruptibleSleep(delay, state);
      }

      // Persist progress every 5 messages or when completed
      if (state.metrics.sent % 5 === 0 || state.pendingQueue.length === 0) {
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

async function interruptibleSleep(ms, state) {
  const step = 500;
  let remaining = Math.max(0, ms);
  while (remaining > 0) {
    if (state && state.status !== 'running') {
      break;
    }
    const currentWait = Math.min(step, remaining);
    await sleep(currentWait);
    remaining -= currentWait;
  }
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

  try {
    const { syncEngine } = require('./sync');
    syncEngine.dispatch('campaign.started', {
      campaignId,
      name: state.name,
      totalContacts: state.pendingQueue.length,
      tenantId: companyId || 'default',
    });
  } catch (_) {}

  // Start dispatch loop (non-blocking)
  runDispatchLoop(state, io).catch((err) => {
    console.error(`[CampaignEngine] Fatal error in campaign ${campaignId}:`, err?.message || err);
  });

  emitProgress(state, io);
  return getStatus(campaignId);
}

function pauseCampaign(campaignId, companyId) {
  const state = activeCampaigns.get(campaignId);
  if (!state || (companyId && state.companyId !== companyId)) return null;
  state.status = 'paused';
  persistProgress(state).catch(() => {});
  return getStatus(campaignId);
}

function resumeCampaign(campaignId, io, companyId) {
  const state = activeCampaigns.get(campaignId);
  if (!state || (companyId && state.companyId !== companyId) || state.status !== 'paused') return null;
  state.status = 'running';
  runDispatchLoop(state, io).catch(() => {});
  return getStatus(campaignId);
}

function cancelCampaign(campaignId, companyId) {
  const state = activeCampaigns.get(campaignId);
  if (!state || (companyId && state.companyId !== companyId)) return null;
  state.status = 'cancelled';
  state.metrics.completedAt = new Date().toISOString();
  persistProgress(state).catch(() => {});
  activeCampaigns.delete(campaignId);
  return { id: campaignId, status: 'cancelled' };
}

function getStatus(campaignId, companyId) {
  const state = activeCampaigns.get(campaignId);
  if (!state || (companyId && state.companyId !== companyId)) return null;

  return {
    id: state.id,
    name: state.name,
    status: state.status,
    metrics: { ...state.metrics, processed: state.metrics.sent + state.metrics.failed },
    pending: state.pendingQueue.length,
    settings: { ...state.settings },
  };
}

function listActive(companyId) {
  const results = [];
  for (const [id, state] of activeCampaigns) {
    if (!companyId || state.companyId === companyId) results.push(getStatus(id));
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

function isRunning(campaignId) {
  if (campaignId) {
    const state = activeCampaigns.get(campaignId);
    return Boolean(state && state.status === 'running');
  }
  return Array.from(activeCampaigns.values()).some((s) => s.status === 'running');
}

module.exports = {
  cancelCampaign,
  createCampaignState,
  getCampaignTypingDelay,
  getRandomDelay,
  getStatus,
  isRunning,
  listActive,
  pauseCampaign,
  resumeCampaign,
  startCampaign,
  stopAll,
};
