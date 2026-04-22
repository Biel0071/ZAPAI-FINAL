const fs = require('fs/promises');
const path = require('path');

const dataDirectory = path.join(__dirname, '..', 'data');
const aiIntelligenceStateFilePath = path.join(dataDirectory, 'ai_intelligence_state.json');

function createDefaultState() {
  return {
    version: 1,
    lastAnalyzedAt: null,
    lastMessageObservedAt: null,
    conversationMemory: [],
    insights: [],
    improvements: [],
    reports: {
      generatedAt: null,
      currentState: {},
      problemsFound: [],
      improvementsRecommended: [],
      nextSteps: [],
      learnedPatterns: [],
    },
    voiceMetrics: {
      audioIntentDetected: 0,
      audioMessagesDetected: 0,
      contactsPreferringAudio: 0,
      lastUpdated: null,
    },
    docsState: {
      lastGeneratedAt: null,
      files: [],
    },
    learningMetrics: {
      totalMemories: 0,
      summarizedMemories: 0,
      insightsGenerated: 0,
      suggestionsPending: 0,
      suggestionsApproved: 0,
      suggestionsApplied: 0,
    },
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeState(rawState) {
  const defaults = createDefaultState();
  const state = rawState && typeof rawState === 'object' ? rawState : {};
  const reports =
    state.reports && typeof state.reports === 'object' ? state.reports : defaults.reports;
  const voiceMetrics =
    state.voiceMetrics && typeof state.voiceMetrics === 'object'
      ? state.voiceMetrics
      : defaults.voiceMetrics;
  const docsState =
    state.docsState && typeof state.docsState === 'object' ? state.docsState : defaults.docsState;
  const learningMetrics =
    state.learningMetrics && typeof state.learningMetrics === 'object'
      ? state.learningMetrics
      : defaults.learningMetrics;

  return {
    ...defaults,
    ...state,
    conversationMemory: normalizeArray(state.conversationMemory),
    insights: normalizeArray(state.insights),
    improvements: normalizeArray(state.improvements),
    reports: {
      ...defaults.reports,
      ...reports,
      problemsFound: normalizeArray(reports.problemsFound),
      improvementsRecommended: normalizeArray(reports.improvementsRecommended),
      nextSteps: normalizeArray(reports.nextSteps),
      learnedPatterns: normalizeArray(reports.learnedPatterns),
    },
    voiceMetrics: {
      ...defaults.voiceMetrics,
      ...voiceMetrics,
    },
    docsState: {
      ...defaults.docsState,
      ...docsState,
      files: normalizeArray(docsState.files),
    },
    learningMetrics: {
      ...defaults.learningMetrics,
      ...learningMetrics,
    },
  };
}

async function ensureDataFile() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    await fs.access(aiIntelligenceStateFilePath);
  } catch {
    await fs.writeFile(
      aiIntelligenceStateFilePath,
      JSON.stringify(createDefaultState(), null, 2),
      'utf8'
    );
  }
}

async function loadAiIntelligenceState() {
  await ensureDataFile();

  try {
    const raw = await fs.readFile(aiIntelligenceStateFilePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return normalizeState(parsed);
  } catch {
    return createDefaultState();
  }
}

async function saveAiIntelligenceState(state) {
  await ensureDataFile();
  const normalized = normalizeState(state);
  await fs.writeFile(aiIntelligenceStateFilePath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

module.exports = {
  aiIntelligenceStateFilePath,
  createDefaultState,
  loadAiIntelligenceState,
  normalizeState,
  saveAiIntelligenceState,
};
