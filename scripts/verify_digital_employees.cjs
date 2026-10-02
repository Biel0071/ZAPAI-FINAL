const aiAgentService = require('../backend/src/ai/agents/services/aiAgentService');

async function main() {
  console.log('=== VERIFYING DIGITAL EMPLOYEES & ZAIBOT PLATFORM ===');
  
  const tenantId = 'default';
  console.log('Using tenantId:', tenantId);

  // 1. List initial agents
  let agents = await aiAgentService.listAgents(tenantId);
  console.log(`Initial agents count: ${agents.length}`);
  console.log('Agents keys:', agents.map(a => `${a.key} (${a.name} - ${a.role || a.sector}, active=${a.active !== false})`));

  // Verify Camila is intact
  const camila = agents.find(a => a.key === 'camila');
  if (!camila) {
    throw new Error('Camila not found in initial agents!');
  }
  console.log('\n[PASS] Camila verified intact:');
  console.log(JSON.stringify({
    key: camila.key,
    name: camila.name,
    role: camila.role,
    status: camila.status,
    personalityType: camila.personalityType,
    channels: camila.channels,
    active: camila.active !== false
  }, null, 2));

  // Verify ZAIBOT is platform assistant
  const zaibot = agents.find(a => a.key === 'zaibot');
  if (!zaibot || !zaibot.isPlatformAssistant) {
    throw new Error('ZAIBOT is not marked as platform assistant!');
  }
  console.log('\n[PASS] ZAIBOT verified as platform assistant:');
  console.log(JSON.stringify({
    key: zaibot.key,
    name: zaibot.name,
    isPlatformAssistant: zaibot.isPlatformAssistant,
    role: zaibot.role
  }, null, 2));

  // 2. Create Marina (Pós-venda, Empática)
  console.log('\n--- Creating Marina (Pós-venda, Empática) ---');
  const existingMarina = agents.find(a => a.key === 'marina');
  if (existingMarina) {
    await aiAgentService.deleteAgent('marina', tenantId).catch(() => {});
  }
  const marina = await aiAgentService.createAgent({
    key: 'marina',
    name: 'Marina',
    role: 'Pós-venda',
    active: true,
    sessionIds: ['main'],
    personalityType: 'empatica',
    personalityTraits: ['Acolhedora', 'Paciente', 'Foco na Resolução'],
    responsibilities: ['Acompanhamento de satisfação', 'Retenção de clientes', 'Resolução de queixas'],
    channels: ['whatsapp', 'inbox'],
    instructions: 'Você é a Marina, especialista em pós-venda da empresa. Trate cada cliente com calor humano e empatia.',
    permissions: {
      canOfferDiscounts: true,
      canTransferToHuman: true,
      requireSupervision: false
    }
  }, tenantId);
  console.log('[PASS] Marina created successfully:');
  console.log(JSON.stringify({
    key: marina.key,
    name: marina.name,
    role: marina.role,
    personalityType: marina.personalityType,
    channels: marina.channels,
    status: marina.status,
    active: marina.active !== false,
    sessionIds: marina.sessionIds
  }, null, 2));

  // 3. Create João (Suporte, Técnico)
  console.log('\n--- Creating João (Suporte, Técnico) ---');
  const existingJoao = agents.find(a => a.key === 'joao');
  if (existingJoao) {
    await aiAgentService.deleteAgent('joao', tenantId).catch(() => {});
  }
  const joao = await aiAgentService.createAgent({
    key: 'joao',
    name: 'João',
    role: 'Suporte',
    active: true,
    sessionIds: ['main'],
    personalityType: 'tecnico',
    personalityTraits: ['Preciso', 'Objetivo', 'Especialista'],
    responsibilities: ['Diagnóstico de problemas', 'Orientação passo a passo', 'Abertura de chamados'],
    channels: ['whatsapp', 'inbox'],
    instructions: 'Você é o João, especialista técnico de suporte. Seja claro, direto e forneça passos precisos.',
    permissions: {
      canOfferDiscounts: false,
      canTransferToHuman: true,
      requireSupervision: false
    }
  }, tenantId);
  console.log('[PASS] João created successfully:');
  console.log(JSON.stringify({
    key: joao.key,
    name: joao.name,
    role: joao.role,
    personalityType: joao.personalityType,
    channels: joao.channels,
    status: joao.status,
    active: joao.active !== false,
    sessionIds: joao.sessionIds
  }, null, 2));

  // 4. Re-query list of agents to confirm persistence
  console.log('\n--- Verifying Persistence & Multi-Agent Listing ---');
  const updatedAgents = await aiAgentService.listAgents(tenantId);
  console.log(`Updated agents count: ${updatedAgents.length}`);
  const keys = updatedAgents.map(a => a.key);
  console.log('Current agent keys in tenant:', keys);

  if (!keys.includes('marina')) throw new Error('Marina was not persisted!');
  if (!keys.includes('joao')) throw new Error('João was not persisted!');
  if (!keys.includes('camila')) throw new Error('Camila is missing!');
  if (!keys.includes('zaibot')) throw new Error('ZAIBOT is missing!');

  // 5. Test toggling agent status (Pausar / Ativar)
  console.log('\n--- Testing Toggle Agent Status (Pausar/Ativar) ---');
  await aiAgentService.setAgentActive('camila', false, tenantId);
  let camilaAgents = await aiAgentService.listAgents(tenantId);
  let camilaPaused = camilaAgents.find(a => a.key === 'camila');
  console.log('Camila active after pause:', camilaPaused.active, 'status:', camilaPaused.status);
  if (camilaPaused.active !== false) throw new Error('Camila pause failed!');

  // Re-enable Camila
  await aiAgentService.setAgentActive('camila', true, tenantId);
  camilaAgents = await aiAgentService.listAgents(tenantId);
  let camilaActive = camilaAgents.find(a => a.key === 'camila');
  console.log('Camila active after re-enable:', camilaActive.active, 'status:', camilaActive.status);
  if (camilaActive.active !== true) throw new Error('Camila re-enable failed!');

  console.log('\n✅ ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
