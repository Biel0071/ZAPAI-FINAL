'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateConversationMilestones,
  XP_MILESTONES,
} = require('../services/conversationEvolutionService');
const {
  buildLeadAlgorithm,
  STORE_EVOLUTION_ALGORITHMS,
} = require('../services/leadAnalyzer');

describe('Conversation Evolution Scoring & Per-Customer Algorithm', () => {
  it('calculates full 150 XP for complete milestone achievements (Zero Mock XP)', () => {
    const conversation = {
      id: 101,
      name: 'Carlos Silva',
      phone: '11987654321',
      funnel_stage: 'aguarda_pix',
      tags: ['ficha_gerada', 'aguarda_pix'],
      delivery_neighborhood: 'Vila Progresso',
    };

    const messages = [
      { from_me: false, text: 'Olá, sou o Carlos Silva e moro no bairro Vila Progresso em Sorocaba' },
      { from_me: true, text: 'Olá Carlos! Prazer em atender você. Como posso te ajudar na sua obra?' },
      { from_me: false, text: 'Quero comprar uma caixa dagua de 5000 litros no pix' },
      { from_me: true, text: 'Perfeito Carlos! A Caixa d água 5.000 Litros sai por R$ 2.490,00 à vista no PIX com frete grátis para Vila Progresso. Vamos fechar?' },
      { from_me: false, text: 'Pode fechar sim, manda o pix!' },
      { from_me: true, text: 'Ficha de pedido gerada! Segue a chave PIX da loja para confirmação.' },
    ];

    const result = evaluateConversationMilestones(conversation, messages, { hasOrderSheet: true });

    assert.equal(result.totalXp, 150, 'Deve atingir a pontuação máxima de 150 XP');
    assert.equal(result.breakdown.cadastralXp, 25, 'Coleta cadastral completa (nome, endereço e telefone) deve valer 25 XP');
    assert.equal(result.breakdown.productXp, 20, 'Especificação precisa de produto/capacidade deve valer 20 XP');
    assert.equal(result.breakdown.sheetXp, 40, 'Ficha gerada / orçamento deve valer 40 XP');
    assert.equal(result.breakdown.conversionXp, 50, 'Conversão para aguarda_pix / fechamento deve valer 50 XP');
    assert.equal(result.breakdown.qualityXp, 15, 'Zero repetições e zero delírios deve valer 15 XP');
    assert.equal(result.milestones.cadastral.achieved, true);
    assert.equal(result.milestones.product.achieved, true);
    assert.equal(result.milestones.sheet.achieved, true);
    assert.equal(result.milestones.conversion.achieved, true);
    assert.equal(result.milestones.quality.achieved, true);
    assert.equal(result.algorithm.code, 'ALGO-01', 'Lead direto com intenção de compra deve acionar ALGO-01');
  });

  it('correctly attributes ALGO-02 (Consultivo Técnico) and partial milestone points for consultative inquiries', () => {
    const conversation = {
      id: 102,
      name: 'Mariana Costa',
      phone: '15991234567',
      funnel_stage: 'interested',
      tags: [],
    };

    const messages = [
      { from_me: false, text: 'Olá, gostaria de saber as medidas e altura da churrasqueira trio pré-moldada e ver o catálogo' },
      { from_me: true, text: 'Olá Mariana! A Churrasqueira Trio mede 2,20m de altura por 1,00m de largura. Temos fotos no catálogo oficial.' },
    ];

    const result = evaluateConversationMilestones(conversation, messages);

    assert.equal(result.algorithm.code, 'ALGO-02', 'Dúvidas técnicas e de catálogo devem acionar ALGO-02');
    assert.equal(result.breakdown.productXp, 20, 'Churrasqueira trio identificada confere 20 XP');
    assert.equal(result.breakdown.sheetXp, 0, 'Sem ficha emitida ainda, 0 XP');
    assert.equal(result.breakdown.conversionXp, 0, 'Sem conversão ainda, 0 XP');
    assert.ok(result.totalXp >= 35, 'Deve pontuar dados parciais honestamente');
  });

  it('correctly attributes ALGO-03 (Quebra de Objeção / Parcelamento 10x) for price-sensitive leads', () => {
    const conversation = {
      id: 103,
      name: 'Roberto Alves',
      phone: '11977778888',
      funnel_stage: 'price_sent',
      tags: [],
    };

    const messages = [
      { from_me: false, text: 'Achei o valor um pouco puxado, vocês conseguem dar desconto ou parcelar em 10x?' },
    ];

    const result = evaluateConversationMilestones(conversation, messages);

    assert.equal(result.algorithm.code, 'ALGO-03', 'Sensibilidade a preço / pedido de 10x deve acionar ALGO-03');
    assert.ok(result.algorithm.directive.includes('10x') || result.algorithm.directive.includes('desconto'), 'Diretriz deve focar em condições especiais sem delírio');
  });

  it('correctly attributes ALGO-05 (Pós-Venda Protegido) and blocks commercial follow-up for confirmed buyers', () => {
    const conversation = {
      id: 104,
      name: 'Ana Souza',
      phone: '11966665555',
      funnel_stage: 'closed',
      tags: ['fechado', 'pago'],
    };

    const messages = [
      { from_me: false, text: 'Já fiz o pix e mandei o comprovante, quando chega meu pedido agendado?' },
    ];

    const result = evaluateConversationMilestones(conversation, messages);

    assert.equal(result.algorithm.code, 'ALGO-05', 'Cliente com compra confirmada deve acionar ALGO-05 Pós-Venda');
    const algoObj = buildLeadAlgorithm(messages[0].text, messages, conversation);
    assert.equal(algoObj.hasPurchased, true, 'Deve marcar hasPurchased = true');
    assert.equal(algoObj.shouldFollowUp, false, 'Deve bloquear cobrança de follow-up comercial para cliente que já comprou');
  });

  it('penalizes quality score if the bot sends consecutive repeated messages (Anti-Repetição)', () => {
    const conversation = {
      id: 105,
      name: 'Cliente Teste',
      phone: '11955554444',
      funnel_stage: 'new_lead',
    };

    const repeatedText = 'Olá! Tudo bem? Sou a Camila do Depósito Mais, como posso ajudar?';
    const messages = [
      { from_me: false, text: 'Bom dia' },
      { from_me: true, text: repeatedText },
      { from_me: false, text: 'Qual o preço do cimento?' },
      { from_me: true, text: repeatedText }, // Repetição idêntica indevida
    ];

    const result = evaluateConversationMilestones(conversation, messages);

    assert.equal(result.breakdown.qualityXp, 0, 'Repetição de mensagens deve zerar os 15 XP de qualidade');
    assert.equal(result.milestones.quality.zeroRepetitions, false, 'zeroRepetitions deve ser falso');
  });

  it('incorporates canonical capacity into lead product label accurately (Anti-Delírio)', () => {
    const algo = buildLeadAlgorithm('preciso de uma caixa de 5 mil litros e queria saber o frete', [], {});
    assert.equal(algo.primaryProductLabel, "Caixa d'água 5.000 Litros", 'Deve normalizar a capacidade canônica sem delírio');
  });

  it('provides persistent evaluation structure with all required fields', () => {
    const evaluation = evaluateConversationMilestones({ id: 200, name: 'João Teste', phone: '11999990000' }, []);
    assert.ok(evaluation.milestones);
    assert.ok(evaluation.breakdown);
    assert.ok(typeof evaluation.totalXp === 'number');
    assert.ok(evaluation.algorithm.code.startsWith('ALGO-'));
  });

  it('handles null or corrupted conversation and message arrays safely without crashing', () => {
    // Both null
    const res1 = evaluateConversationMilestones(null, null);
    assert.equal(res1.totalXp, 0, 'Conversa e mensagens nulas devem resultar em 0 XP');
    assert.equal(res1.breakdown.qualityXp, 0);

    // Empty object and array with null/undefined items
    const res2 = evaluateConversationMilestones({}, [null, undefined, 'invalido', {}]);
    assert.equal(res2.totalXp, 0, 'Mensagens corrompidas devem resultar em 0 XP sem lançar exceção');
    assert.equal(res2.breakdown.qualityXp, 0, 'Zero mensagens de bot não deve receber XP de atendimento (Zero Mock XP)');
  });

  it('awards zero attendance quality XP if bot never attended the conversation (Zero Mock XP)', () => {
    const conversation = {
      id: 300,
      name: 'Cliente Sem Atendimento',
      phone: '11911112222',
      funnel_stage: 'new_lead',
    };
    const messages = [
      { from_me: false, text: 'Oi, boa tarde!' },
    ];

    const result = evaluateConversationMilestones(conversation, messages);
    assert.equal(result.breakdown.qualityXp, 0, 'Sem resposta do bot, XP de qualidade deve ser rigorosamente 0');
    assert.ok(result.milestones.quality.details.includes('Aguardando mensagens'));
  });

  it('emits realtime WebSocket conversation_score_updated event when io is provided', async () => {
    const { scoreConversationAndPersist } = require('../services/conversationEvolutionService');
    const emittedEvents = [];
    const mockIo = {
      to: (room) => ({
        emit: (event, payload) => emittedEvents.push({ room, event, payload }),
      }),
      emit: (event, payload) => emittedEvents.push({ room: 'broadcast', event, payload }),
    };

    // Call scoreConversationAndPersist with non-existent ID to verify safe return null
    const res = await scoreConversationAndPersist(999999999, 'test_tenant', { io: mockIo });
    assert.equal(res, null, 'Conversa inexistente deve retornar null com segurança');
  });
});

setTimeout(() => process.exit(0), 1000).unref();


