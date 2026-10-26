const assert = require('assert');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const aiLocalBrainService = require('../backend/services/aiLocalBrainService');
const quickReplyCapability = require('../backend/services/quickReplyCapability');
const { testProviderConnection, testAIConnection } = require('../backend/services/ai.service');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 TEST SUITE: ROTA RÁPIDA VPS & GATEWAY MULTI-MODELOS');
  console.log('====================================================\n');

  // TEST 1: Rota Rápida VPS - Consulta direta de Cimento
  console.log('[TEST 1] Rota Rápida: "Qual o valor do cimento CP2?"');
  const cimentoMatch = await aiLocalBrainService.queryLocalBrain('camila', 'default', 'Qual o valor do cimento CP2?');
  assert(cimentoMatch !== null, 'Deveria ter encontrado correspondência na Rota Rápida');
  assert(cimentoMatch.text.toLowerCase().includes('cimento'), 'A resposta deve conter dados de cimento');
  console.log(`✅ [TEST 1 PASSED] Resposta instantânea gerada (${cimentoMatch.source}, Score: ${cimentoMatch.score}):`);
  console.log(`   "${cimentoMatch.text.substring(0, 80)}..."\n`);

  // TEST 2: Rota Rápida VPS - Foto de Churrasqueira com send_media acoplada
  console.log('[TEST 2] Rota Rápida Multimodal: "Tem fotos da churrasqueira?"');
  const churrasMatch = await aiLocalBrainService.queryLocalBrain('camila', 'default', 'Tem fotos da churrasqueira?');
  assert(churrasMatch !== null, 'Deveria ter encontrado churrasqueira');
  assert(churrasMatch.send_media && churrasMatch.send_media.type === 'image', 'Deve incluir send_media do tipo image');
  assert(Boolean(churrasMatch.send_media.value), 'Deve apontar para mídia/URL da churrasqueira');
  console.log(`✅ [TEST 2 PASSED] Imagem acoplada com sucesso: ${churrasMatch.send_media.value}`);
  console.log(`   Legenda/Texto: "${churrasMatch.text.substring(0, 80)}..."\n`);

  // TEST 3: Rota Rápida VPS - Garantia (Texto e Áudio)
  console.log('[TEST 3] Rota Rápida: "Como funciona a garantia do produto?"');
  const garantiaMatch = await aiLocalBrainService.queryLocalBrain('camila', 'default', 'Como funciona a garantia do produto?');
  assert(garantiaMatch !== null, 'Deveria ter encontrado garantia');
  assert(garantiaMatch.text.toLowerCase().includes('garantia') || garantiaMatch.text.toLowerCase().includes('pagamento') || garantiaMatch.title.toLowerCase().includes('garantia'), 'Deve conter texto de garantia');
  console.log(`✅ [TEST 3.1 PASSED] Resposta de garantia gerada: "${garantiaMatch.text.substring(0, 60)}..."`);

  console.log('[TEST 3.2] Rota Rápida com Áudio Explícito: "Manda um áudio sobre a garantia"');
  const garantiaAudioMatch = await aiLocalBrainService.queryLocalBrain('camila', 'default', 'Manda um áudio sobre a garantia');
  assert(garantiaAudioMatch !== null, 'Deveria encontrar áudio da garantia');
  assert(garantiaAudioMatch.send_media && garantiaAudioMatch.send_media.type === 'audio', 'Deve incluir mídia tipo audio');
  assert(garantiaAudioMatch.send_media.value.includes('garantia'), 'Deve apontar para áudio de garantia');
  console.log(`✅ [TEST 3.2 PASSED] Áudio oficial acoplado: ${garantiaAudioMatch.send_media.value}\n`);

  // TEST 4: Rota Rápida VPS - Dados de PIX
  console.log('[TEST 4] Rota Rápida: "Vocês aceitam PIX?"');
  const pixMatch = await aiLocalBrainService.queryLocalBrain('camila', 'default', 'Vocês aceitam PIX?');
  assert(pixMatch !== null, 'Deveria ter encontrado PIX');
  assert(pixMatch.text.toLowerCase().includes('pix'), 'Deve conter texto com chave PIX');
  console.log(`✅ [TEST 4 PASSED] Chave PIX e dados encontrados na Rota Rápida.\n`);

  // TEST 5: Conexão direta com a API Própria da VPS (VPS Engine porta 3001)
  console.log('[TEST 5] Gateway Multi-Modelos: Conexão com API VPS Engine (porta 3001)');
  const vpsResult = await testProviderConnection(
    {
      id: 'vps_engine',
      apiKey: process.env.VPS_AI_API_KEY || 'ap_199924c0bf797f7885b06cc2f0be743ef145a7e3be1733bd',
    },
    {
      model: 'laya-system1',
      message: 'Olá bom dia',
      prompt: 'Você é o validador técnico da API VPS.',
      timeoutMs: 10000,
    }
  );
  console.log('   Resultado VPS Engine:', { ok: vpsResult.ok, provider: vpsResult.provider, response: vpsResult.response });
  assert(vpsResult.ok === true, 'VPS Engine deve responder com sucesso');
  console.log(`✅ [TEST 5 PASSED] VPS Engine online e respondendo em tempo recorde!\n`);

  // TEST 6: Integração no Sandbox (testAIConnection com Rota Rápida)
  console.log('[TEST 6] Sandbox /testAIConnection com Pergunta de Loja');
  const sandboxResult = await testAIConnection({
    companyId: 'default',
    agentKey: 'camila',
    message: 'Qual o valor do cimento CP2?',
    model: 'laya-system1',
    providerId: 'vps_engine',
  });
  assert(sandboxResult.ok === true, 'Sandbox deve retornar ok');
  assert(sandboxResult.provider === 'vps_fast_path', 'Deve indicar provider vps_fast_path');
  assert(sandboxResult.promptTokens === 0, 'Fast Path deve consumir 0 tokens');
  console.log(`✅ [TEST 6 PASSED] Sandbox acionou Rota Rápida com 0 tokens e resposta perfeita:`);
  console.log(`   Provider: ${sandboxResult.provider} | Response: "${sandboxResult.response.substring(0, 80)}..."\n`);

  // TEST 7: Fallback Resiliente quando OpenAI está sem créditos
  console.log('[TEST 7] Fallback Automático: Pergunta consultiva com OpenAI sem saldo');
  const fallbackResult = await testAIConnection({
    companyId: 'default',
    agentKey: 'camila',
    message: 'Sou construtor em Betim e queria saber se vocês tem condições para faturar 1000 sacos de cimento no boleto a prazo',
    providerId: 'openai',
  });
  console.log('   Resultado Fallback:', { ok: fallbackResult.ok, provider: fallbackResult.provider, fallbackActivated: fallbackResult.fallbackActivated });
  assert(fallbackResult.ok === true, 'Fallback deve garantir resposta ok mesmo quando OpenAI falhar');
  assert(fallbackResult.fallbackActivated === true || fallbackResult.provider === 'vps_fast_path', 'Deve ter ativado fallback ou rota rápida');
  console.log(`✅ [TEST 7 PASSED] Fallback funcionou perfeitamente! Nenhuma quebra para o cliente.\n`);

  console.log('====================================================');
  console.log('🎉 TODOS OS 7 TESTES DE INTEGRAÇÃO PASSARAM COM 100%!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
