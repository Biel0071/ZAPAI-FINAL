const { analyzeLeadIntent } = require('./leadAnalyzer');

const POSITIVE_PATTERNS = [
  'obrigado',
  'obrigada',
  'valeu',
  'perfeito',
  'excelente',
  'gostei',
  'fechado',
  'vamos',
];

const NEGATIVE_PATTERNS = [
  'ruim',
  'pessimo',
  'péssimo',
  'problema',
  'caro',
  'demorou',
  'lento',
  'nao gostei',
  'não gostei',
  'cancelar',
];

const AUDIO_PATTERNS = [
  'audio',
  'áudio',
  'manda audio',
  'responde por audio',
  'me chama por audio',
  'me chama por ligação',
  'me chama por ligacao',
  'ligacao',
  'ligação',
  'voice',
  'voz',
];

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function truncate(value = '', maxLength = 160) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function detectAudioIntent(text = '', mediaType = '') {
  const normalizedText = normalizeText(text);
  const normalizedMediaType = normalizeText(mediaType);

  if (normalizedMediaType.includes('audio') || normalizedMediaType.includes('ptt')) {
    return true;
  }

  return AUDIO_PATTERNS.some((pattern) => normalizedText.includes(normalizeText(pattern)));
}

function detectSentiment(messages = []) {
  const clientMessages = messages
    .filter((message) => message?.from === 'contact')
    .slice(-8)
    .map((message) => normalizeText(message?.text || ''));

  if (clientMessages.length === 0) {
    return 'neutral';
  }

  const positiveScore = clientMessages.reduce(
    (total, entry) =>
      total + POSITIVE_PATTERNS.reduce((sum, pattern) => sum + Number(entry.includes(pattern)), 0),
    0
  );
  const negativeScore = clientMessages.reduce(
    (total, entry) =>
      total + NEGATIVE_PATTERNS.reduce((sum, pattern) => sum + Number(entry.includes(pattern)), 0),
    0
  );

  if (negativeScore > positiveScore) {
    return 'negative';
  }

  if (positiveScore > negativeScore) {
    return 'positive';
  }

  return 'neutral';
}

function buildSummary(memory) {
  const lastContactMessage = [...(memory.messages || [])]
    .reverse()
    .find((message) => message?.from === 'contact' && String(message?.text || '').trim());
  const summaryParts = [];

  if (memory.name || memory.phone) {
    summaryParts.push(`${memory.name || 'Contato'} (${memory.phone || memory.contact_id})`);
  }

  if (memory.intent) {
    summaryParts.push(`intencao atual: ${memory.intent}`);
  }

  if (memory.sentiment && memory.sentiment !== 'neutral') {
    summaryParts.push(`sentimento ${memory.sentiment}`);
  }

  if (memory.tags?.length) {
    summaryParts.push(`tags: ${memory.tags.slice(0, 4).join(', ')}`);
  }

  if (lastContactMessage?.text) {
    summaryParts.push(`ultima demanda: "${truncate(lastContactMessage.text, 96)}"`);
  }

  if (summaryParts.length === 0) {
    return 'Sem contexto suficiente para resumir a conversa.';
  }

  return summaryParts.join(' | ');
}

function buildMessageSnapshot(event = {}) {
  const role = event.direction === 'outgoing' ? 'agent' : 'contact';
  return {
    id: String(event.messageId || '').trim() || `mem-${Date.now()}`,
    from: role,
    mediaType: event.mediaType || null,
    source: event.source || null,
    text: truncate(event.text || '', 300),
    timestamp: event.timestamp || new Date().toISOString(),
  };
}

function extractTags(memory, snapshot, leadIntent) {
  const tags = [];
  const normalizedText = normalizeText(snapshot?.text || '');
  const normalizedMediaType = normalizeText(snapshot?.mediaType || '');

  if (leadIntent?.intent) {
    tags.push(leadIntent.intent);
  }

  if (memory.sentiment === 'negative') {
    tags.push('needs_attention');
  }

  if (normalizedText.includes('?')) {
    tags.push('question');
  }

  if (detectAudioIntent(snapshot?.text, snapshot?.mediaType)) {
    tags.push('voice_requested');
  }

  if (normalizedMediaType) {
    tags.push('has_media');
  }

  if (normalizedMediaType.includes('audio') || normalizedMediaType.includes('ptt')) {
    tags.push('voice_message');
  }

  return unique([...(memory.tags || []), ...tags]).slice(0, 12);
}

function buildLeadHistory(messages = []) {
  return messages
    .filter((message) => message?.from === 'contact')
    .map((message) => ({
      from: 'client',
      text: String(message?.text || ''),
    }))
    .slice(-12);
}

function ensureMemoryEntry(state, event = {}) {
  if (!Array.isArray(state.conversationMemory)) {
    state.conversationMemory = [];
  }

  const normalizedPhone = String(event.phone || '').trim();
  const contactId = String(event.contactId || normalizedPhone || '').trim();
  const conversationId = String(event.conversationId || '').trim() || null;

  let memory = state.conversationMemory.find((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    return (
      String(entry.contact_id || '').trim() === contactId ||
      (normalizedPhone && String(entry.phone || '').trim() === normalizedPhone) ||
      (conversationId && String(entry.conversation_id || '').trim() === conversationId)
    );
  });

  if (!memory) {
    memory = {
      contact_id: contactId || normalizedPhone || `contact-${Date.now()}`,
      conversation_id: conversationId,
      phone: normalizedPhone || null,
      name: event.name || normalizedPhone || 'Contato',
      messages: [],
      summary: '',
      tags: [],
      intent: 'information',
      sentiment: 'neutral',
      last_updated: null,
      metrics: {
        inboundMessages: 0,
        outboundMessages: 0,
        audioMessages: 0,
        audioRequests: 0,
        prefersAudio: false,
        totalMessages: 0,
      },
    };

    state.conversationMemory.push(memory);
  }

  return memory;
}

function sortByLastUpdated(memoryEntries = []) {
  return [...memoryEntries].sort(
    (left, right) =>
      new Date(right?.last_updated || 0).getTime() - new Date(left?.last_updated || 0).getTime()
  );
}

function updateConversationMemory(state, event = {}) {
  const memory = ensureMemoryEntry(state, event);
  const snapshot = buildMessageSnapshot(event);
  const audioRequestedByContact =
    event.direction !== 'outgoing' && detectAudioIntent(snapshot.text, '');
  const audioMediaDetected =
    event.direction !== 'outgoing' && detectAudioIntent('', snapshot.mediaType || '');
  const snapshotKey = `${snapshot.id}:${snapshot.timestamp}:${snapshot.text}`;
  const existingKeys = new Set(
    (memory.messages || []).map(
      (message) => `${message?.id || ''}:${message?.timestamp || ''}:${message?.text || ''}`
    )
  );

  if (!existingKeys.has(snapshotKey)) {
    memory.messages = [...(memory.messages || []), snapshot].slice(-40);
  }

  memory.phone = event.phone || memory.phone || null;
  memory.name = event.name || memory.name || memory.phone || 'Contato';
  memory.conversation_id = event.conversationId || memory.conversation_id || null;
  memory.last_updated = event.timestamp || new Date().toISOString();

  const leadIntent = analyzeLeadIntent(snapshot.text || '', buildLeadHistory(memory.messages));
  memory.intent = leadIntent.intent || memory.intent || 'information';
  memory.sentiment = detectSentiment(memory.messages);
  memory.tags = extractTags(memory, snapshot, leadIntent);
  memory.summary = buildSummary(memory);
  memory.metrics = {
    inboundMessages:
      (memory.metrics?.inboundMessages || 0) + Number(event.direction !== 'outgoing'),
    outboundMessages:
      (memory.metrics?.outboundMessages || 0) + Number(event.direction === 'outgoing'),
    audioMessages: (memory.metrics?.audioMessages || 0) + Number(audioMediaDetected),
    audioRequests: (memory.metrics?.audioRequests || 0) + Number(audioRequestedByContact),
    prefersAudio:
      Boolean(memory.metrics?.prefersAudio) || audioRequestedByContact || audioMediaDetected,
    totalMessages: (memory.messages || []).length,
  };

  state.conversationMemory = sortByLastUpdated(state.conversationMemory).slice(0, 500);

  return {
    audioIntentDetected: audioRequestedByContact,
    audioMessageDetected: audioMediaDetected,
    memory,
  };
}

function buildOpenAIContext(memoryEntry) {
  if (!memoryEntry || typeof memoryEntry !== 'object') {
    return null;
  }

  return {
    contactId: memoryEntry.contact_id,
    phone: memoryEntry.phone || null,
    name: memoryEntry.name || null,
    summary: memoryEntry.summary || '',
    tags: Array.isArray(memoryEntry.tags) ? memoryEntry.tags : [],
    intent: memoryEntry.intent || 'information',
    sentiment: memoryEntry.sentiment || 'neutral',
    prefersAudio: Boolean(memoryEntry.metrics?.prefersAudio),
    history: (memoryEntry.messages || []).slice(-12).map((message) => ({
      role: message?.from === 'agent' ? 'assistant' : 'user',
      content: message?.text || `[${message?.mediaType || 'mensagem'}]`,
      timestamp: message?.timestamp || new Date().toISOString(),
    })),
  };
}

function findMemoryByContact(state, contactId) {
  const normalized = String(contactId || '').trim();
  if (!normalized || !Array.isArray(state?.conversationMemory)) {
    return null;
  }

  return (
    state.conversationMemory.find((entry) => {
      return (
        String(entry?.contact_id || '').trim() === normalized ||
        String(entry?.phone || '').trim() === normalized ||
        String(entry?.conversation_id || '').trim() === normalized
      );
    }) || null
  );
}

module.exports = {
  buildOpenAIContext,
  detectAudioIntent,
  findMemoryByContact,
  updateConversationMemory,
};
