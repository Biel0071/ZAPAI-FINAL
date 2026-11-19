'use strict';

/**
 * Laya Studio — API de DECISÃO (fast lane de triagem).
 *
 * IMPORTANTE: o Laya NÃO gera texto. Ele responde perguntas tipadas sobre um texto
 * (choice / score / noul) com probabilidades em ~0,1 s. Por isso ele é registrado no
 * roteador como provedor `kind: 'decision'` e NUNCA entra na cadeia de respostas de chat.
 *
 * Contrato (documentação oficial https://laya.studio/docs):
 *   POST {base}/v1/systemone    Authorization: Bearer lsk_live_…
 *   body: { state: { message }, questions: { <id>: { type, instructions, criteria? } }, model? }
 *   resp: { answers: { <id>: { type, choice|noul|score, probabilities, confidence } }, usage, routing }
 *
 * Privacidade: o texto enviado é processado em servidores da Laya na Suíça (sem retenção, segundo o
 * provedor). Só enviar mensagens de clientes quando isso for aceitável para o tenant.
 */

const axios = require('axios');

const DEFAULT_BASE_URL = 'https://api.laya.studio';
const MODELS = Object.freeze(['multilingual', 'english', 'typed-decisions']);
const QUESTION_TYPES = Object.freeze(['choice', 'score', 'noul']);
const LIMITS = Object.freeze({ maxQuestions: 32, maxOptions: 64 });

function getBaseUrl() {
  return String(process.env.LAYA_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
}

function optionCount(criteria) {
  if (Array.isArray(criteria)) return criteria.length;
  if (criteria && typeof criteria === 'object') return Object.keys(criteria).length;
  return 0;
}

function validateQuestions(questions) {
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
    throw new Error('LAYA_INVALID_QUESTIONS: informe um objeto { id: pergunta }.');
  }
  const ids = Object.keys(questions);
  if (ids.length === 0) throw new Error('LAYA_INVALID_QUESTIONS: pelo menos uma pergunta é obrigatória.');
  if (ids.length > LIMITS.maxQuestions) {
    throw new Error(`LAYA_INVALID_QUESTIONS: máximo de ${LIMITS.maxQuestions} perguntas por chamada.`);
  }
  for (const id of ids) {
    const q = questions[id];
    if (!q || !QUESTION_TYPES.includes(q.type)) {
      throw new Error(`LAYA_INVALID_QUESTIONS: tipo inválido em "${id}" (use ${QUESTION_TYPES.join(', ')}).`);
    }
    if (!String(q.instructions || '').trim()) {
      throw new Error(`LAYA_INVALID_QUESTIONS: "${id}" precisa de instructions.`);
    }
    if ((q.type === 'choice' || q.type === 'score') && optionCount(q.criteria) < 2) {
      throw new Error(`LAYA_INVALID_QUESTIONS: "${id}" precisa de pelo menos 2 opções em criteria.`);
    }
    if (optionCount(q.criteria) > LIMITS.maxOptions) {
      throw new Error(`LAYA_INVALID_QUESTIONS: "${id}" excede ${LIMITS.maxOptions} opções.`);
    }
  }
  return ids;
}

function buildRequestBody({ text, questions, model } = {}) {
  validateQuestions(questions);
  const message = String(text == null ? '' : text).trim();
  if (!message) throw new Error('LAYA_INVALID_STATE: texto vazio.');
  const body = { state: { message }, questions };
  if (model && MODELS.includes(model)) body.model = model;
  return body;
}

function normalizeAnswers(data) {
  const out = {};
  const answers = (data && data.answers) || {};
  for (const [id, a] of Object.entries(answers)) {
    if (!a || typeof a !== 'object') continue;
    const value = a.type === 'choice' ? a.choice : a.type === 'noul' ? a.noul : a.score;
    out[id] = {
      type: a.type,
      value,
      confidence: typeof a.confidence === 'number' ? a.confidence : null,
      probabilities: a.probabilities || null,
    };
  }
  return out;
}

async function decide({ apiKey, text, questions, model = 'multilingual', timeoutMs = 8000, baseUrl, httpClient = axios } = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('LAYA_API_KEY_MISSING');
  const body = buildRequestBody({ text, questions, model });
  const startedAt = Date.now();
  const res = await httpClient.post(`${baseUrl || getBaseUrl()}/v1/systemone`, body, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    timeout: timeoutMs,
  });
  return {
    latencyMs: Date.now() - startedAt,
    model: (res.data && res.data.routing && res.data.routing.model) || model,
    answers: normalizeAnswers(res.data),
    usage: (res.data && res.data.usage) || null,
  };
}

/** Perguntas padrão de triagem para mensagens de clientes em pt-BR (modelo multilingual). */
function buildTriageQuestions() {
  return {
    intent: {
      type: 'choice',
      instructions: 'O que o cliente quer?',
      criteria: {
        purchase: 'quer comprar, pedir preço ou orçamento',
        support: 'problema, defeito ou dúvida de uso',
        payment: 'pagamento, cobrança, boleto ou Pix',
        delivery: 'entrega, prazo ou rastreio',
        complaint: 'reclamação ou insatisfação',
        other: 'qualquer outro assunto',
      },
    },
    urgent: { type: 'noul', instructions: 'A mensagem comunica urgência ou pressa?' },
    wants_human: { type: 'noul', instructions: 'O cliente pede para falar com uma pessoa ou atendente humano?' },
    frustration: {
      type: 'score',
      instructions: 'Quão frustrado o cliente parece?',
      criteria: ['calmo', 'preocupado', 'irritado', 'muito irritado'],
    },
  };
}

/** Triagem fast lane: devolve os sinais normalizados. NÃO decide escalonamento (política fica com o chamador). */
async function triageMessage({ apiKey, text, model = 'multilingual', timeoutMs, baseUrl, httpClient } = {}) {
  const r = await decide({ apiKey, text, questions: buildTriageQuestions(), model, timeoutMs, baseUrl, httpClient });
  const a = r.answers;
  return {
    latencyMs: r.latencyMs,
    model: r.model,
    intent: a.intent ? { label: a.intent.value, confidence: a.intent.confidence } : null,
    urgent: a.urgent ? { probability: a.urgent.value, confidence: a.urgent.confidence } : null,
    wantsHuman: a.wants_human ? { probability: a.wants_human.value, confidence: a.wants_human.confidence } : null,
    frustration: a.frustration ? { score: a.frustration.value, confidence: a.frustration.confidence } : null,
    usage: r.usage,
  };
}

/** Teste de conexão do painel: 1 pergunta sim/não mínima. Mesmo formato de retorno do callSingleCandidate. */
async function probe({ apiKey, model = 'multilingual', timeoutMs = 10000, baseUrl, httpClient } = {}) {
  const r = await decide({
    apiKey,
    text: 'Olá, tudo bem?',
    questions: { greeting: { type: 'noul', instructions: 'A mensagem é uma saudação?' } },
    model,
    timeoutMs,
    baseUrl,
    httpClient,
  });
  const g = r.answers.greeting;
  return { latencyMs: r.latencyMs, reply: g ? `noul=${g.value}` : 'ok' };
}

module.exports = {
  DEFAULT_BASE_URL,
  MODELS,
  LIMITS,
  getBaseUrl,
  validateQuestions,
  buildRequestBody,
  normalizeAnswers,
  decide,
  buildTriageQuestions,
  triageMessage,
  probe,
};
