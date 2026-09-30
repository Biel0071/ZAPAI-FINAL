const express = require('express');
const router = express.Router();
const aiConfigController = require('../controllers/aiConfigController');

router.post('/ai/improve', aiConfigController.improve);
router.get('/ai/memory', aiConfigController.getMemory);
router.post('/ai/memory', aiConfigController.saveMemory);
router.get('/ai/memory/analytics', aiConfigController.getMemoryAnalytics);
router.get('/ai/analytics', aiConfigController.getMemoryAnalytics); // alias used by Memory.tsx
router.get('/ai/memory/search', aiConfigController.searchMemory);
router.get('/ai/memory/graph', aiConfigController.getMemoryGraph);
router.get('/ai/memory/media', aiConfigController.getMemoryMedia);
router.get('/ai/evolution/media', aiConfigController.getMemoryMedia);
router.post('/ai/memory/flush', aiConfigController.flushMemory);

/**
 * POST /ai/compose/**
 * ZAI Inline Composer — generates or refines a WhatsApp response from an attendant instruction or action.
 * Body: { conversationId, contactName, contactPhone?, instruction?, currentDraft?, action?, recentMessages?, sessionId? }
 * Response: { message: string, detectedContext: object, suggestions: string[], success: boolean }
 */
router.post('/ai/compose', async (req, res) => {
  try {
    const {
      conversationId,
      contactName,
      contactPhone,
      instruction,
      currentDraft,
      action,
      recentMessages,
    } = req.body || {};

    const companyId = req.authTenantId;
    if (!companyId) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (!conversationId) return res.status(400).json({ success: false, error: 'conversationId required' });
    const { query } = require('../../infrastructure/config/database');
    const conversation = (await query(`SELECT c.session_id, c.remote_jid, c.agent_name, l.phone
      FROM conversations c LEFT JOIN leads l ON l.id=c.lead_id AND l.company_id=c.company_id
      WHERE c.id=$1 AND c.company_id=$2`, [conversationId, companyId])).rows[0];
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    const verifiedPhone = conversation.remote_jid || conversation.phone;
    const conversationMemoryEngine = require('../../../services/conversationMemoryEngine');
    const quickReplyCapability = require('../../../services/quickReplyCapability');

    // Recuperar memória ativa em múltiplos níveis
    let memory = null;
    try {
      if (conversation.session_id && verifiedPhone) memory = await conversationMemoryEngine.getConversationMemory({
        contactId: verifiedPhone,
        phone: verifiedPhone,
        companyId,
        sessionId: conversation.session_id,
      });
    } catch (_) {}

    // Identificar contexto e produto discutido
    let detectedProduct = memory?.commercial?.activeProduct || null;
    if (!detectedProduct && Array.isArray(recentMessages)) {
      const allText = recentMessages.map((m) => m.content || '').join(' ').toLowerCase();
      if (allText.includes('caixa d') || allText.includes('caixa dagua')) detectedProduct = "Caixa d'água 5.000L";
      else if (allText.includes('churrasqueira')) detectedProduct = "Churrasqueira pré-moldada";
      else if (allText.includes('cimento')) detectedProduct = "Cimento";
    }

    const detectedContext = {
      product: detectedProduct || (memory?.commercial?.capacity ? `Produto (${memory.commercial.capacity})` : 'Produto de interesse'),
      capacity: memory?.commercial?.capacity || null,
      deliveryCity: memory?.commercial?.deliveryCity || null,
      intent: memory?.intent || 'Cotação / Atendimento',
      summary: memory?.summary || (detectedProduct ? `Interesse em ${detectedProduct}` : 'Atendimento ativo'),
    };

    const suggestions = [
      'Enviar foto do produto',
      'Informar preço e condições',
      'Explicar prazo e entrega',
      'Responder sobre formas de pagamento',
    ];

    // Se não há mensagens nem rascunho nem instrução nem ação (consulta vazia de contexto)
    const hasHistory = Array.isArray(recentMessages) && recentMessages.length > 0;
    if (!instruction && !currentDraft && !action && !hasHistory) {
      return res.status(200).json({
        success: true,
        message: '',
        detectedContext,
        suggestions,
      });
    }

    // Montar diretriz de ação
    let actionInstruction = '';
    if (action === 'shorten') {
      actionInstruction = 'Reescreva a mensagem para torná-la extremamente curta, concisa e direta ao ponto (1 ou 2 frases), mantendo o tom amigável.';
    } else if (action === 'expand') {
      actionInstruction = 'Expanda a mensagem trazendo mais detalhes explicativos, benefícios e orientações completas para esclarecer o cliente.';
    } else if (action === 'commercial') {
      actionInstruction = 'Torne a mensagem mais persuasiva e comercialmente atraente, com foco em fechamento de venda e chamada para ação clara.';
    } else if (action === 'natural') {
      actionInstruction = 'Torne o texto mais humano, natural, simpático e informal (padrão WhatsApp brasileiro).';
    } else if (action === 'professional') {
      actionInstruction = 'Torne o texto profissional, polido, claro e seguro.';
    } else if (action === 'friendly') {
      actionInstruction = 'Torne a mensagem calorosa, acolhedora e muito simpática.';
    } else if (action === 'add_delivery') {
      actionInstruction = `Adicione informações ou pergunta sobre o prazo de entrega e cálculo do frete ${memory?.commercial?.deliveryCity ? `para ${memory.commercial.deliveryCity}` : 'solicitando o endereço ou CEP'}.`;
    } else if (action === 'add_price') {
      actionInstruction = 'Informe preços e condições somente se estiverem no conhecimento oficial. Caso contrário, peça confirmação ao atendente.';
    } else if (action === 'add_payment') {
      actionInstruction = 'Apresente somente as formas de pagamento cadastradas no conhecimento oficial. Não invente descontos ou parcelamento.';
    } else if (action === 'improve') {
      actionInstruction = 'Melhore a clareza, pontuação, simpatia e impacto da mensagem.';
    } else if (!action && !instruction && !currentDraft && hasHistory) {
      actionInstruction = 'Gere uma sugestão de resposta cordial, direta e comercialmente precisa respondendo à última mensagem do cliente, considerando o produto e memória.';
    }

    const COMPOSE_SYSTEM_PROMPT = `Você é um copiloto de atendimento comercial de elite para WhatsApp.
Sua função é auxiliar o atendente humano a responder ou refinar mensagens para clientes.
Responda APENAS com a mensagem pronta para envio ao cliente — sem aspas, sem explicações prévias, sem prefixos.
Use português brasileiro natural, empático e profissional.
Adapte-se estritamente ao produto em foco (${detectedContext.product}) e dados da conversa.
Nunca invente preços ou prazos que contradigam o contexto.`;

    const contactStr = contactName ? `Cliente: ${contactName}` : 'Cliente';
    let historyBlock = '';
    if (Array.isArray(recentMessages) && recentMessages.length > 0) {
      historyBlock = '\n\nHistórico recente da conversa:\n' +
        recentMessages.map((m) => `${m.role === 'assistant' ? 'Atendente' : 'Cliente'}: ${m.content}`).join('\n');
    }

    let memoryBlock = '';
    if (memory) {
      memoryBlock = `\nContexto registrado: Produto: ${detectedContext.product} | Cidade: ${detectedContext.deliveryCity || 'A definir'} | Intenção: ${detectedContext.intent}\n`;
    }

    const draftBlock = currentDraft ? `\nTexto já rascunhado pelo atendente:\n"${currentDraft}"\n` : '';
    const userInstructionText = instruction ? `\nInstrução adicional do atendente: ${instruction}` : '';
    const actionText = actionInstruction ? `\nAção solicitada: ${actionInstruction}` : '';

    const userMessage = `${contactStr}${historyBlock}${memoryBlock}${draftBlock}${actionText}${userInstructionText}

Gere a versão final da mensagem para o atendente enviar ao cliente:`;

    const { testAIConnection } = require('../../../services/ai.service');
    const agentService = require('../../ai/agents/services/aiAgentService');
    const agents = await agentService.listAgents(companyId);
    const agent = agents.find(item => item.key === conversation.agent_name || item.name === conversation.agent_name)
      || (!conversation.agent_name ? agents.find(item => item.active !== false && item.sessionIds?.includes(conversation.session_id)) : null);
    if (!agent) return res.status(409).json({ success: false, error: 'Selecione um agente para esta conversa.' });
    const result = await testAIConnection({ store: req.app.locals.store, companyId, sessionId: conversation.session_id, agentKey: agent.key, message: userMessage, prompt: (agent.personality || '') + '\n\n' + COMPOSE_SYSTEM_PROMPT, history: Array.isArray(recentMessages) ? recentMessages.map(item => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content || '' })) : [] });

    const generatedMessage = result?.response || '';

    if (!result?.ok || !generatedMessage) {
      return res.status(503).json({ success: false, error: result?.error || 'Erro ao gerar resposta.' });
    }

    return res.status(200).json({
      success: true,
      message: generatedMessage.trim(),
      detectedContext,
      suggestions,
    });
  } catch (error) {
    console.error('[AI COMPOSE] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Erro ao gerar resposta.' });
  }
});

/**
 * Registra feedback de edição humana sobre sugestão da IA para aprendizado progressivo
 */
router.post('/ai/learning/feedback', async (req, res) => {
  try {
    const companyId = req.authTenantId;
    if (!companyId) return res.status(401).json({ success: false, error: 'Autenticação da empresa obrigatória.' });
    const { agentKey, customerQuestion, aiResponse, humanAnswer, conversationId } = req.body || {};
    if (!conversationId || typeof humanAnswer !== 'string' || !humanAnswer.trim()) {
      return res.status(400).json({ success: false, error: 'Conversa e resposta revisada são obrigatórias.' });
    }
    if ([customerQuestion, aiResponse, humanAnswer].some(value => value != null && (typeof value !== 'string' || value.length > 10000))) {
      return res.status(400).json({ success: false, error: 'Feedback inválido ou maior que 10.000 caracteres.' });
    }
    const { query } = require('../../../src/infrastructure/config/database');
    const conversation = (await query(`
      SELECT c.id, c.session_id, c.agent_name, l.phone, l.name
      FROM conversations c
      LEFT JOIN leads l ON l.id = c.lead_id AND l.company_id = c.company_id
      WHERE c.id = $1 AND c.company_id = $2
      LIMIT 1
    `, [conversationId, companyId])).rows[0];
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversa não encontrada nesta empresa.' });
    const agentService = require('../../ai/agents/services/aiAgentService');
    const agents = await agentService.listAgents(companyId);
    const normalize = value => String(value || '').trim().toLowerCase();
    const matchesAgent = (agent, value) => normalize(agent.key) === normalize(value) || normalize(agent.name) === normalize(value);
    const agent = agents.find(item => matchesAgent(item, agentKey || conversation.agent_name));
    if (!agent) return res.status(404).json({ success: false, error: 'Agente não encontrado nesta empresa.' });
    if (conversation.agent_name && !matchesAgent(agent, conversation.agent_name)) {
      return res.status(409).json({ success: false, error: 'O agente não corresponde à conversa selecionada.' });
    }

    const insertRes = await query(`
      INSERT INTO agent_learning_events (
        agent_key, company_id, event_type, customer_question, ai_response, human_answer,
        contact_phone, contact_name, conversation_id, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
      RETURNING id, status
    `, [
      agent.key,
      companyId,
      'human_edit_feedback',
      customerQuestion || 'Interação no atendimento',
      aiResponse || '',
      humanAnswer.trim(),
      conversation.phone || null,
      conversation.name || null,
      conversation.id,
    ]);

    return res.status(200).json({ success: true, eventId: insertRes.rows[0]?.id, status: 'pending' });
  } catch (err) {
    console.error('[AI FEEDBACK] Error:', err.message);
    return res.status(503).json({ success: false, error: 'Não foi possível registrar o feedback. Tente novamente.' });
  }
});

router.get('/config/business-hours', aiConfigController.getBusinessHours);
router.post('/config/business-hours', aiConfigController.saveBusinessHours);
router.get('/config/absence-message', aiConfigController.getAbsenceMessage);
router.post('/config/absence-message', aiConfigController.saveAbsenceMessage);
router.get('/config/advanced-ai', aiConfigController.getAdvancedAI);
router.post('/config/advanced-ai', aiConfigController.saveAdvancedAI);
router.get('/config/ai-agents', aiConfigController.getAIAgents);
router.post('/config/ai-agents', aiConfigController.createAIAgent);
router.put('/config/ai-agents/:key', aiConfigController.updateAIAgent);
router.patch('/config/ai-agents/:key/active', aiConfigController.toggleAIAgent);
router.delete('/config/ai-agents/:key', aiConfigController.deleteAIAgent);
router.post('/config/ai-agents/:key/clone', aiConfigController.cloneAIAgent);
router.get('/config/ai/evolution', aiConfigController.getAIEvolution);
router.get('/ai/evolution/overview', aiConfigController.getAIEvolution);
router.get('/config/ai/pipeline-logs', aiConfigController.getPipelineLogs);

router.get('/config/user-providers', aiConfigController.getUserProviders);
router.post('/config/user-providers', aiConfigController.saveUserProvider);

router.post('/config/ai/restart', async (req, res) => {
  try {
    const aiService = require('../../../services/ai.service');
    const aiAgentService = require('../../ai/agents/services/aiAgentService');

    if (typeof aiService.clearResponseCache === 'function') {
      aiService.clearResponseCache();
    }

    if (typeof aiAgentService.resetCache === 'function') {
      aiAgentService.resetCache(req.tenantId || req.companyId || process.env.DEFAULT_COMPANY_ID || 'default');
    }

    return res.status(200).json({ success: true, message: 'AI restarted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/config/ai/deploy-vps', async (req, res) => {
  return res.status(409).json({ success: false, error: 'A publicação exige uma versão e um artefato revisados pelo procedimento operacional de deploy.' });
});

router.get('/queue', aiConfigController.getQueue);
router.post('/queue/process', aiConfigController.processQueue);

module.exports = router;
