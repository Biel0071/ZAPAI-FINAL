'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const laya = require('../services/layaDecisionService');
const aiModelRouter = require('../services/aiModelRouter');
const aiCredentialVault = require('../services/aiCredentialVault');

function fakeHttp(response, calls = []) {
  return {
    post: async (url, body, opts) => {
      calls.push({ url, body, opts });
      if (response instanceof Error) throw response;
      return { data: response };
    },
  };
}

const GOOD_RESPONSE = {
  id: 'dec_1',
  model: 'laya-rl-agent',
  answers: {
    intent: { type: 'choice', choice: 'payment', probabilities: { payment: 0.9, other: 0.1 }, confidence: 0.7 },
    urgent: { type: 'noul', noul: 0.81, confidence: 0.81 },
    wants_human: { type: 'noul', noul: 0.05, confidence: 0.95 },
    frustration: { type: 'score', score: 2.31, probabilities: { 0: 0.1, 1: 0.2, 2: 0.4, 3: 0.3 }, confidence: 0.34 },
  },
  usage: { input_tokens: 212, output_tokens: 0 },
  routing: { model: 'multilingual', repo: 'convaiinnovations/laya', reason: 'non-English text' },
};

describe('Laya Fast Lane — provedor de decisão', () => {
  it('registra o Laya como provedor de DECISÃO e resolve aliases e base URL', () => {
    const def = aiModelRouter.PROVIDER_DEFINITIONS.find((p) => p.id === 'laya');
    assert.ok(def, 'laya deve existir no catálogo');
    assert.equal(def.kind, 'decision');
    assert.equal(def.requiresClientKey, true);
    assert.deepEqual(def.models, ['multilingual', 'english', 'typed-decisions']);
    assert.equal(aiCredentialVault.normalizeProviderId('fastlane'), 'laya');
    assert.equal(aiCredentialVault.normalizeProviderId('Laya_Studio'), 'laya');
    assert.equal(aiModelRouter.resolveBaseUrl('laya'), 'https://api.laya.studio');
    assert.equal(aiModelRouter.getModelMeta('multilingual', 'laya').category, 'decision');
  });

  it('monta o pedido no formato oficial e valida perguntas', () => {
    const body = laya.buildRequestBody({
      text: '  Fui cobrado duas vezes  ',
      questions: laya.buildTriageQuestions(),
      model: 'multilingual',
    });
    assert.deepEqual(body.state, { message: 'Fui cobrado duas vezes' });
    assert.equal(body.model, 'multilingual');
    assert.equal(body.questions.urgent.type, 'noul');

    assert.throws(() => laya.buildRequestBody({ text: '', questions: laya.buildTriageQuestions() }), /LAYA_INVALID_STATE/);
    assert.throws(() => laya.validateQuestions({}), /LAYA_INVALID_QUESTIONS/);
    assert.throws(() => laya.validateQuestions({ q: { type: 'free_text', instructions: 'x' } }), /tipo inválido/);
    assert.throws(() => laya.validateQuestions({ q: { type: 'choice', instructions: 'x', criteria: ['so_uma'] } }), /pelo menos 2 opções/);
    const tooMany = {};
    for (let i = 0; i < 33; i += 1) tooMany[`q${i}`] = { type: 'noul', instructions: 'x' };
    assert.throws(() => laya.validateQuestions(tooMany), /máximo de 32/);
  });

  it('chama /v1/systemone com Bearer e normaliza a resposta', async () => {
    const calls = [];
    const r = await laya.decide({
      apiKey: 'lsk_live_TESTE',
      text: 'Cobrança duplicada',
      questions: laya.buildTriageQuestions(),
      httpClient: fakeHttp(GOOD_RESPONSE, calls),
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.laya.studio/v1/systemone');
    assert.equal(calls[0].opts.headers.Authorization, 'Bearer lsk_live_TESTE');
    assert.equal(r.answers.intent.value, 'payment');
    assert.equal(r.answers.urgent.value, 0.81);
    assert.equal(r.answers.frustration.value, 2.31);
    assert.equal(r.model, 'multilingual');
    assert.equal(r.usage.output_tokens, 0);
  });

  it('triageMessage devolve só sinais, sem política de escalonamento', async () => {
    const t = await laya.triageMessage({ apiKey: 'k', text: 'Quero falar com alguém', httpClient: fakeHttp(GOOD_RESPONSE) });
    assert.equal(t.intent.label, 'payment');
    assert.equal(t.wantsHuman.probability, 0.05);
    assert.equal(t.urgent.probability, 0.81);
    assert.equal(t.frustration.score, 2.31);
    assert.equal('shouldEscalate' in t, false);
  });

  it('falha sem chave e propaga erros HTTP do provedor', async () => {
    await assert.rejects(laya.decide({ text: 'oi', questions: laya.buildTriageQuestions(), httpClient: fakeHttp({}) }), /LAYA_API_KEY_MISSING/);
    const httpErr = Object.assign(new Error('Request failed'), { response: { status: 401, data: { error: { message: 'invalid key' } } } });
    await assert.rejects(
      laya.decide({ apiKey: 'ruim', text: 'oi', questions: laya.buildTriageQuestions(), httpClient: fakeHttp(httpErr) }),
      (e) => e.response.status === 401,
    );
  });

  it('probe usa uma única pergunta mínima', async () => {
    const calls = [];
    const r = await laya.probe({
      apiKey: 'k',
      httpClient: fakeHttp({ answers: { greeting: { type: 'noul', noul: 0.97, confidence: 0.97 } }, routing: { model: 'multilingual' } }, calls),
    });
    assert.equal(Object.keys(calls[0].body.questions).length, 1);
    assert.equal(r.reply, 'noul=0.97');
    assert.ok(r.latencyMs >= 0);
  });

  it('probeProvider(laya) sem chave retorna unconfigured e nunca cai no chat', async () => {
    const r = await aiModelRouter.probeProvider({ providerId: 'laya', scope: 'master', companyId: '__laya_unit_test__' });
    assert.equal(r.ok, false);
    assert.equal(r.healthStatus, 'unconfigured');
    assert.match(r.error, /API key ausente/);
  });
});
