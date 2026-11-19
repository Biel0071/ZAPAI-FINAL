'use strict';

const crypto = require('crypto');
const zlib = require('zlib');

const TOKEN_PREFIX = 'zctx1.';
const MAX_HIGHLIGHTS = 6;
const MAX_HIGHLIGHT_LEN = 130;
const MAX_FACTS = 12;
const MAX_FACT_LEN = 120;
const MAX_TAGS = 12;

const HIGH_SIGNAL_REGEX =
  /(r\$|reais|milheiro|caixa|churrasqueira|cimento|tijolo|bloco|telha|areia|brita|entrega|frete|pix|cart[aã]o|endere[cç]o|rua|bairro|cep|desconto|or[cç]amento|fechado|pedido|prazo|comprar|valor|pre[cç]o|litro)/i;

const POSITIVE_HINTS = ['obrigado', 'obrigada', 'perfeito', 'fechado', 'gostei', 'vamos', 'excelente', 'pode mandar'];
const NEGATIVE_HINTS = ['caro', 'problema', 'demorou', 'cancelar', 'nao gostei', 'não gostei', 'reclamar', 'errado'];

function getMemoryEngine() {
  return require('./conversationMemoryEngine');
}

function resolveKey() {
  const rawSecret =
    process.env.CONTEXT_TOKEN_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'zapai_context_token_key_2026';
  return crypto.createHash('sha256').update(String(rawSecret)).digest();
}

function cleanMessageText(raw = '') {
  return String(raw || '')
    .split('\n[META]')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value = '', maxLen = 130) {
  const text = String(value || '').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 3)).trim()}...`;
}

function isMeaningfulName(value, phone = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (['contato', 'cliente', 'unknown', 'cliente whatsapp'].includes(lower)) return false;
  if (/^cliente whatsapp #\d+$/i.test(trimmed) || /^grupo whatsapp #\d+$/i.test(trimmed)) return false;
  const digitsOnly = trimmed.replace(/\D/g, '');
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  if (digitsOnly && (digitsOnly === trimmed || (phoneDigits && digitsOnly === phoneDigits))) return false;
  if (trimmed.includes('@lid') || trimmed.includes('@s.whatsapp.net')) return false;
  return true;
}

function toValidDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minIso(a, b) {
  const da = toValidDate(a);
  const db = toValidDate(b);
  if (!da) return db ? db.toISOString() : null;
  if (!db) return da.toISOString();
  return da.getTime() <= db.getTime() ? da.toISOString() : db.toISOString();
}

function maxIso(a, b) {
  const da = toValidDate(a);
  const db = toValidDate(b);
  if (!da) return db ? db.toISOString() : null;
  if (!db) return da.toISOString();
  return da.getTime() >= db.getTime() ? da.toISOString() : db.toISOString();
}

function formatShortDate(iso) {
  const d = toValidDate(iso);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

function encodeContextToken(payload, companyId = 'default') {
  const jsonBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const compressed = zlib.brotliCompressSync(jsonBuf, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
    },
  });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', resolveKey(), iv);
  cipher.setAAD(Buffer.from(String(companyId || 'default'), 'utf8'));
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decodeContextToken(token, companyId = 'default') {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  try {
    const rest = token.slice(TOKEN_PREFIX.length);
    const parts = rest.split('.');
    if (parts.length !== 3) return null;

    const [ivB64, tagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const ciphertext = Buffer.from(cipherB64, 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return null;

    const decipher = crypto.createDecipheriv('aes-256-gcm', resolveKey(), iv);
    decipher.setAAD(Buffer.from(String(companyId || 'default'), 'utf8'));
    decipher.setAuthTag(tag);

    const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const plain = zlib.brotliDecompressSync(compressed).toString('utf8');
    const parsed = JSON.parse(plain);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function detectBatchSentiment(messages, fallbackSentiment = 'neutral') {
  let positive = 0;
  let negative = 0;

  for (const m of messages) {
    if (m.from_me) continue;
    const lower = cleanMessageText(m.content || m.text).toLowerCase();
    if (!lower) continue;
    for (const h of POSITIVE_HINTS) if (lower.includes(h)) positive += 1;
    for (const h of NEGATIVE_HINTS) if (lower.includes(h)) negative += 1;
  }

  if (negative > positive) return 'negative';
  if (positive > negative) return 'positive';
  return fallbackSentiment || 'neutral';
}

function selectHighlights(prevHighlights = [], messages = []) {
  const scored = [];
  const total = messages.length;

  messages.forEach((m, index) => {
    const text = cleanMessageText(m.content || m.text);
    if (!text || text.length < 2) return;
    const isClient = !m.from_me;
    let score = isClient ? 4 : 1;
    if (HIGH_SIGNAL_REGEX.test(text)) score += 6;
    if (/\d/.test(text)) score += 2;
    if (index >= total - 2) score += 4;
    scored.push({
      r: isClient ? 'c' : 'a',
      d: formatShortDate(m.effective_at || m.timestamp || m.created_at),
      t: truncate(text, MAX_HIGHLIGHT_LEN),
      score,
      order: index,
    });
  });

  scored.sort((a, b) => b.score - a.score || b.order - a.order);

  const combined = [
    ...scored.slice(0, MAX_HIGHLIGHTS).map(({ r, d, t }) => ({ r, d, t })),
    ...(Array.isArray(prevHighlights) ? prevHighlights : []),
  ];

  const seen = new Set();
  const deduped = [];
  for (const item of combined) {
    if (!item || !item.t) continue;
    const norm = `${item.r || 'c'}:${String(item.t).toLowerCase().trim()}`;
    if (seen.has(norm)) continue;
    seen.add(norm);
    deduped.push({
      r: item.r === 'a' ? 'a' : 'c',
      d: item.d || '',
      t: truncate(item.t, MAX_HIGHLIGHT_LEN),
    });
    if (deduped.length >= MAX_HIGHLIGHTS) break;
  }

  return deduped;
}

function mergeCommercialFields(...sources) {
  const merged = {
    activeProduct: null,
    capacity: null,
    quantity: null,
    quotedPrice: null,
    deliveryCity: null,
    neighborhood: null,
    paymentPreference: null,
  };

  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(merged)) {
      const val = src[key];
      if (typeof val === 'string' && val.trim()) {
        merged[key] = truncate(val.trim(), MAX_FACT_LEN);
      } else if (val !== null && val !== undefined && val !== '') {
        merged[key] = truncate(String(val), MAX_FACT_LEN);
      }
    }
  }

  return Object.fromEntries(Object.entries(merged).filter(([, v]) => Boolean(v)));
}

function mergeFacts(...factMaps) {
  const combined = new Map();

  for (const mapObj of factMaps) {
    if (!mapObj || typeof mapObj !== 'object') continue;
    for (const [k, raw] of Object.entries(mapObj)) {
      if (!raw || typeof raw !== 'object' || !raw.value) continue;
      combined.set(k, {
        key: raw.key || k,
        label: truncate(raw.label || raw.key || k, 48),
        value: truncate(String(raw.value), MAX_FACT_LEN),
        category: raw.category || 'customer_fact',
        importance: Math.min(10, Math.max(1, Number(raw.importance) || 5)),
        updatedAt: raw.updatedAt || null,
      });
    }
  }

  const top = [...combined.values()]
    .sort((a, b) => b.importance - a.importance || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, MAX_FACTS);

  const compactFacts = {};
  for (const item of top) {
    compactFacts[item.key] = {
      value: item.value,
      label: item.label,
      category: item.category,
      importance: item.importance,
    };
  }
  return compactFacts;
}

function buildCompactSummary(payload) {
  const parts = [];
  const periodFrom = formatShortDate(payload.from);
  const periodTo = formatShortDate(payload.to);
  const periodLabel = periodFrom && periodTo && periodFrom !== periodTo
    ? `${periodFrom} a ${periodTo}`
    : (periodTo || periodFrom || 'anteriores');

  parts.push(`Contexto compactado (${payload.cnt} msgs, ${periodLabel})`);

  const c = payload.commercial || {};
  const commParts = [c.activeProduct, c.capacity, c.quantity, c.deliveryCity, c.paymentPreference].filter(Boolean);
  if (commParts.length) {
    parts.push(commParts.join(' · '));
  }

  if (payload.intent && payload.intent !== 'information') {
    parts.push(`intenção: ${payload.intent}`);
  }

  const lastHighlight = Array.isArray(payload.highlights) && payload.highlights[0]?.t
    ? `"${payload.highlights[0].t}"`
    : '';
  if (lastHighlight) {
    parts.push(lastHighlight);
  }

  return truncate(parts.join(' | '), 240);
}

function mergeAndEncodeContextToken({
  existingToken = null,
  companyId = 'default',
  contactId = null,
  contactName = null,
  phone = null,
  messages = [],
  conversation = null,
  existingMemory = null,
} = {}) {
  const sortedMessages = [...(Array.isArray(messages) ? messages : [])].sort(
    (a, b) =>
      (toValidDate(a?.effective_at || a?.timestamp || a?.created_at)?.getTime() || 0) -
      (toValidDate(b?.effective_at || b?.timestamp || b?.created_at)?.getTime() || 0)
  );

  const prev =
    decodeContextToken(existingToken, companyId) ||
    decodeContextToken(existingMemory?.context_token, companyId) ||
    null;

  const { extractFactsFromContext } = getMemoryEngine();
  const tempMemory = {
    name: null,
    facts: {},
    commercial: {},
  };

  let batchInCnt = 0;
  let batchOutCnt = 0;
  let batchFrom = null;
  let batchTo = null;

  for (const m of sortedMessages) {
    const ts = toValidDate(m.effective_at || m.timestamp || m.created_at);
    if (ts) {
      batchFrom = minIso(batchFrom, ts);
      batchTo = maxIso(batchTo, ts);
    }

    if (m.from_me) {
      batchOutCnt += 1;
    } else {
      batchInCnt += 1;
      const text = cleanMessageText(m.content || m.text);
      if (text) {
        extractFactsFromContext(text, {}, tempMemory);
      }
    }
  }

  const existingMetrics =
    existingMemory?.metrics && typeof existingMemory.metrics === 'object'
      ? existingMemory.metrics
      : {};

  const resolvedPhone = String(phone || conversation?.phone || existingMemory?.phone || '').trim();
  const nameCandidates = [
    tempMemory.name,
    contactName,
    conversation?.name,
    existingMemory?.name,
    prev?.name,
  ];
  const resolvedName =
    nameCandidates.find((candidate) => isMeaningfulName(candidate, resolvedPhone)) ||
    prev?.name ||
    '';

  const commercial = mergeCommercialFields(
    prev?.commercial,
    existingMetrics.commercial,
    tempMemory.commercial
  );
  const facts = mergeFacts(prev?.facts, existingMetrics.facts, tempMemory.facts);
  const tags = [
    ...new Set(
      [
        ...(Array.isArray(prev?.tags) ? prev.tags : []),
        ...(Array.isArray(conversation?.tags) ? conversation.tags : []),
        ...(Array.isArray(existingMemory?.tags) ? existingMemory.tags : []),
      ]
        .map((t) => String(t || '').trim())
        .filter(Boolean)
    ),
  ].slice(0, MAX_TAGS);

  const highlights = selectHighlights(prev?.highlights, sortedMessages);
  const cnt = (Number(prev?.cnt) || 0) + sortedMessages.length;
  const inCnt = (Number(prev?.inCnt) || 0) + batchInCnt;
  const outCnt = (Number(prev?.outCnt) || 0) + batchOutCnt;

  const payload = {
    v: 1,
    cid: String(contactId || resolvedPhone || prev?.cid || 'unknown').trim(),
    ...(resolvedName ? { name: truncate(resolvedName, 60) } : {}),
    cnt,
    inCnt,
    outCnt,
    from: minIso(prev?.from, batchFrom),
    to: maxIso(prev?.to, batchTo),
    intent: String(conversation?.lead_intent || existingMemory?.intent || prev?.intent || 'information'),
    sentiment: detectBatchSentiment(sortedMessages, existingMemory?.sentiment || prev?.sentiment || 'neutral'),
    stage: String(conversation?.funnel_stage || prev?.stage || 'new_lead'),
    tags,
    commercial,
    facts,
    highlights,
  };

  const token = encodeContextToken(payload, companyId);
  const meta = {
    version: 1,
    prunedMessagesCount: payload.cnt,
    from: payload.from,
    to: payload.to,
    byteLength: Buffer.byteLength(token, 'utf8'),
    updatedAt: new Date().toISOString(),
  };

  return {
    token,
    meta,
    decoded: payload,
    compactSummary: buildCompactSummary(payload),
  };
}

function formatContextTokenForPrompt(decoded) {
  if (!decoded || typeof decoded !== 'object') return '';

  const lines = ['[TOKEN DE CONTEXTO CRIPTOGRAFADO — HISTÓRICO ANTERIOR COMPACTADO]'];
  const fromDate = formatShortDate(decoded.from);
  const toDate = formatShortDate(decoded.to);
  lines.push(
    `- Histórico selado: ${decoded.cnt || 0} mensagens arquivadas (${decoded.inCnt || 0} recebidas / ${decoded.outCnt || 0} enviadas)` +
      (fromDate || toDate ? `, período ${fromDate || '?'} até ${toDate || '?'}` : '')
  );

  if (decoded.name) {
    lines.push(`- Nome identificado no histórico: ${decoded.name}`);
  }
  if (decoded.intent || decoded.stage) {
    lines.push(`- Estágio/Intenção prévia: estágio=${decoded.stage || 'new_lead'}, intenção=${decoded.intent || 'information'}, sentimento=${decoded.sentiment || 'neutral'}`);
  }

  const commEntries = Object.entries(decoded.commercial || {}).filter(([, v]) => Boolean(v));
  if (commEntries.length) {
    lines.push(`- Contexto comercial prévio: ${commEntries.map(([k, v]) => `${k}: ${v}`).join(' | ')}`);
  }

  const factEntries = Object.values(decoded.facts || {});
  if (factEntries.length) {
    lines.push('- Fatos preservados antes da limpeza:');
    for (const f of factEntries.slice(0, 8)) {
      lines.push(`  • ${f.label || f.key}: ${f.value}`);
    }
  }

  const highlights = Array.isArray(decoded.highlights) ? decoded.highlights : [];
  if (highlights.length) {
    lines.push('- Trechos-chave da conversa anterior:');
    for (const h of highlights.slice(0, MAX_HIGHLIGHTS)) {
      const who = h.r === 'a' ? 'Atendente/IA' : 'Cliente';
      lines.push(`  • [${h.d || 'antigo'} ${who}]: ${h.t}`);
    }
  }

  return lines.join('\n');
}

function toContextCapsule(token, companyId = 'default', meta = null) {
  const decoded = decodeContextToken(token, companyId);
  if (!decoded) return null;

  return {
    active: true,
    tokenPreview: `${token.slice(0, 18)}...${token.slice(-6)}`,
    byteLength: Number(meta?.byteLength) || Buffer.byteLength(token, 'utf8'),
    prunedMessagesCount: Number(decoded.cnt || meta?.prunedMessagesCount || 0),
    from: decoded.from || meta?.from || null,
    to: decoded.to || meta?.to || null,
    intent: decoded.intent || 'information',
    stage: decoded.stage || 'new_lead',
    commercial: decoded.commercial || {},
    facts: decoded.facts || {},
    highlights: Array.isArray(decoded.highlights) ? decoded.highlights : [],
    summary: buildCompactSummary(decoded),
  };
}

module.exports = {
  TOKEN_PREFIX,
  cleanMessageText,
  encodeContextToken,
  decodeContextToken,
  mergeAndEncodeContextToken,
  formatContextTokenForPrompt,
  toContextCapsule,
};
