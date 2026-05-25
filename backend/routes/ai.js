const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/ai/enable', aiController.enable);
router.post('/ai/disable', aiController.disable);
router.post('/ai/toggle', aiController.toggle);
router.get('/ai/status', aiController.status);
router.get('/ai/prompt', aiController.getPrompt);
router.post('/ai/prompt', aiController.savePrompt);
router.get('/ai/learning/dashboard', aiController.learningDashboard);
router.post('/ai/learning/analyze', aiController.runLearningAnalysis);
router.post('/ai/learning/:id/apply', aiController.applyLearningSuggestion);
router.put('/ai/learning/:id', aiController.editLearningSuggestion);
router.post('/ai/learning/:id/ignore', aiController.ignoreLearningSuggestion);
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

module.exports = router;

