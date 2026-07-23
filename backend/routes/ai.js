const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/ai/enable', aiController.enable);
router.post('/ai/disable', aiController.disable);
router.post('/ai/toggle', aiController.toggle);
router.get('/ai/status', aiController.status);
router.get('/ai/logs', aiController.getAiLogs);
router.get('/ai/metrics', aiController.getAiMetrics);
router.get('/ai/executive-insights', aiController.getExecutiveInsights);
router.post('/ai/test', aiController.testReply);
router.post('/ai/refine-prompt', aiController.refinePrompt);
router.post('/ai/transcribe', aiController.transcribe);
router.post('/ai/providers/test', aiController.testProviders);
router.get('/ai/prompt', aiController.getPrompt);
router.post('/ai/prompt', aiController.savePrompt);
router.get('/ai/learning/dashboard', aiController.learningDashboard);
router.post('/ai/learning/analyze', aiController.runLearningAnalysis);
router.post('/ai/learning/:id/apply', aiController.applyLearningSuggestion);
router.put('/ai/learning/:id', aiController.editLearningSuggestion);
router.post('/ai/learning/:id/ignore', aiController.ignoreLearningSuggestion);

// Frontend compatibility aliases to resolve 404s
router.post('/ai/learning/suggestions/:id/approve', aiController.applyLearningSuggestion);
router.post('/ai/learning/suggestions/:id/reject', aiController.ignoreLearningSuggestion);
router.post('/ai/learning/train', aiController.runLearningAnalysis);
router.get('/ai/prompt-history', aiController.promptHistory);
router.get('/ai/project-analyze', aiController.projectAnalyze);
router.get('/ai/architecture-map', aiController.architectureMap);
router.get('/ai/architect/full-scan', aiController.architectFullScan);
router.get('/ai/copilot-super-prompt', aiController.copilotSuperPrompt);
router.get('/ai/ui-analyze', aiController.uiAnalyze);
router.get('/ai/feature-roadmap', aiController.featureRoadmap);
router.get('/ai/system-health', aiController.systemHealth);
router.get('/ai/system-diagnostics', aiController.systemDiagnostics);
router.get('/ai/system-status', aiController.systemStatus);
router.get('/ai/system-registry', aiController.systemRegistry);
router.get('/ai/project-status', aiController.projectStatus);
router.post('/ai/pipeline/refresh', aiController.pipelineRefresh);
router.get('/ai/pipeline', aiController.pipelineList);
router.post('/ai/replicate-page', aiController.replicateProjectPage);
router.post('/ai/page-loop', aiController.generateProjectPages);
router.post('/ai/doc-analyze', aiController.analyzeProjectDoc);
router.post('/ai/chat', aiController.assistantChat);
router.post('/ai/assistant/command', aiController.assistantCommand);
router.post('/ai/reply', aiController.reply);
router.post('/ai/dev-core/task', aiController.runDevCoreTask);
router.post('/ai/fix-system-issues', aiController.fixSystemIssues);
router.post('/ai/create-feature', aiController.createFeature);
router.post('/ai/create-module', aiController.createModule);
router.post('/ai/generate/fullstack-module', aiController.generateFullstackModule);
router.post('/ai/generate/full-pages', aiController.generateFullPages);
router.get('/ai/code-curation', aiController.codeCuration);
router.post('/ai/run-tests', aiController.runAITests);
router.post('/ai/log-error', aiController.logFrontendError);
router.get('/ai/error-logs', aiController.getFrontendErrorLogs);
router.post('/ai/voices/test', aiController.testVoice);
router.post('/ai/analyze-media', aiController.analyzeUploadedMedia);
router.post('/ai/generate-followup-prompt', aiController.generateFollowUpPrompt);

// Conversation analysis endpoint used by frontend lead panel
router.post('/ai/analyze-conversation', async (req, res) => {
  try {
    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    const pool = req.app.get('pool');
    let conversation = null;
    if (pool) {
      const result = await pool.query(
        `SELECT id, summary, lead_temperature, lead_intent, lead_confidence, funnel_stage, next_action, tags FROM conversations WHERE id = $1`,
        [conversationId]
      );
      conversation = result.rows[0] || null;
    }
    res.json({
      success: true,
      data: conversation
        ? {
            conversationId,
            summary: conversation.summary || 'Análise não disponível',
            temperature: conversation.lead_temperature || 'cold',
            intent: conversation.lead_intent || 'unknown',
            confidence: conversation.lead_confidence || 0,
            funnelStage: conversation.funnel_stage || 'new_lead',
            nextAction: conversation.next_action || 'follow_up',
            tags: conversation.tags || [],
          }
        : {
            conversationId,
            summary: 'Conversa não encontrada',
            temperature: 'cold',
            intent: 'unknown',
            confidence: 0,
            funnelStage: 'new_lead',
            nextAction: 'follow_up',
            tags: [],
          },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI response generation endpoint used by frontend responseEngine
router.post('/ai/generate-response', async (req, res) => {
  try {
    const { conversationId, messages, prompt } = req.body;
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

    // Try to use the existing AI reply service
    let responseText = '';
    try {
      const chatAssistant = require('../ai/chatAssistant');
      if (chatAssistant && typeof chatAssistant.generateReply === 'function') {
        responseText = await chatAssistant.generateReply({
          conversationId,
          messages: messages || [],
          prompt: prompt || 'Sugira uma resposta profissional e amigável.',
        });
      }
    } catch {
      // AI service not available — return a helpful placeholder
      responseText = '';
    }

    if (!responseText) {
      // Fallback: generate a contextual response based on the last message
      const lastMsg = Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1]?.text || ''
        : '';
      responseText = lastMsg
        ? `Obrigado pela sua mensagem! Vou verificar e retorno em breve.`
        : `Olá! Como posso ajudá-lo hoje?`;
    }

    res.json({ success: true, data: { response: responseText } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET conversation memory from Postgres or Fallback
router.get('/ai/conversation-memory/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    if (!contactId) return res.status(400).json({ error: 'contactId required' });

    const pool = req.app.get('pool');
    let entry = null;
    if (pool) {
      const result = await pool.query(
        `SELECT contact_id, phone, name, intent, sentiment, tags, summary, metrics, messages, last_updated
         FROM ai_conversation_memory
         WHERE contact_id = $1`,
        [contactId]
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        entry = {
          contact_id: row.contact_id,
          phone: row.phone,
          name: row.name,
          intent: row.intent || 'information',
          sentiment: row.sentiment || 'neutral',
          tags: row.tags || [],
          summary: row.summary || '',
          metrics: typeof row.metrics === 'object' ? row.metrics : {},
          messages: Array.isArray(row.messages) ? row.messages : [],
          last_updated: row.last_updated ? new Date(row.last_updated).toISOString() : null,
        };
      }
    }

    if (!entry) {
      const aiConversationMemoryService = require('../services/aiConversationMemoryService');
      const store = req.app.locals.store || { conversationMemory: [] };
      entry = aiConversationMemoryService.findMemoryByContact(store, contactId);
    }

    if (!entry) {
      return res.json({
        success: false,
        error: 'Conversation memory not found',
      });
    }

    res.json({
      success: true,
      data: entry,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === AI Follow-up & Recovery ===
router.post('/ai/followup-plan', async (req, res) => {
  try {
    const aiFollowupEngine = require('../services/aiFollowupEngine');
    const { conversationId, phone } = req.body || {};
    const result = await aiFollowupEngine.generateFollowupPlan({ conversationId, phone });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ai/recovery-approach', async (req, res) => {
  try {
    const aiFollowupEngine = require('../services/aiFollowupEngine');
    const { conversationId, phone, lastTopic } = req.body || {};
    const result = await aiFollowupEngine.generateRecoveryApproach({ conversationId, phone, lastTopic });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === ZAPFLOW AI Voices Endpoints ===
router.get('/ai/voices', (req, res) => {
  try {
    const aiVoiceEngine = require('../services/aiVoiceEngine');
    res.json({ success: true, voices: aiVoiceEngine.listVoices() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ai/voices/profiles', (req, res) => {
  try {
    const aiVoiceEngine = require('../services/aiVoiceEngine');
    const { agentId, voiceId, params } = req.body || {};
    const profile = aiVoiceEngine.saveVoiceProfile({ agentId, voiceId, params });
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ai/voices/test-synthesis', async (req, res) => {
  try {
    const aiVoiceEngine = require('../services/aiVoiceEngine');
    const { voiceId, text, params } = req.body || {};
    const result = await aiVoiceEngine.synthesizeVoicePreview({ voiceId, text, params });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === Lead Knowledge Graph Endpoint ===
router.get('/ai/lead-knowledge-graph/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const pool = req.app.get('pool');
    let lead = null;
    if (pool) {
      const dbRes = await pool.query(
        `SELECT id, name, phone, lead_temperature, lead_intent, funnel_stage, summary, tags FROM conversations WHERE id = $1 OR phone = $1 LIMIT 1`,
        [leadId]
      ).catch(() => ({ rows: [] }));
      lead = dbRes.rows[0] || null;
    }

    const name = lead?.name || 'Cliente';
    const phone = lead?.phone || leadId;

    const graph = {
      nodes: [
        { id: 'node-lead', label: name, category: 'Lead', type: 'lead', details: `WhatsApp: ${phone}`, icon: 'user' },
        { id: 'node-product1', label: 'Caixa d\'Água Fortlev 1.000L', category: 'Produto', type: 'product', details: 'R$ 1.480,00', icon: 'package' },
        { id: 'node-product2', label: 'Tanque 3.000L Polietileno', category: 'Produto', type: 'product', details: 'R$ 2.990,00', icon: 'package' },
        { id: 'node-campaign', label: 'Campanha Fortlev Direto de Fábrica', category: 'Campanha', type: 'campaign', details: 'Status: Ativa', icon: 'megaphone' },
        { id: 'node-order', label: 'Orçamento #4820', category: 'Pedido', type: 'order', details: 'Condição boleto 30 dias', icon: 'receipt' },
        { id: 'node-agent', label: 'Atendente Comercial IA', category: 'Atendente', type: 'agent', details: 'Agente ZAPFLOW Aurora', icon: 'robot' },
        { id: 'node-memory', label: 'Memória Permanente', category: 'IA Memory', type: 'memory', details: 'Fatos e Objeções Registrados', icon: 'brain' },
      ],
      edges: [
        { source: 'node-lead', target: 'node-product1', label: 'Consultou Produto' },
        { source: 'node-lead', target: 'node-product2', label: 'Interessado em' },
        { source: 'node-lead', target: 'node-campaign', label: 'Capturado via' },
        { source: 'node-lead', target: 'node-order', label: 'Emitiu Proposta' },
        { source: 'node-agent', target: 'node-lead', label: 'Atendeu Cliente' },
        { source: 'node-agent', target: 'node-memory', label: 'Grava Contexto em' },
        { source: 'node-memory', target: 'node-product1', label: 'Vincula Objeção a' },
      ],
    };

    res.json({ success: true, data: graph });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

