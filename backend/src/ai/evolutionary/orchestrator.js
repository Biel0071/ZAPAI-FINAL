/**
 * Evolutionary AI Orchestrator — Master 5-Layer Coordinator
 *
 * Strict Authority Hierarchy:
 * OFFICIAL_KNOWLEDGE > APPROVED_PLAYBOOK > HUMAN_EXPERIENCE > AI_LEARNING > SINGLE_CONVERSATION
 *
 * Coordinates:
 * - Layer 1: knowledgeEngine (Verdade Oficial da Loja)
 * - Layer 2: customerMemoryEngine (Memória Estruturada do Cliente)
 * - Layer 3: playbookEngine (Estratégias Operacionais & Playbooks)
 * - Layer 4: experienceEngine (Registro Ação x Reação x Venda)
 * - Layer 5: learningEngine (Mineração e Evolução)
 */

const knowledgeEngine = require('./knowledgeEngine');
const customerMemoryEngine = require('./customerMemoryEngine');
const playbookEngine = require('./playbookEngine');
const experienceEngine = require('./experienceEngine');
const learningEngine = require('./learningEngine');
const crossConversationMemory = require('./crossConversationMemory');

class EvolutionaryAgentOrchestrator {
  constructor() {
    this.knowledgeEngine = knowledgeEngine;
    this.customerMemoryEngine = customerMemoryEngine;
    this.playbookEngine = playbookEngine;
    this.experienceEngine = experienceEngine;
    this.learningEngine = learningEngine;
  }

  /**
   * Synthesizes the unified 5-layer evolutionary prompt section
   */
  async buildEvolutionaryPrompt({
    companyId = 'default',
    contact = {},
    message = '',
    conversationId = null,
    leadIntent = null,
    history = [],
  }) {
    const cleanCompany = String(companyId || 'default');
    const cleanMsg = String(message || '').trim();
    const sessionId = contact.sessionId || null;

    // 1. Layer 1: Official Knowledge (Store or Session Knowledge)
    let officialKnowledgePrompt = '';
    if (sessionId) {
      try {
        const agents = require('../agents/services/aiAgentService');
        officialKnowledgePrompt = await agents.sessionKnowledge(cleanCompany, sessionId);
      } catch (_) {}
    }
    if (!officialKnowledgePrompt) {
      try {
        officialKnowledgePrompt = await this.knowledgeEngine.compileOfficialKnowledgePrompt(cleanCompany, cleanMsg);
      } catch (_) {}
    }

    // 2. Layer 2: Customer Structured Memory & Active Memory Graph
    let customerContext = {};
    let customerMemoryPrompt = '';
    if (sessionId) {
      try {
        const engine = require('../../../services/conversationMemoryEngine');
        const memory = await engine.getConversationMemory({
          companyId: cleanCompany,
          sessionId,
          contactId: contact.phone || contact.id,
          phone: contact.phone,
        });
        customerContext = memory || {};
        customerMemoryPrompt = memory ? engine.buildContextualPrompt(memory) : '';
      } catch (_) {}
    }
    if (!customerMemoryPrompt) {
      try {
        customerContext = await this.customerMemoryEngine.loadCustomerContext({
          companyId: cleanCompany,
          phone: contact.phone || contact.id,
          conversationId: conversationId || contact.conversationId,
        });
        customerMemoryPrompt = this.customerMemoryEngine.compileCustomerMemoryPrompt(customerContext);
      } catch (_) {}
    }

    // Active Agent Memory Graph Recall (Semantic & Graphify representation)
    let graphMemoryPrompt = '';
    try {
      const agentMemoryGraphService = require('../../../services/agentMemoryGraphService');
      const graphRecall = await agentMemoryGraphService.recallRelevantMemory({
        agentKey: contact.agentKey || 'camila',
        agentName: contact.agentName || 'Camila',
        companyId: cleanCompany,
        contact: { ...contact, hasSessionPrompt: Boolean(customerMemoryPrompt) },
        message: cleanMsg,
      });
      if (graphRecall && graphRecall.prompt) {
        graphMemoryPrompt = graphRecall.prompt;
      }
    } catch (_) {}

    const combinedCustomerPrompt = [customerMemoryPrompt, graphMemoryPrompt].filter(Boolean).join('\n');

    // 3. Layer 3: Playbook Selection
    let activePlaybook = null;
    let playbookPrompt = '';
    try {
      activePlaybook = await this.playbookEngine.matchPlaybook({
        companyId: cleanCompany,
        message: cleanMsg,
        intent: leadIntent || customerContext.leadIntent,
        conversationId: conversationId || contact.conversationId,
      });
      playbookPrompt = this.playbookEngine.compilePlaybookPrompt(activePlaybook);
    } catch (_) {}

    // 4. Layer 4: Similar Successful Experiences
    let pastExperiences = [];
    let experiencePrompt = '';
    try {
      pastExperiences = await this.experienceEngine.findSimilarExperiences({
        companyId: cleanCompany,
        message: cleanMsg,
        intent: leadIntent || customerContext.leadIntent,
        limit: 2,
      });
      experiencePrompt = this.experienceEngine.compileExperiencePrompt(pastExperiences);
    } catch (_) {}

    // 4.1 Cross-Conversation Knowledge & Anti-Robotic WhatsApp Tone
    let crossConvPrompt = '';
    try {
      const crossExamples = await crossConversationMemory.recallCrossConversationExamples({
        companyId: cleanCompany,
        message: cleanMsg,
        intent: leadIntent || customerContext.leadIntent,
        limit: 2,
      });
      crossConvPrompt = crossConversationMemory.compileCrossConversationPrompt(crossExamples);
    } catch (_) {}

    // 4.2 Quick Reply Skills & Multimodal Powers
    let quickRepliesPrompt = '';
    try {
      const quickReplyService = require('../../../services/quickReplyService');
      const quickReplyCapability = require('../../../services/quickReplyCapability');
      const qrs = await quickReplyService.listQuickReplies({ companyId: cleanCompany });
      quickRepliesPrompt = quickReplyCapability.formatCapabilitiesForPrompt(qrs);
    } catch (_) {}

    // 4.3 Anti-Repetition & Recent Attendant Replies Tracker
    let antiRepetitionPrompt = '';
    let recentBotReplies = [];
    try {
      const aiAntiRepetitionService = require('../../../services/aiAntiRepetitionService');
      const histToScan = history && history.length > 0 ? history : (contact.history || []);
      recentBotReplies = contact.recentBotReplies || aiAntiRepetitionService.extractRecentBotReplies(histToScan, 20);
      
      // Extract direct facts from the current message and merge with customer memory
      const directFacts = this.customerMemoryEngine.extractFactsLocally(cleanMsg);
      const memComm = contact.conversationMemory?.commercial || {};
      const knownPreferences = {
        product: directFacts.product || customerContext?.quotedProducts?.[0] || customerContext?.product || memComm.activeProduct || contact?.leadAlgorithm?.primaryProductLabel,
        capacity: directFacts.capacity || customerContext?.capacity || memComm.capacity,
        quantity: directFacts.quantity || customerContext?.quantity || memComm.quantity,
        neighborhood: directFacts.neighborhood || customerContext?.neighborhood || memComm.neighborhood || memComm.deliveryCity || contact?.neighborhood,
        city: customerContext?.city || memComm.deliveryCity || contact?.city,
        paymentPreference: directFacts.paymentPreference || customerContext?.paymentPreference || memComm.paymentPreference || contact?.leadAlgorithm?.preferredPayment,
        urgency: directFacts.urgency || customerContext?.urgency,
        objection: directFacts.objection || customerContext?.objection,
      };
      antiRepetitionPrompt = aiAntiRepetitionService.buildAntiRepetitionPromptBlock({ recentBotReplies, knownPreferences });
    } catch (_) {}

    // 5. Layer 5: Authority Rules & Directive Synthesis
    const hierarchyPrompt = `
### [HIERARQUIA DE AUTORIDADE E CONDUTA DO AGENTE]
1. VERDADE OFICIAL DA LOJA É SOBERANA: Nunca prometa descontos ou prazos que contradigam o catálogo oficial da Camada 1.
2. NUNCA REPITA PERGUNTAS OU DADOS JÁ INFORMADOS: Se a informação já estiver na Memória do Cliente (Camada 2), utilize-a diretamente.
3. REGRA ANTI-REPETIÇÃO E NATURALIDADE: NUNCA se apresente novamente ("Olá! Aqui é a Camila...") se você já falou anteriormente na conversa. NUNCA repita o mesmo CTA sucessivamente.
4. SEGUIMENTO DIRETO NA LINHA DE RACIOCÍNIO & ACOLHIMENTO: Se o cliente respondeu uma capacidade, quantidade, produto ou pergunta sua (ex: "De 5 mil litros", "2 milheiros", "no São Caetano"), responda e acolha diretamente essa resposta dele com calor humano antes de fazer a próxima pergunta de avanço.
5. SIGA O ROTEIRO DO PLAYBOOK E ARQUÉTIPO DO LEAD: Utilize a estratégia orientada na Camada 3 e adapte o tom ao arquétipo do cliente (construtor/técnico, consumidor residencial, negociador ou urgência).
6. CONCISÃO ESTRITA NO WHATSAPP (MÁXIMO 35 A 50 PALAVRAS): SEMPRE limite suas respostas a no máximo 50 palavras! NUNCA ultrapasse 50 palavras. Proibido formato de lista (*, -, •) ou tabelas. Use texto corrido natural. Use no máximo 1 a 2 emojis por resposta.
7. ZERO DELÍRIOS OU INVENÇÃO DE DADOS (FIXAÇÃO NA LOJA DEPÓSITO MAIS): Nunca invente preços, descontos arbitrários, parcelas sem juros que não constem na loja, ou especificações técnicas não documentadas. Se o preço ou informação não estiver no contexto, diga claramente que vai checar no sistema/estoque com a equipe e já confirma. Não devaneie em cenários hipotéticos.
8. NÃO ENVIE LINKS EM FORMATO MARKDOWN: Nunca use [texto](url), envie apenas a url pura se solicitada.
9. SILÊNCIO APÓS INTERVENÇÃO HUMANA: Quando o atendimento for transferido para um operador humano ou finalizado, não responda mais nada.
10. FECHAMENTO SUAVE (FICHA DO PEDIDO): Quando o cliente definir item, quantidade e local de entrega, confirme o valor oficial e pergunte como prefere efetuar o pagamento (PIX à vista com desconto ou até 10x sem juros no cartão).
`;

    const fullEvolutionaryPrompt = [
      officialKnowledgePrompt,
      combinedCustomerPrompt,
      playbookPrompt,
      experiencePrompt,
      crossConvPrompt,
      quickRepliesPrompt,
      antiRepetitionPrompt,
      hierarchyPrompt
    ].filter(Boolean).join('\n---\n');

    return {
      prompt: fullEvolutionaryPrompt,
      officialKnowledgePrompt,
      customerContext,
      activePlaybook,
      pastExperiences,
      recentBotReplies,
    };
  }

  /**
   * Orchestrate full response generation including LLM call and experience tracking
   */
  async orchestrateResponse({
    agent,
    conversation,
    conversationHistory = [],
    customerMessage,
    leadAnalysis = {},
    salesStrategy = {},
    store = {},
    sessionId = null,
    companyId = 'default',
  }) {
    const cleanCompany = String(companyId || store?.activeCompanyId || 'default');
    const convId = conversation?.id || conversation?.phone || 'unknown';
    const phone = conversation?.phone || store?.contact?.phone || '';

    // Step 1: Extract customer facts from customerMessage (Layer 2)
    try {
      await this.customerMemoryEngine.extractAndSaveFacts({
        companyId: cleanCompany,
        phone,
        conversationId: convId,
        messageText: customerMessage,
      });
    } catch (e) {
      console.warn('[Orchestrator] extractFacts error:', e.message);
    }

    // Step 2: Build 5-Layer Evolutionary Prompt
    const evoData = await this.buildEvolutionaryPrompt({
      companyId: cleanCompany,
      contact: { ...store?.contact, phone, conversationId: convId, sessionId: sessionId || conversation?.sessionId },
      message: customerMessage,
      conversationId: convId,
      leadIntent: leadAnalysis?.intent || conversation?.lead_intent,
      history: conversationHistory,
    });

    // Step 3: Call AI Provider via ai.service.js
    let responseText = null;
    let providerUsed = 'evolutionary_orchestrator';
    let modelUsed = 'system';
    let tokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let responseTimeMs = 0;

    let aiResultData = null;
    let triggerQuickReply = null;
    let matchedCapability = null;

    try {
      const { processAI } = require('../../../services/ai.service');
      const startedAt = Date.now();

      // Merge evolutionary prompt into contact context
      const enrichedContact = {
        name: evoData.customerContext.name || conversation?.phone || 'Cliente',
        phone,
        conversationId: convId,
        sessionId: sessionId || store?.sessionId || null,
        funnelStage: evoData.customerContext.stage || conversation?.funnel_stage || null,
        nextAction: leadAnalysis?.next_action || conversation?.next_action || null,
        leadAnalysis,
        salesStrategy,
        evolutionaryPrompt: evoData.prompt,
        hasPastBotMessages: Boolean(evoData.recentBotReplies && evoData.recentBotReplies.length > 0),
      };

      const aiResult = await processAI({
        contact: enrichedContact,
        history: conversationHistory,
        message: customerMessage,
        store,
        agentName: agent?.name || 'Camila',
        companyId: cleanCompany,
      });

      responseTimeMs = Date.now() - startedAt;

      if (aiResult) {
        aiResultData = aiResult;
        if (aiResult.reply) responseText = aiResult.reply;
        providerUsed = aiResult.provider || providerUsed;
        modelUsed = aiResult.model || modelUsed;
        tokens = {
          promptTokens: aiResult.promptTokens || 0,
          completionTokens: aiResult.completionTokens || 0,
          totalTokens: aiResult.totalTokens || 0,
        };
        triggerQuickReply = aiResult.quickReplyTriggered || aiResult.analysis?.trigger_quick_reply || null;
      }
    } catch (aiErr) {
      console.warn('[Orchestrator] processAI call encountered error:', aiErr.message);
    }

    // Multimodal Autonomous Matching (Camila's Quick Reply Skills)
    try {
      const quickReplyCapability = require('../../../services/quickReplyCapability');
      matchedCapability = await quickReplyCapability.findBestMatchForContext({
        message: customerMessage,
        companyId: cleanCompany,
      });
      // Strictly require explicit media request from customer AND high confidence score (>= 85)
      const lowerMsg = (customerMessage || '').toLowerCase();
      const userAskedMedia =
        lowerMsg.includes('me manda foto') ||
        lowerMsg.includes('manda foto') ||
        lowerMsg.includes('envia foto') ||
        lowerMsg.includes('tem foto') ||
        lowerMsg.includes('fotos') ||
        lowerMsg.includes('catalogo') ||
        lowerMsg.includes('catálogo');
      if (!triggerQuickReply && matchedCapability && matchedCapability.score >= 85 && userAskedMedia) {
        triggerQuickReply = matchedCapability.id;
      }
    } catch (qrErr) {
      console.warn('[Orchestrator] quickReplyCapability match error:', qrErr.message);
    }

    // Step 4: If LLM produced no text, construct an intelligent Playbook-guided fallback
    const aiAntiRepetitionService = require('../../../services/aiAntiRepetitionService');
    const histToScan = conversationHistory && conversationHistory.length > 0 ? conversationHistory : [];
    const recentBotReplies = evoData.recentBotReplies || aiAntiRepetitionService.extractRecentBotReplies(histToScan, 20);
    const hasPastBotMessages = recentBotReplies.length > 0;
    const recentCtas = recentBotReplies.map(r => r.cta).filter(Boolean);

    if (!responseText) {
      const pb = evoData.activePlaybook;
      let cta = pb?.recommended_cta;

      let agentName = agent?.name || 'Camila';
      // WhatsApp customer chats must ALWAYS identify as store attendant (Camila), NEVER ZAIBOT
      if (String(agentName).toLowerCase() === 'zaibot' || agent?.isPlatformAssistant || String(agent?.key || '').toLowerCase() === 'zaibot') {
        agentName = 'Camila';
      }

      const lowerMsg = (customerMessage || '').toLowerCase();
      const extractedFacts = this.customerMemoryEngine.extractFactsLocally(customerMessage);
      const capacity = extractedFacts.capacity || evoData.customerContext?.capacity;
      const neighborhood = extractedFacts.neighborhood || evoData.customerContext?.neighborhood;
      const paymentPref = extractedFacts.paymentPreference || evoData.customerContext?.paymentPreference;

      if (!cta || recentCtas.some(prev => aiAntiRepetitionService.areCtasSimilar(cta, prev))) {
        cta = null;
      }

      // Prohibit playbook CTA from re-asking information already known or just answered
      if (cta) {
        const ctaIntent = aiAntiRepetitionService.getCtaIntent(cta);
        if (ctaIntent === 'PAGAMENTO' && paymentPref) {
          cta = null;
        } else if (ctaIntent === 'LOCALIZACAO_FRETE' && neighborhood) {
          cta = null;
        } else if (ctaIntent === 'MEDIDAS_CAPACIDADE' && capacity) {
          cta = null;
        }
      }

      // Fechamento de Venda e Confirmação de Ficha de Pedido com Camila
      const orderSheetService = require('../../../services/orderSheetService');
      const isConfirming =
        /^(?:sim|ok|pode ser|confirmo|confirmado|fechado|pode fechar|t[aá] certo|t[aá] bom|beleza|perfeito|pode agendar|manda o pix|chave pix|quero sim)\b/i.test(lowerMsg) ||
        lowerMsg.includes('pode fechar') ||
        lowerMsg.includes('manda o pix') ||
        lowerMsg.includes('pode agendar') ||
        lowerMsg.includes('confirmo o pedido') ||
        lowerMsg.includes('fechar pedido');

      let existingSheet = null;
      try {
        existingSheet = await orderSheetService.getLatestSheetForConversation(convId, cleanCompany);
      } catch (_) {}

      if (isConfirming && (existingSheet || (neighborhood && paymentPref))) {
        try {
          await orderSheetService.finalizeAttendanceWithSheet({
            conversationId: convId,
            companyId: cleanCompany,
            sheetId: existingSheet?.id,
            store,
            io: store?.io || global.io,
          });
          responseText = [
            '✅ *Seu pedido foi registrado com sucesso no sistema!*',
            '',
            'Nosso atendente humano está conferindo sua rota e aguardando o comprovante do PIX para liberação imediata da entrega.',
            'Muito obrigado pela confiança e preferência!',
          ].join('\n');
        } catch (finErr) {
          console.warn('[Orchestrator] finalization error:', finErr.message);
        }
      } else if (
        (lowerMsg.includes('ficha') || lowerMsg.includes('orçamento') || lowerMsg.includes('orcamento') || lowerMsg.includes('fechar') || lowerMsg.includes('quanto fica tudo')) &&
        (neighborhood || paymentPref || capacity || lowerMsg.includes('churrasqueira'))
      ) {
        try {
          const sheetData = await orderSheetService.extractSheetDataFromConversation(convId, cleanCompany);
          if (sheetData && sheetData.items && sheetData.items.length > 0 && sheetData.totalPrice > 0) {
            const savedSheet = await orderSheetService.saveConversationSheet(sheetData, cleanCompany);
            responseText = savedSheet.summary_text;
          }
        } catch (shErr) {
          console.warn('[Orchestrator] sheet generation error:', shErr.message);
        }
      }

      const knownPrefs = {
        capacity,
        neighborhood,
        city: evoData.customerContext?.city,
        paymentPreference: paymentPref,
      };

      const isAskingLocation =
        lowerMsg.includes('de onde') ||
        lowerMsg.includes('qual cidade') ||
        lowerMsg.includes('onde fica') ||
        lowerMsg.includes('onde e') ||
        lowerMsg.includes('onde é') ||
        lowerMsg.includes('qual endereco') ||
        lowerMsg.includes('qual endereço') ||
        lowerMsg.includes('qual o endereco') ||
        lowerMsg.includes('qual o endereço') ||
        lowerMsg.includes('onde voces estao') ||
        lowerMsg.includes('onde vocês estão') ||
        lowerMsg.includes('sao de onde') ||
        lowerMsg.includes('são de onde') ||
        lowerMsg.includes('qual estado') ||
        lowerMsg.includes('qual o estado') ||
        lowerMsg.includes('entrega no rio') ||
        lowerMsg.includes('entrega em sp');

      const isAdOrLeadTime =
        lowerMsg.includes('prazo de entrega') ||
        (lowerMsg.includes('prazo') && (lowerMsg.includes('churrasqueira') || lowerMsg.includes('entrega'))) ||
        (lowerMsg.includes('anúncio') || lowerMsg.includes('anuncio')) ||
        lowerMsg.includes('quando entrega') ||
        lowerMsg.includes('demora quanto tempo');

      if (isAskingLocation) {
        responseText = hasPastBotMessages
          ? `Nossa loja e centro de distribuição ficam em Minas Gerais (Região Metropolitana de BH/Betim/Contagem). Atendemos toda a nossa região com frete próprio e entregamos também em regiões vizinhas. Qual é a sua cidade ou bairro para eu consultar a rota para você?`
          : `Olá! Aqui é a ${agentName}. Nossa loja e centro de distribuição ficam em Minas Gerais (Região Metropolitana de BH/Betim/Contagem). Atendemos toda a região metropolitana com entrega própria. Qual é a sua cidade ou bairro para eu consultar nossa rota de entrega?`;
      } else if (isAdOrLeadTime) {
        responseText = hasPastBotMessages
          ? `Temos a Churrasqueira Trio a pronta entrega com saída rápida em até 2 a 4 dias úteis! O frete é grátis até 15km da loja. Qual é o seu bairro ou cidade para eu consultar a data exata do caminhão para você?`
          : `Olá! Aqui é a ${agentName} da loja. Temos a Churrasqueira Trio a pronta entrega com saída rápida em até 2 a 4 dias úteis! O frete é grátis num raio de até 15km da loja. Qual é o seu bairro ou cidade para eu consultar a rota do caminhão para você?`;
      } else if (lowerMsg.includes('frete') || lowerMsg.includes('entrega')) {
        const topic = !neighborhood ? 'freight_location' : (!paymentPref ? 'payment' : 'closing_advance');
        const nextCta = cta || aiAntiRepetitionService.getAlternativeCta(recentCtas, topic, knownPrefs);
        responseText = hasPastBotMessages
          ? `Nosso frete é grátis para pedidos acima de R$ 500 num raio de até 15km da loja. ${nextCta}`
          : `Olá! Aqui é a ${agentName} da loja. Nosso frete é grátis para pedidos acima de R$ 500 num raio de até 15km. ${nextCta}`;
      } else if (extractedFacts.capacity || lowerMsg.includes('caixa') || lowerMsg.includes('litros') || lowerMsg.includes('reservatorio')) {
        const capLabel = extractedFacts.capacity || evoData.customerContext?.capacity || "5 mil litros";
        const topic = !neighborhood ? 'freight_location' : (!paymentPref ? 'payment' : 'closing_advance');
        const nextCta = cta || aiAntiRepetitionService.getAlternativeCta(recentCtas, topic, knownPrefs);
        responseText = hasPastBotMessages
          ? `Temos a caixa d'água de ${capLabel} em polietileno com tampa de rosca pronta para entrega. ${nextCta}`
          : `Olá! Aqui é a ${agentName}. Temos a caixa d'água de ${capLabel} em polietileno com tampa de rosca pronta para entrega. ${nextCta}`;
      } else if (extractedFacts.neighborhood || lowerMsg.includes('bairro') || lowerMsg.includes('cep')) {
        const bairro = extractedFacts.neighborhood || evoData.customerContext?.neighborhood || 'seu bairro';
        const topic = !paymentPref ? 'payment' : 'closing_advance';
        const nextCta = cta || aiAntiRepetitionService.getAlternativeCta(recentCtas, topic, knownPrefs);
        responseText = hasPastBotMessages
          ? `Perfeito! Para entrega no ${bairro} temos rota rápida e conseguimos agilizar o frete. ${nextCta}`
          : `Olá! Aqui é a ${agentName}. Para entrega no ${bairro} temos rota rápida e conseguimos agilizar o frete. ${nextCta}`;
      } else if (extractedFacts.paymentPreference || lowerMsg.includes('pix') || lowerMsg.includes('cartao') || lowerMsg.includes('cartão') || lowerMsg.includes('pagar')) {
        const isPix = lowerMsg.includes('pix') || (extractedFacts.paymentPreference && extractedFacts.paymentPreference.includes('PIX'));
        const topic = !neighborhood ? 'freight_location' : 'closing_advance';
        const nextCta = cta || aiAntiRepetitionService.getAlternativeCta(recentCtas, topic, knownPrefs);
        responseText = hasPastBotMessages
          ? `Excelente! No ${isPix ? 'PIX' : 'cartão'} conseguimos as melhores condições comerciais à vista. ${nextCta}`
          : `Olá! Aqui é a ${agentName}. No ${isPix ? 'PIX' : 'cartão'} conseguimos as melhores condições comerciais à vista. ${nextCta}`;
      } else if (lowerMsg.includes('tijolo') || lowerMsg.includes('milheiro')) {
        const topic = !neighborhood ? 'freight_location' : (!paymentPref ? 'payment' : 'closing_advance');
        const nextCta = cta || aiAntiRepetitionService.getAlternativeCta(recentCtas, topic, knownPrefs);
        responseText = hasPastBotMessages
          ? `O milheiro do tijolo 8 furos está saindo por R$ 720,00 (com desconto no PIX). ${nextCta}`
          : `Olá! Aqui é a ${agentName}. O milheiro do tijolo 8 furos está saindo por R$ 720,00 (com desconto no PIX). ${nextCta}`;
      } else if (lowerMsg.includes('churrasqueira') || lowerMsg.includes('trio')) {
        const topic = !neighborhood ? 'freight_location' : (!paymentPref ? 'payment' : 'closing_advance');
        const nextCta = cta || aiAntiRepetitionService.getAlternativeCta(recentCtas, topic, knownPrefs);
        responseText = hasPastBotMessages
          ? `A Churrasqueira Trio pré-moldada completa sai por R$ 990,00 ou parcelada (com desconto no PIX). ${nextCta}`
          : `Olá! A Churrasqueira Trio pré-moldada completa sai por R$ 990,00 ou parcelada (com desconto no PIX). ${nextCta}`;
      } else {
        const nextCta = cta || aiAntiRepetitionService.getAlternativeCta(recentCtas, 'closing_advance', knownPrefs);
        const usedComCertezaRecently = recentBotReplies.some(r => r.text && r.text.toLowerCase().includes('com certeza'));
        const prefix = usedComCertezaRecently ? 'Perfeito!' : 'Com certeza!';
        responseText = hasPastBotMessages
          ? `${prefix} ${nextCta}`
          : `Olá! Aqui é a ${agentName} da loja. ${nextCta}`;
      }
    }

    // Step 5: Rule Validation against Layer 1 (Ensure no hallucinated prices)
    let validation = { isValid: true, valid: true, issues: [] };
    try {
      validation = await this.knowledgeEngine.validateAgainstOfficialRules(cleanCompany, responseText || '');
      if (!validation.isValid && !validation.valid) {
        console.warn('[Orchestrator] Rule conflict detected in response:', validation.issues);
      }
    } catch (_) {}

    // Step 5.1: Strict Anti-Repetition, Loop & Delirium Evaluation (Circuit Breaker)
    let circuitBreakerTriggered = false;
    let circuitBreakerReason = null;
    let needsHuman = false;
    let tagsToAdd = [];

    if (responseText) {
      const evalResult = aiAntiRepetitionService.evaluateCandidateReply({
        candidateReply: responseText,
        recentBotReplies,
        customerMessage,
        history: conversationHistory,
        knownPreferences: {
          product: evoData.customerContext?.product || evoData.customerContext?.activeProduct,
          capacity: evoData.customerContext?.capacity,
          neighborhood: evoData.customerContext?.neighborhood || evoData.customerContext?.deliveryCity,
          paymentPreference: evoData.customerContext?.paymentPreference,
        },
        validationIssues: validation.issues || [],
      });

      if (evalResult.circuitBreakerTriggered) {
        console.log(`[Orchestrator] Circuit Breaker triggered for conversation ${convId}: ${evalResult.circuitBreakerReason}`);
        circuitBreakerTriggered = true;
        circuitBreakerReason = evalResult.circuitBreakerReason;
        needsHuman = true;
        tagsToAdd = evalResult.tagsToAdd || ['intervencao_humana', 'precisa_humano', 'delirio_evitado'];
        responseText = evalResult.handoffReply;
      } else {
        responseText = evalResult.sanitizedReply;
        try {
          const { enforceResponseWordLimit } = require('../../../services/ai.service');
          responseText = enforceResponseWordLimit(responseText, agent);
        } catch (_) {}
      }
    }

    // Step 6: Learn into Active Agent Memory Graph (only on valid non-circuit-breaker replies)
    if (!circuitBreakerTriggered && responseText) {
      try {
        const agentMemoryGraphService = require('../../../services/agentMemoryGraphService');
        agentMemoryGraphService.learnFromInteraction({
          agentKey: agent?.key || 'camila',
          agentName: agent?.name || 'Camila',
          companyId: cleanCompany,
          contact: { ...store?.contact, phone, id: conversation?.lead_id, conversationId: convId, sessionId: sessionId || conversation?.sessionId },
          message: customerMessage,
          reply: responseText,
          sessionId: sessionId || conversation?.sessionId,
        }).catch(e => console.warn('[Orchestrator] learnFromInteraction error:', e.message));
      } catch (_) {}
    }

    // Step 7: Asynchronously record Experience Event (Layer 4)
    this.experienceEngine.recordExperienceEvent({
      conversationId: convId,
      leadId: conversation?.lead_id || null,
      companyId: cleanCompany,
      customerUtterance: customerMessage,
      intentDetected: leadAnalysis?.intent || evoData.customerContext.leadIntent || 'general',
      strategyApplied: evoData.activePlaybook?.slug || 'qualificacao_padrao',
      playbookId: evoData.activePlaybook?.id || null,
      aiReply: responseText,
      metadata: {
        playbookName: evoData.activePlaybook?.name,
        confidence: evoData.activePlaybook?.confidence,
        validationIssues: validation.issues,
      }
    }).catch(e => console.warn('[Orchestrator] recordExperienceEvent error:', e.message));

    return {
      response: responseText,
      reply: responseText,
      circuitBreakerTriggered,
      circuitBreakerReason,
      needsHuman,
      tagsToAdd,
      provider: providerUsed,
      model: modelUsed,
      responseTimeMs,
      promptTokens: tokens.promptTokens,
      completionTokens: tokens.completionTokens,
      totalTokens: tokens.totalTokens,
      agentName: agent?.name || 'Camila',
      activePlaybook: evoData.activePlaybook,
      customerContext: evoData.customerContext,
      ruleValidation: validation,
      analysis: {
        ...(aiResultData?.analysis || {}),
        trigger_quick_reply: triggerQuickReply,
      },
      quickReplyTriggered: triggerQuickReply,
      matchedCapability,
    };
  }
}

module.exports = new EvolutionaryAgentOrchestrator();
module.exports.EvolutionaryAgentOrchestrator = EvolutionaryAgentOrchestrator;
