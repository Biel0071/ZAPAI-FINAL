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
    const { query } = require('../config/database');
    const companyId = req.companyId || process.env.DEFAULT_COMPANY_ID || 'default';

    // 1. Lead — real. name/phone live on `leads`; funnel/temperature on `conversations`.
    const leadRes = await query(
      `SELECT c.id, c.lead_temperature, c.lead_intent, c.funnel_stage, c.summary,
              c.tags, c.agent_name, c.company_id, l.name, l.phone
       FROM conversations c
       LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.id::text = $1 OR l.phone = $1
       LIMIT 1`,
      [String(leadId)]
    ).catch(() => ({ rows: [] }));

    const lead = leadRes.rows[0] || null;
    const name = lead?.name || 'Cliente';
    const phone = lead?.phone || String(leadId);
    const company = lead?.company_id || companyId;

    const nodes = [];
    const edges = [];

    const leadDetails = [
      phone ? `WhatsApp: ${phone}` : null,
      lead?.funnel_stage ? `Funil: ${lead.funnel_stage}` : null,
      lead?.lead_temperature ? `Temperatura: ${lead.lead_temperature}` : null,
    ].filter(Boolean).join(' • ') || `WhatsApp: ${phone}`;
    nodes.push({ id: 'node-lead', label: name, category: 'Lead', type: 'lead', details: leadDetails, icon: 'user' });

    // 2. Agent — real, from conversations.agent_name
    if (lead?.agent_name) {
      nodes.push({ id: 'node-agent', label: lead.agent_name, category: 'Atendente', type: 'agent', details: 'Atendente IA responsável', icon: 'robot' });
      edges.push({ source: 'node-agent', target: 'node-lead', label: 'Atendeu Cliente' });
    }

    // 3. Campaigns that reached this lead — real JSONB scan by phone
    if (phone) {
      const campRes = await query(
        `SELECT id, name, status FROM campaigns
         WHERE company_id = $2
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(COALESCE(selected_contacts, '[]'::jsonb)) sc
             WHERE sc->>'phone' = $1 OR sc->>'number' = $1 OR REPLACE(sc->>'phone','+','') LIKE '%' || RIGHT($1, 8) || '%'
           )
         ORDER BY created_at DESC LIMIT 8`,
        [phone.replace(/\D/g, ''), company]
      ).catch(() => ({ rows: [] }));

      campRes.rows.forEach((camp, idx) => {
        const nid = `node-campaign-${idx}`;
        nodes.push({ id: nid, label: camp.name, category: 'Campanha', type: 'campaign', details: `Status: ${camp.status || 'n/d'}`, icon: 'megaphone' });
        edges.push({ source: 'node-lead', target: nid, label: 'Capturado via' });
      });
    }

    // 4. Memory nodes — real, agent_memory_nodes filtered by contact phone
    try {
      const memRes = await query(
        `SELECT node_key, node_type, label, content FROM agent_memory_nodes
         WHERE company_id = $1 AND (properties->>'contactPhone') = $2
         ORDER BY weight DESC NULLS LAST, last_seen_at DESC NULLS LAST LIMIT 12`,
        [company, phone.replace(/\D/g, '')]
      );
      memRes.rows.forEach((mem, idx) => {
        const isProduct = mem.node_type === 'product_media' || mem.node_type === 'concept';
        const nid = `node-mem-${idx}`;
        nodes.push({
          id: nid,
          label: mem.label || mem.node_key,
          category: isProduct ? 'Produto/Interesse' : 'Memória IA',
          type: isProduct ? 'product' : 'memory',
          details: (mem.content || '').slice(0, 120) || 'Registro de memória',
          icon: isProduct ? 'package' : 'brain',
        });
        edges.push({ source: 'node-lead', target: nid, label: isProduct ? 'Interessado em' : 'Memória registrada' });
      });
    } catch {
      // agent_memory_nodes pode não existir em bases antigas — ignora
    }

    // 5. Persistent facts (ai_memory_long) — real, keyed by chat_id = phone
    try {
      const factRes = await query(
        `SELECT category, content FROM ai_memory_long
         WHERE chat_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 8`,
        [phone.replace(/\D/g, '')]
      );
      if (factRes.rows.length > 0) {
        nodes.push({ id: 'node-memory-facts', label: 'Memória Permanente', category: 'IA Memory', type: 'memory', details: `${factRes.rows.length} fato(s)/objeção(ões) registrados`, icon: 'brain' });
        edges.push({ source: 'node-lead', target: 'node-memory-facts', label: 'Contexto persistente' });
      }
    } catch {
      // ai_memory_long pode não existir — ignora
    }

    res.json({ success: true, data: { nodes, edges, lead: lead ? { name, phone } : null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

