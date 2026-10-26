const path = require('path');
const assert = require('assert');

console.log('[TEST] Starting Coupled Memory Unit & Integration Test...');

const quickReplyCapability = require('../backend/services/quickReplyCapability');
const quickReplyService = require('../backend/services/quickReplyService');
const { compileSystemPrompt } = require('../backend/services/ai.service');
const camilaAgent = require('../backend/src/ai/agents/agents/camilaAgent');

async function runTests() {
  // Test 1: listQuickReplies returns items
  const allQRs = await quickReplyService.listQuickReplies({ companyId: 'default' });
  console.log(`[TEST 1] Loaded ${allQRs.length} quick replies from service.`);
  assert(allQRs.length > 0, 'Should load quick replies');

  // Test 2: findBestMatchForContext detects photo request for churrasqueira
  const matchPhoto = await quickReplyCapability.findBestMatchForContext({
    message: 'Você tem fotos da churrasqueira montada para eu ver?',
    companyId: 'default',
  });
  console.log('[TEST 2] Photo match for churrasqueira:', matchPhoto?.title, 'Score:', matchPhoto?.score, 'Type:', matchPhoto?.requestedMediaType);
  assert(matchPhoto !== null, 'Should find match for churrasqueira photo');
  assert(matchPhoto.requestedMediaType === 'image', 'Requested media type should be image');
  assert(matchPhoto.title.toLowerCase().includes('churras'), 'Should match churras');

  // Test 3: findBestMatchForContext detects audio request
  const matchAudio = await quickReplyCapability.findBestMatchForContext({
    message: 'Manda um áudio explicando sobre o cimento por favor',
    companyId: 'default',
  });
  console.log('[TEST 3] Audio match for cimento:', matchAudio?.title, 'Score:', matchAudio?.score, 'Type:', matchAudio?.requestedMediaType);
  assert(matchAudio !== null, 'Should find match for cimento audio');
  assert(matchAudio.requestedMediaType === 'audio', 'Requested media type should be audio');

  // Test 4: buildCoupledQuickReplyMemory formats structured memory
  const memoryPrompt = quickReplyCapability.buildCoupledQuickReplyMemory(allQRs, {
    agent: camilaAgent,
    message: 'tem fotos da churrasqueira?',
    matchedCapability: matchPhoto,
  });
  console.log('[TEST 4] Memory prompt generated. Length:', memoryPrompt.length);
  assert(memoryPrompt.includes('MEMÓRIA ACOPLADA: RESPOSTAS RÁPIDAS'), 'Must contain header');
  assert(memoryPrompt.includes('RECURSO EM DESTAQUE PARA A DEMANDA ATUAL'), 'Must contain highlight');
  assert(memoryPrompt.includes('churras_2.png'), 'Must include specific image paths');
  assert(memoryPrompt.includes('send_media'), 'Must explain send_media instructions');

  // Test 5: compileSystemPrompt incorporates coupled memory
  const compiled = compileSystemPrompt(camilaAgent, {}, {
    verifiedQuickReplies: allQRs,
    matchedCapability: matchPhoto,
  });
  console.log('[TEST 5] System prompt compiled. Length:', compiled.length);
  assert(compiled.includes('MEMÓRIA ACOPLADA: RESPOSTAS RÁPIDAS'), 'System prompt must contain coupled memory');
  assert(compiled.includes('"send_media"'), 'System prompt must instruct send_media in analysis');

  console.log('[TEST SUCCESS] All 5 tests passed successfully!');
}

runTests().catch(err => {
  console.error('[TEST FAILURE]', err);
  process.exit(1);
});
