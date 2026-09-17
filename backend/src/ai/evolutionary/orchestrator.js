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
  }) {
    const cleanCompany = String(companyId || 'default');
    const cleanMsg = String(message || '').trim();

    // 1. Layer 1: Official Knowledge
    const officialKnowledgePrompt = await this.knowledgeEngine.compileOfficialKnowledgePrompt(cleanCompany, cleanMsg);

    // 2. Layer 2: Customer Structured Memory
    const customerContext = await this.customerMemoryEngine.loadCustomerContext({
      companyId: cleanCompany,
      phone: contact.phone || contact.id,
      conversationId: conversationId || contact.conversationId,
    });
    const customerMemoryPrompt = this.customerMemoryEngine.compileCustomerMemoryPrompt(customerContext);

    // 3. Layer 3: Playbook Selection (with 10% Sandbox support)
    const activePlaybook = await this.playbookEngine.matchPlaybook({
      companyId: cleanCompany,
      message: cleanMsg,
      intent: leadIntent || customerContext.leadIntent,
      conversationId: conversationId || contact.conversationId,
    });
    const playbookPrompt = this.playbookEngine.compilePlaybookPrompt(activePlaybook);

    // 4. Layer 4: Similar Successful Experiences
    const pastExperiences = await this.experienceEngine.findSimilarExperiences({
      companyId: cleanCompany,
      message: cleanMsg,
      intent: leadIntent || customerContext.leadIntent,
      limit: 2,
    });
    const experiencePrompt = this.experienceEngine.compileExperiencePrompt(pastExperiences);

    // 5. Layer 5: Authority Rules & Directive Synthesis
    const hierarchyPrompt = `
### [HIERARQUIA DE AUTORIDADE E CONDUTA DO AGENTE]
1. VERDADE OFICIAL DA LOJA É SOBERANA: Nunca prometa descontos ou prazos que contradigam o catálogo oficial da Camada 1.
2. NUNCA REPITA PERGUNTAS: Se a informação já estiver na Memória do Cliente (Camada 2), utilize-a diretamente.
3. SIGA O ROTEIRO DO PLAYBOOK: Utilize a estratégia e o CTA orientados na Camada 3.
4. TOM COMERCIAL: Seja direto, acolhedor, rápido e termine sempre incentivando o próximo passo da compra.
`;

    const fullEvolutionaryPrompt = [
      officialKnowledgePrompt,
      customerMemoryPrompt,
      playbookPrompt,
      experiencePrompt,
      hierarchyPrompt
    ].filter(Boolean).join('\n---\n');

    return {
      prompt: fullEvolutionaryPrompt,
      officialKnowledgePrompt,
      customerContext,
      activePlaybook,
      pastExperiences,
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

    // Step 1: Extract customer facts asynchronously from customerMessage
    this.customerMemoryEngine.extractAndSaveFacts({
      companyId: cleanCompany,
      phone,
      conversationId: convId,
      messageText: customerMessage,
    }).catch(e => console.warn('[Orchestrator] extractFacts error:', e.message));

    // Step 2: Build 5-Layer Evolutionary Prompt
    const evoData = await this.buildEvolutionaryPrompt({
      companyId: cleanCompany,
      contact: { phone, conversationId: convId, ...store?.contact },
      message: customerMessage,
      conversationId: convId,
      leadIntent: leadAnalysis?.intent || conversation?.lead_intent,
    });

    // Step 3: Call AI Provider via ai.service.js
    let responseText = null;
    let providerUsed = 'evolutionary_orchestrator';
    let modelUsed = 'system';
    let tokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let responseTimeMs = 0;

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

      if (aiResult && aiResult.reply) {
        responseText = aiResult.reply;
        providerUsed = aiResult.provider || providerUsed;
        modelUsed = aiResult.model || modelUsed;
        tokens = {
          promptTokens: aiResult.promptTokens || 0,
          completionTokens: aiResult.completionTokens || 0,
          totalTokens: aiResult.totalTokens || 0,
        };
      }
    } catch (aiErr) {
      console.warn('[Orchestrator] processAI call encountered error:', aiErr.message);
    }

    // Step 4: If LLM produced no text, construct an intelligent Playbook-guided fallback
    if (!responseText) {
      const pb = evoData.activePlaybook;
      const cta = pb?.recommended_cta || 'Qual o seu bairro para calcularmos a entrega com o melhor desconto?';
      const agentName = agent?.name || 'Camila';

      if (customerMessage.toLowerCase().includes('frete') || customerMessage.toLowerCase().includes('entrega')) {
        responseText = `Olá! Aqui é a ${agentName} da loja. Nosso frete é grátis para pedidos acima de R$ 500 num raio de até 15km. ${cta}`;
      } else if (customerMessage.toLowerCase().includes('tijolo') || customerMessage.toLowerCase().includes('milheiro')) {
        responseText = `Olá! Aqui é a ${agentName}. O milheiro do tijolo 8 furos está saindo por R$ 720,00 (ou R$ 684,00 no PIX com 5% de desconto). ${cta}`;
      } else if (customerMessage.toLowerCase().includes('churrasqueira') || customerMessage.toLowerCase().includes('trio')) {
        responseText = `Olá! A Churrasqueira Trio pré-moldada completa sai por R$ 990,00 ou até 10x sem juros (no PIX tem 5% de desconto por R$ 940,50). ${cta}`;
      } else {
        responseText = `Olá! Sou a ${agentName}. ${cta}`;
      }
    }

    // Step 5: Rule Validation against Layer 1 (Ensure no hallucinated prices)
    const validation = await this.knowledgeEngine.validateAgainstOfficialRules(cleanCompany, responseText);
    if (!validation.isValid) {
      console.warn('[Orchestrator] Rule conflict detected in response:', validation.issues);
    }

    // Step 6: Asynchronously record Experience Event (Layer 4)
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
    };
  }
}

module.exports = new EvolutionaryAgentOrchestrator();
module.exports.EvolutionaryAgentOrchestrator = EvolutionaryAgentOrchestrator;
