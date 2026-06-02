const path = require('path');

const { isAIEnabled } = require('../config/aiToggle');
const aiLearningEngine = require('./aiLearningEngine');
const {
  createDefaultState,
  normalizeState,
  saveAiIntelligenceState,
} = require('../config/aiIntelligenceStorage');
const {
  buildOpenAIContext,
  findMemoryByContact,
  updateConversationMemory,
} = require('./aiConversationMemoryService');
const { analyzeEngineering } = require('./aiEngineeringAnalyzer');
const { generateAiDocumentation } = require('./aiDocumentationService');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function ensureState(store) {
  if (!store.aiIntelligence || typeof store.aiIntelligence !== 'object') {
    store.aiIntelligence = createDefaultState();
  }

  store.aiIntelligence = normalizeState(store.aiIntelligence);
  return store.aiIntelligence;
}

async function persistState(store) {
  const state = ensureState(store);
  const savedState = await saveAiIntelligenceState(state);
  store.aiIntelligence = savedState;
  return savedState;
}

function upsertInsight(state, insight) {
  if (!insight || !insight.id) {
    return;
  }

  const existingIndex = (state.insights || []).findIndex((entry) => entry.id === insight.id);

  if (existingIndex >= 0) {
    state.insights[existingIndex] = {
      ...state.insights[existingIndex],
      ...insight,
    };
    return;
  }

  state.insights = [insight, ...(state.insights || [])].slice(0, 200);
}

function createInsightFromMemory(memory, event) {
  if (!memory) {
    return [];
  }

  const dateKey = String(memory.last_updated || new Date().toISOString()).slice(0, 10);
  const insights = [];

  if (memory.sentiment === 'negative') {
    insights.push({
      id: `negative:${memory.contact_id}:${dateKey}`,
      type: 'customer_risk',
      severity: 'high',
      title: 'Contato com sinal de atrito',
      description: `${memory.name || memory.contact_id} apresentou sentimento negativo recente.`,
      contactId: memory.contact_id,
      createdAt: memory.last_updated,
    });
  }

  if (memory.intent === 'purchase_intent') {
    insights.push({
      id: `purchase:${memory.contact_id}:${dateKey}`,
      type: 'sales_opportunity',
      severity: 'medium',
      title: 'Intencao de compra detectada',
      description: `${memory.name || memory.contact_id} sinalizou prontidao de compra.`,
      contactId: memory.contact_id,
      createdAt: memory.last_updated,
    });
  }

  if (Boolean(memory.metrics?.prefersAudio)) {
    insights.push({
      id: `audio:${memory.contact_id}:${dateKey}`,
      type: 'voice_preference',
      severity: 'low',
      title: 'Contato com preferencia por audio',
      description: `${memory.name || memory.contact_id} demonstrou preferencia por audio/voz.`,
      contactId: memory.contact_id,
      createdAt: memory.last_updated,
    });
  }

  if (event?.direction === 'incoming' && String(event?.text || '').includes('?')) {
    insights.push({
      id: `question:${memory.contact_id}:${dateKey}`,
      type: 'question_detected',
      severity: 'low',
      title: 'Pergunta recente recebida',
      description: 'A memoria registrou uma nova pergunta que pode exigir resposta contextual.',
      contactId: memory.contact_id,
      createdAt: memory.last_updated,
    });
  }

  return insights;
}

function hydrateMemoryFromStore(store) {
  const state = ensureState(store);

  if ((state.conversationMemory || []).length > 0) {
    return;
  }

  const messages = Array.isArray(store?.messages) ? [...store.messages] : [];
  const conversations = Array.isArray(store?.conversations) ? store.conversations : [];
  const conversationById = new Map(
    conversations
      .filter((entry) => entry?.id)
      .map((entry) => [String(entry.id), entry])
  );
  const sortedMessages = messages
    .filter((message) => message?.phone || message?.conversationId)
    .sort(
      (left, right) =>
        new Date(left?.createdAt || left?.timestamp || 0).getTime() -
        new Date(right?.createdAt || right?.timestamp || 0).getTime()
    )
    .slice(-1500);

  for (const message of sortedMessages) {
    const conversation =
      conversationById.get(String(message?.conversationId || '')) ||
      conversations.find((entry) => String(entry?.phone || '') === String(message?.phone || '')) ||
      null;
    const result = updateConversationMemory(state, {
      contactId: message?.phone || conversation?.phone || message?.conversationId,
      conversationId: message?.conversationId || conversation?.id || null,
      direction: message?.fromMe ? 'outgoing' : 'incoming',
      mediaType: message?.mediaType || message?.type || null,
      messageId: message?.id || null,
      name: conversation?.name || message?.name || message?.phone || null,
      phone: message?.phone || conversation?.phone || null,
      source: 'history-backfill',
      text: message?.content || message?.text || '',
      timestamp: message?.createdAt || message?.timestamp || new Date().toISOString(),
    });

    for (const insight of createInsightFromMemory(result.memory, {
      direction: message?.fromMe ? 'outgoing' : 'incoming',
      text: message?.content || message?.text || '',
    })) {
      upsertInsight(state, insight);
    }
  }

  rebuildLearningMetrics(state);
}

function rebuildLearningMetrics(state) {
  state.learningMetrics = {
    totalMemories: (state.conversationMemory || []).length,
    summarizedMemories: (state.conversationMemory || []).filter((entry) => entry.summary).length,
    insightsGenerated: (state.insights || []).length,
    suggestionsPending: (state.improvements || []).filter((item) => item.status === 'pending').length,
    suggestionsApproved: (state.improvements || []).filter((item) => item.status === 'approved')
      .length,
    suggestionsApplied: (state.improvements || []).filter((item) => item.status === 'applied').length,
  };

  state.voiceMetrics.contactsPreferringAudio = (state.conversationMemory || []).filter((entry) =>
    Boolean(entry?.metrics?.prefersAudio)
  ).length;
}

function mergeImprovementBacklog(state, recommended = [], learningSuggestions = []) {
  const backlog = Array.isArray(state.improvements) ? [...state.improvements] : [];
  const knownIds = new Set(backlog.map((entry) => entry.id));

  for (const item of recommended) {
    if (!item?.id) {
      continue;
    }

    if (!knownIds.has(item.id)) {
      backlog.push(item);
      knownIds.add(item.id);
    }
  }

  for (const suggestion of learningSuggestions) {
    if (!suggestion?.id) {
      continue;
    }

    const improvementId = `learning:${suggestion.id}`;
    if (knownIds.has(improvementId)) {
      continue;
    }

    backlog.push({
      id: improvementId,
      area: 'customer-success',
      priority: suggestion.issueType === 'failed_conversation' ? 'high' : 'medium',
      title: `Sugestao de atendimento: ${suggestion.issueType}`,
      summary: suggestion.problemDetected || 'Sugestao gerada pelo motor de aprendizado.',
      recommendation:
        suggestion.suggestedImprovement?.suggestedPromptImprovement ||
        suggestion.suggestedImprovement?.suggestedResponse ||
        'Revisar e aplicar melhoria manualmente.',
      evidence: [suggestion],
      source: 'learning',
      status: suggestion.status === 'applied' ? 'applied' : 'pending',
      createdAt: suggestion.createdAt || new Date().toISOString(),
    });
    knownIds.add(improvementId);
  }

  state.improvements = backlog
    .sort(
      (left, right) =>
        new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    )
    .slice(0, 250);
}

async function captureMessageEvent(store, event = {}) {
  const state = ensureState(store);
  const result = updateConversationMemory(state, {
    contactId: event.contactId || event.phone,
    conversationId: event.conversationId || null,
    direction: event.direction || 'incoming',
    mediaType: event.mediaType || null,
    messageId: event.messageId || null,
    name: event.name || null,
    phone: event.phone || null,
    source: event.source || null,
    text: event.text || '',
    timestamp: event.timestamp || new Date().toISOString(),
  });

  state.lastMessageObservedAt = result.memory?.last_updated || new Date().toISOString();
  state.voiceMetrics.audioIntentDetected += Number(result.audioIntentDetected);
  state.voiceMetrics.audioMessagesDetected += Number(result.audioMessageDetected);
  state.voiceMetrics.lastUpdated = state.lastMessageObservedAt;

  for (const insight of createInsightFromMemory(result.memory, event)) {
    upsertInsight(state, insight);
  }

  rebuildLearningMetrics(state);
  await persistState(store);

  try {
    const aiMemoryEngine = require('./aiMemoryEngine');
    await aiMemoryEngine.persistMemoryEntry(result.memory);
  } catch (err) {
    console.error('[captureMessageEvent] Postgres persist memory entry failed:', err);
  }

  return result.memory;
}

async function runFullAnalysis({ store, app, generateDocs = true } = {}) {
  const state = ensureState(store);
  hydrateMemoryFromStore(store);
  const learningDashboard = await aiLearningEngine.analyzeAndStore(store);
  const engineeringReport = await analyzeEngineering({ app });

  state.lastAnalyzedAt = engineeringReport.generatedAt;
  state.reports = {
    generatedAt: engineeringReport.generatedAt,
    currentState: engineeringReport.currentState,
    problemsFound: engineeringReport.problemsFound,
    improvementsRecommended: engineeringReport.improvementsRecommended,
    nextSteps: engineeringReport.nextSteps,
    learnedPatterns: engineeringReport.learnedPatterns,
  };

  mergeImprovementBacklog(
    state,
    engineeringReport.improvementsRecommended,
    learningDashboard?.suggestions || []
  );

  for (const problem of engineeringReport.problemsFound || []) {
    upsertInsight(state, {
      id: `engineering:${problem.id}`,
      type: 'engineering',
      severity: problem.severity,
      title: problem.title,
      description: problem.detail,
      createdAt: engineeringReport.generatedAt,
    });
  }

  if (generateDocs) {
    const docsResult = await generateAiDocumentation({
      projectRoot: PROJECT_ROOT,
      engineeringReport,
      learningDashboard,
      state,
    });

    state.docsState = {
      lastGeneratedAt: docsResult.generatedAt,
      files: docsResult.files,
    };
  }

  rebuildLearningMetrics(state);
  await persistState(store);

  return buildPanelData(store, {
    engineeringReport,
    learningDashboard,
  });
}

function buildHealthStatusItems(state) {
  const runtime = state.reports?.currentState?.runtime || {};

  return [
    {
      id: 'ai-engine',
      label: 'Motor IA',
      status: isAIEnabled() ? 'Ativo' : 'Desativado',
      detail: 'Controle central de respostas e aprendizado incremental.',
      tone: isAIEnabled() ? 'good' : 'warn',
    },
    {
      id: 'memory',
      label: 'Memoria',
      status: state.learningMetrics?.totalMemories > 0 ? 'Aquecida' : 'Vazia',
      detail: `${state.learningMetrics?.totalMemories || 0} contatos com contexto estruturado.`,
      tone: state.learningMetrics?.totalMemories > 0 ? 'good' : 'warn',
    },
    {
      id: 'voice',
      label: 'Base de voz',
      status: state.voiceMetrics?.contactsPreferringAudio > 0 ? 'Pronta' : 'Preparada',
      detail: `${state.voiceMetrics?.contactsPreferringAudio || 0} contatos com preferencia por audio.`,
      tone: 'good',
    },
    {
      id: 'docs',
      label: 'Documentacao',
      status: state.docsState?.lastGeneratedAt ? 'Gerada' : 'Pendente',
      detail: `${(state.docsState?.files || []).length} arquivos de analise disponiveis em docs/.`,
      tone: state.docsState?.lastGeneratedAt ? 'good' : 'warn',
    },
    {
      id: 'backend',
      label: 'Backend',
      status: runtime.backendStatus || 'unknown',
      detail: `Banco ${runtime.databaseStatus || 'unknown'} e WhatsApp ${runtime.whatsappStatus || 'unknown'}.`,
      tone:
        String(runtime.backendStatus || '').toLowerCase() === 'online'
          ? 'good'
          : runtime.backendStatus
            ? 'warn'
            : 'neutral',
    },
    {
      id: 'frontend',
      label: 'Frontend',
      status: runtime.frontendStatus || 'unknown',
      detail: 'Painel e endpoints da camada analitica compartilham a mesma telemetria.',
      tone:
        String(runtime.frontendStatus || '').toLowerCase() === 'online'
          ? 'good'
          : runtime.frontendStatus
            ? 'warn'
            : 'neutral',
    },
  ];
}

function buildPatterns(state, learningDashboard) {
  const topTags = Object.entries(
    (state.conversationMemory || []).reduce((accumulator, memory) => {
      for (const tag of memory.tags || []) {
        accumulator[tag] = (accumulator[tag] || 0) + 1;
      }

      return accumulator;
    }, {})
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ label: tag, value: count }));

  const topIntents = Object.entries(
    (state.conversationMemory || []).reduce((accumulator, memory) => {
      const intent = String(memory.intent || 'information');
      accumulator[intent] = (accumulator[intent] || 0) + 1;
      return accumulator;
    }, {})
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([intent, count]) => ({ label: intent, value: count }));

  return {
    frequentQuestions: learningDashboard?.frequentCustomerQuestions || [],
    topTags,
    topIntents,
  };
}

function buildTimeline(state) {
  const daily = new Map();

  for (const insight of state.insights || []) {
    const dateKey =
      String(insight.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const current = daily.get(dateKey) || { date: dateKey, insights: 0, improvements: 0 };
    current.insights += 1;
    daily.set(dateKey, current);
  }

  for (const improvement of state.improvements || []) {
    const dateKey =
      String(improvement.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const current = daily.get(dateKey) || { date: dateKey, insights: 0, improvements: 0 };
    current.improvements += 1;
    daily.set(dateKey, current);
  }

  return [...daily.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-7)
    .map((entry) => ({
      date: entry.date,
      label: entry.date.slice(5),
      leads: entry.improvements,
      messages: entry.insights,
    }));
}

function buildPanelData(store, runtime = {}) {
  const state = ensureState(store);
  const learningDashboard = runtime.learningDashboard || aiLearningEngine.buildDashboard(store);
  const reports = runtime.engineeringReport || state.reports || {};
  const pendingImprovements = (state.improvements || []).filter((item) => item.status === 'pending');
  const approvedImprovements = (state.improvements || []).filter((item) => item.status === 'approved');
  const appliedImprovements = (state.improvements || []).filter((item) => item.status === 'applied');

  rebuildLearningMetrics(state);

  return {
    generatedAt: new Date().toISOString(),
    state: {
      lastAnalyzedAt: state.lastAnalyzedAt,
      lastMessageObservedAt: state.lastMessageObservedAt,
      memoryReady: (state.conversationMemory || []).length > 0,
      openAiContextReady: true,
      voiceReady: true,
      docsReady: Boolean(state.docsState?.lastGeneratedAt),
      learningLoopMode: 'manual-approval',
    },
    metrics: {
      ...state.learningMetrics,
      pendingImprovements: pendingImprovements.length,
      approvedImprovements: approvedImprovements.length,
      appliedImprovements: appliedImprovements.length,
      docsGenerated: (state.docsState?.files || []).length,
      audioIntentDetected: state.voiceMetrics?.audioIntentDetected || 0,
      audioMessagesDetected: state.voiceMetrics?.audioMessagesDetected || 0,
    },
    docs: state.docsState,
    insights: (state.insights || []).slice(0, 24),
    improvements: (state.improvements || []).slice(0, 40),
    approvedSuggestions: approvedImprovements.slice(0, 10),
    patterns: buildPatterns(state, learningDashboard),
    timeline: buildTimeline(state),
    memory: {
      entries: (state.conversationMemory || []).slice(0, 40),
      totalContacts: (state.conversationMemory || []).length,
      contactsPreferringAudio: state.voiceMetrics?.contactsPreferringAudio || 0,
      recentAttention: (state.conversationMemory || [])
        .filter((entry) => entry.sentiment === 'negative' || entry.intent === 'purchase_intent')
        .slice(0, 12),
    },
    reports: {
      generatedAt: reports.generatedAt || null,
      currentState: reports.currentState || {},
      problemsFound: reports.problemsFound || [],
      improvementsRecommended: reports.improvementsRecommended || [],
      nextSteps: reports.nextSteps || [],
      learnedPatterns: reports.learnedPatterns || [],
    },
    healthStatusItems: buildHealthStatusItems(state),
  };
}

function listConversationMemory(store) {
  const state = ensureState(store);
  return state.conversationMemory || [];
}

function getConversationMemory(store, contactId) {
  const state = ensureState(store);
  return findMemoryByContact(state, contactId);
}

function getOpenAIContextForContact(store, contactId) {
  const memory = getConversationMemory(store, contactId);
  return buildOpenAIContext(memory);
}

async function updateImprovementStatus(store, improvementId, status) {
  const state = ensureState(store);
  const target = (state.improvements || []).find((item) => item.id === improvementId);

  if (!target) {
    return null;
  }

  target.status = status;
  target.updatedAt = new Date().toISOString();
  rebuildLearningMetrics(state);
  await persistState(store);
  return target;
}

module.exports = {
  buildPanelData,
  captureMessageEvent,
  ensureState,
  getConversationMemory,
  getOpenAIContextForContact,
  listConversationMemory,
  runFullAnalysis,
  updateImprovementStatus,
};
