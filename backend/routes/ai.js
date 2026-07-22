const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/ai/enable', aiController.enable);
router.post('/ai/disable', aiController.disable);
router.post('/ai/toggle', aiController.toggle);
router.get('/ai/status', aiController.status);
router.get('/ai/logs', aiController.getAiLogs);
router.get('/ai/metrics', aiController.getAiMetrics);
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

// === Agent Evolution & Learning ===
router.post('/ai/agent-evolve', aiController.evolveAgent);
router.get('/ai/agent-learning/:key', aiController.getAgentLearning);
router.post('/ai/agent-learning/:id/answer', aiController.answerLearningEvent);
router.post('/ai/agent-learning/:id/apply', aiController.applyLearningAnswer);
router.post('/ai/agent-learning/:id/ignore', aiController.ignoreLearningEvent);
router.get('/ai/agent-evolution/:key', aiController.getAgentEvolution);
router.post('/ai/agent-detect-gaps/:key', aiController.detectAgentGaps);

module.exports = router;

