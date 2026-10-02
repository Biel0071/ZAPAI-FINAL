const assert = require('assert');
const path = require('path');

async function testSkills() {
  console.log('===========================================================');
  console.log('🧪 TESTE DE VALIDAÇÃO: SUPERPODERES MULTIMODAIS DA CAMILA');
  console.log('===========================================================');

  const orchestrator = require('../backend/src/ai/evolutionary/orchestrator');
  const quickReplyCapability = require('../backend/services/quickReplyCapability');

  const testCases = [
    {
      name: 'Pedido de Fotos da Churrasqueira Trio',
      message: 'Olá Camila, você tem fotos da churrasqueira trio para me mostrar?',
      expectedSkill: 'CHURRAS',
      expectedMediaType: 'image',
    },
    {
      name: 'Pedido de Foto da Betoneira CSM',
      message: 'Boa tarde! Gostaria de ver uma foto da betoneira CSM de 400 litros.',
      expectedSkill: 'BETONEIRA',
      expectedMediaType: 'image',
    },
    {
      name: 'Dúvida de Resistência / Vídeo do Tijolo',
      message: 'Esse tijolo quebra fácil? Tem algum vídeo mostrando a qualidade e resistência dele?',
      expectedSkill: 'QUALIDADE TIJOLO',
      expectedMediaType: 'video',
    },
    {
      name: 'Pedido de Áudio Explicativo de Cimento',
      message: 'Pode me mandar um áudio explicando sobre o cimento e as marcas que você tem?',
      expectedSkill: 'AUDIO CIMENTO',
      expectedMediaType: 'audio',
    },
    {
      name: 'Fechamento de Pedido e Dados de Entrega',
      message: 'Perfeito, vou fechar o pedido! Quais dados vocês precisam para entrega?',
      expectedSkill: 'DADOS ENTREGA',
      expectedMediaType: null, // text template
    },
    {
      name: 'Pergunta sobre Rastreamento Jadlog',
      message: 'Meu pedido já foi enviado? Como faço para rastrear pela jadlog?',
      expectedSkill: 'SCRIPT JAD',
      expectedMediaType: null,
    }
  ];

  let passed = 0;

  for (const tc of testCases) {
    console.log(`\n--- Testando: "${tc.name}" ---`);
    console.log(`Mensagem do Cliente: "${tc.message}"`);

    // 1. Test direct match capability
    const match = await quickReplyCapability.findBestMatchForContext({
      message: tc.message,
      companyId: 'default'
    });

    console.log(`-> Skill Detectada: "${match?.title}" (Score: ${match?.score})`);
    console.log(`-> Mídia Selecionada: ${match?.selectedMediaItem?.value || 'Nenhuma (Texto)'} [Tipo: ${match?.selectedMediaItem?.type || 'text'}]`);

    // 2. Test full orchestrator response
    const result = await orchestrator.orchestrateResponse({
      agent: { name: 'Camila', key: 'camila' },
      conversation: { phone: '5531988887777', lead_id: 100, company_id: 'default' },
      conversationHistory: [{ role: 'user', content: tc.message }],
      customerMessage: tc.message,
      companyId: 'default'
    });

    console.log(`-> Resposta da Camila: "${result.response?.slice(0, 90)}..."`);
    console.log(`-> Trigger Multimodal Ativado: "${result.quickReplyTriggered || result.analysis?.trigger_quick_reply || 'Nenhum'}"`);

    const triggeredIdOrTitle = result.quickReplyTriggered || result.analysis?.trigger_quick_reply;
    assert(triggeredIdOrTitle, `Deveria ter disparado uma skill para o caso: ${tc.name}`);
    console.log(`✅ [PASS] Skill ativada com sucesso para ${tc.name}!`);
    passed++;
  }

  console.log(`\n===========================================================`);
  console.log(`🎉 RESULTADO: ${passed}/${testCases.length} Testes de Superpoderes Aprovados!`);
  console.log('===========================================================');
}

testSkills().catch(err => {
  console.error('❌ Falha nos testes de skills:', err);
  process.exit(1);
});
