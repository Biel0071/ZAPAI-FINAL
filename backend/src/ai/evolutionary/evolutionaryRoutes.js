/**
 * Evolutionary AI Routes — Express Router for the 5-Layer Evolutionary System
 *
 * Exposes endpoints for:
 * - Evolution Metrics & Health
 * - Official Knowledge CRUD (Layer 1)
 * - Playbooks CRUD & Sandbox (Layer 3 & 5)
 * - Suggestions Approval/Rejection/Sandbox (Layer 5)
 * - Operator Feedback (Layer 4)
 * - Realtime Conversation AI Learning Context (Inbox Sidebar)
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString });

const knowledgeEngine = require('./knowledgeEngine');
const customerMemoryEngine = require('./customerMemoryEngine');
const playbookEngine = require('./playbookEngine');
const experienceEngine = require('./experienceEngine');
const learningEngine = require('./learningEngine');
const humanAttendanceLearner = require('./humanAttendanceLearner');

function getCompanyId(req) {
  if (req.authTenantId) return req.authTenantId;
  const devBypass = String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production'
    && String(process.env.ALLOW_DEV_AUTH_BYPASS || '').toLowerCase() === 'true';
  return devBypass ? req.tenantId || 'default' : null;
}

router.use((req, res, next) => {
  if (!getCompanyId(req)) {
    return res.status(401).json({ success: false, error: 'Authenticated tenant required.' });
  }
  return next();
});

// 1. GET /api/ai/evolution/metrics
router.get('/metrics', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const metrics = await learningEngine.getEvolutionMetrics({ companyId });
    res.json({ success: true, data: metrics });
  } catch (err) {
    console.error('[EvolutionaryRoutes] Failed to load metrics:', err);
    res.status(500).json({ success: false, error: 'Falha ao carregar métricas de evolução.' });
  }
});

// 2. GET /api/ai/evolution/official-knowledge
router.get('/official-knowledge', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const category = req.query.category || null;
    const search = req.query.q || '';

    let items;
    if (search) {
      items = await knowledgeEngine.searchOfficialKnowledge(companyId, search, category, 50);
    } else {
      const result = await pool.query(
        `SELECT id, category, key, title, content, raw_text, tags, is_active, updated_at
         FROM company_official_knowledge
         WHERE company_id = $1 AND ($2::varchar IS NULL OR category = $2)
         ORDER BY id ASC`,
        [companyId, category]
      );
      items = result.rows;
    }

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alias: GET /api/ai/evolution/knowledge -> delegates to /official-knowledge
router.get('/knowledge', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const category = req.query.category || null;
    const search = req.query.q || '';
    let items;
    if (search) {
      items = await knowledgeEngine.searchOfficialKnowledge(companyId, search, category, 50);
    } else {
      const result = await pool.query(
        `SELECT id, category, key, title, content, raw_text, tags, is_active, updated_at
         FROM company_official_knowledge
         WHERE company_id = $1 AND ($2::varchar IS NULL OR category = $2)
         ORDER BY id ASC`,
        [companyId, category]
      );
      items = result.rows;
    }
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/ai/evolution/official-knowledge
router.post('/official-knowledge', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id, category, key, title, content, raw_text, tags, is_active } = req.body;

    if (!category || !key || !title) {
      return res.status(400).json({ success: false, error: 'category, key and title are required' });
    }

    const cleanKey = String(key).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const cleanTags = Array.isArray(tags) ? tags : String(tags || '').split(',').map(t => t.trim()).filter(Boolean);

    let result;
    if (id) {
      result = await pool.query(
        `UPDATE company_official_knowledge
         SET category = $1, key = $2, title = $3, content = $4, raw_text = $5, tags = $6, is_active = $7, updated_at = NOW()
         WHERE id = $8 AND company_id = $9
         RETURNING *`,
        [category, cleanKey, title, JSON.stringify(content || {}), raw_text || '', cleanTags, is_active !== false, id, companyId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO company_official_knowledge
          (company_id, category, key, title, content, raw_text, tags, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (company_id, key) DO UPDATE SET
          category = EXCLUDED.category,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          raw_text = EXCLUDED.raw_text,
          tags = EXCLUDED.tags,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
         RETURNING *`,
        [companyId, category, cleanKey, title, JSON.stringify(content || {}), raw_text || '', cleanTags, is_active !== false]
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. DELETE /api/ai/evolution/official-knowledge/:id
router.delete('/official-knowledge/:id', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    await pool.query(
      `DELETE FROM company_official_knowledge WHERE id = $1 AND company_id = $2`,
      [req.params.id, companyId]
    );
    res.json({ success: true, message: 'Item removido' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET /api/ai/evolution/playbooks
router.get('/playbooks', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const playbooks = await playbookEngine.listPlaybooks(companyId);
    res.json({ success: true, data: playbooks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5b. GET /api/ai/evolution/playbooks/match
router.get('/playbooks/match', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const query = req.query.query || req.query.q || req.query.text || '';
    const conversationId = req.query.conversationId || 'test-conv';
    const matched = await playbookEngine.matchPlaybook({ companyId, message: query, intent: query, conversationId });
    res.json({ success: true, data: matched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST /api/ai/evolution/playbooks
router.post('/playbooks', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id, name, slug, trigger_condition, goal, steps, recommended_cta, confidence, status } = req.body;

    if (!name || !trigger_condition || !goal) {
      return res.status(400).json({ success: false, error: 'name, trigger_condition and goal are required' });
    }

    const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const cleanSteps = Array.isArray(steps) ? steps : (typeof steps === 'string' ? JSON.parse(steps) : []);

    let result;
    if (id) {
      result = await pool.query(
        `UPDATE ai_playbooks
         SET name = $1, slug = $2, trigger_condition = $3, goal = $4, steps = $5,
             recommended_cta = $6, confidence = $7, status = $8, updated_at = NOW()
         WHERE id = $9 AND company_id = $10
         RETURNING *`,
        [name, cleanSlug, trigger_condition, goal, JSON.stringify(cleanSteps), recommended_cta, confidence || 0.85, status || 'approved', id, companyId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO ai_playbooks (
          company_id, name, slug, trigger_condition, goal, steps, recommended_cta, confidence, status, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (company_id, slug) DO UPDATE SET
          name = EXCLUDED.name,
          trigger_condition = EXCLUDED.trigger_condition,
          goal = EXCLUDED.goal,
          steps = EXCLUDED.steps,
          recommended_cta = EXCLUDED.recommended_cta,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING *`,
        [companyId, name, cleanSlug, trigger_condition, goal, JSON.stringify(cleanSteps), recommended_cta, confidence || 0.85, status || 'approved']
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. GET /api/ai/evolution/suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const status = req.query.status || null;
    const suggestions = await learningEngine.listSuggestions({ companyId, status });
    res.json({ success: true, data: suggestions });
  } catch (err) {
    console.error('[EvolutionaryRoutes] Failed to load suggestions:', err);
    res.status(500).json({ success: false, error: 'Falha ao carregar sugestões de evolução.' });
  }
});

// 8. POST /api/ai/evolution/suggestions/:id/approve
router.post('/suggestions/:id/approve', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const result = await learningEngine.approveSuggestion({
      suggestionId: req.params.id,
      companyId,
      approvedBy: req.user?.username || 'owner'
    });
    res.json({ success: result.ok, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. POST /api/ai/evolution/suggestions/:id/reject
router.post('/suggestions/:id/reject', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const result = await learningEngine.rejectSuggestion({
      suggestionId: req.params.id,
      companyId
    });
    res.json({ success: result.ok, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. POST /api/ai/evolution/suggestions/:id/test (10% sandbox)
router.post('/suggestions/:id/test', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const result = await learningEngine.testSuggestionSandbox({
      suggestionId: req.params.id,
      companyId
    });
    res.json({ success: result.ok, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. POST /api/ai/evolution/feedback (operator feedback [👍] [👎] [✏️] [🧠])
router.post('/feedback', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { eventId, conversationId, rating, category, note, aiResponseText } = req.body;

    const result = await experienceEngine.recordFeedback({
      eventId,
      conversationId,
      companyId,
      rating: rating || 'positive',
      category: category || 'general',
      note: note || '',
      aiResponseText: aiResponseText ?? null
    });

    res.json({ success: result.ok, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. GET /api/ai/evolution/context/:conversationId (for Inbox Sidebar)
router.get('/context/:conversationId', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const convId = req.params.conversationId;

    // Load customer context
    const customerContext = await customerMemoryEngine.loadCustomerContext({
      companyId,
      conversationId: convId,
      phone: req.query.phone || ''
    });

    // Match active playbook
    const activePlaybook = await playbookEngine.matchPlaybook({
      companyId,
      intent: customerContext.leadIntent,
      conversationId: convId
    });

    // Search recent experiences for this conversation
    const recentExpRes = await pool.query(
      `SELECT id, customer_utterance, intent_detected, strategy_applied, ai_reply,
              customer_replied, human_intervened, human_correction_text, feedback_rating, created_at
       FROM ai_experience_events
       WHERE company_id = $1 AND conversation_id = $2
       ORDER BY created_at DESC LIMIT 5`,
      [companyId, convId]
    );

    res.json({
      success: true,
      data: {
        customerContext,
        activePlaybook,
        recentExperiences: recentExpRes.rows,
        learningRate: null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. POST /api/ai/evolution/sync-manual (Mine and learn from human operator messages)
router.post('/sync-manual', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const limit = Number(req.body?.limit) || 300;
    const result = await humanAttendanceLearner.mineAndEvolveFromManualAttendance({ companyId, limit });
    res.json({ success: result.ok, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. GET /api/ai/evolution/agent-level (Dynamic Agent Level & XP Progression)
router.get('/agent-level', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const agentKey = req.query.agentKey || 'camila';
    const levelData = await humanAttendanceLearner.calculateAgentLevel({ companyId, agentKey });
    res.json({ success: true, data: levelData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. GET /api/ai/evolution/learned-patterns (Cross-conversation golden patterns)
router.get('/learned-patterns', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const patterns = await humanAttendanceLearner.getLearnedPatterns({ companyId });
    res.json({ success: true, data: patterns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16. GET /api/ai/evolution/lead-algorithms (Store Standard + Per-Lead Evolution Algorithms)
router.get('/lead-algorithms', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const metrics = await learningEngine.getEvolutionMetrics({ companyId });
    res.json({
      success: true,
      data: {
        storeEvolutionAlgorithms: metrics.storeEvolutionAlgorithms || [],
        aiFollowupEngine: metrics.aiFollowupEngine || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 17. POST /api/ai/evolution/followup-scan (Trigger algorithmic AI follow-up scan)
router.post('/followup-scan', async (req, res) => {
  try {
    const aiFollowupCron = require('../../../services/aiFollowupCron');
    const result = await aiFollowupCron.runFollowupScan({
      ignoreBusinessHours: Boolean(req.body?.force),
      maxBatch: Math.min(Math.max(Number(req.body?.maxBatch) || 3, 1), 10),
    });
    res.json({ success: Boolean(result.ok), data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 18. GET & PUT /api/ai/evolution/zai-assistant-config (ZAI System Assistant Config: disabled by default, personality, mascot model)
const DEFAULT_ZAI_ASSISTANT_CONFIG = {
  enabled: false,
  role: 'system_assistant_only',
  name: 'Assistente ZAI (ZAIBOT)',
  mascotModel: 'zaibot_avatar',
  mascotAvatarUrl: '/assets/mascot/zaibot_avatar.png',
  personality: {
    tone: 'executivo_direto',
    objectivity: 85,
    proactivity: 70,
    formality: 65,
    greetingMessage:
      'Olá! Sou o ZAIBOT, seu assistente interno do sistema ZAI. Posso consultar métricas, conexões, fila e atendentes da loja. Como posso ajudar agora?',
  },
};

router.get('/zai-assistant-config', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const key = `zai_system_assistant_config:${companyId}`;
    const result = await pool.query('SELECT value FROM system_settings WHERE key = $1 LIMIT 1', [key]);
    let saved = null;
    if (result.rows[0]?.value) {
      saved = typeof result.rows[0].value === 'string' ? JSON.parse(result.rows[0].value) : result.rows[0].value;
    }
    const merged = {
      ...DEFAULT_ZAI_ASSISTANT_CONFIG,
      ...(saved || {}),
      personality: {
        ...DEFAULT_ZAI_ASSISTANT_CONFIG.personality,
        ...(saved?.personality || {}),
      },
    };
    res.json({ success: true, data: merged });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/zai-assistant-config', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const key = `zai_system_assistant_config:${companyId}`;
    const incoming = req.body || {};
    const merged = {
      ...DEFAULT_ZAI_ASSISTANT_CONFIG,
      ...incoming,
      enabled: Boolean(incoming.enabled),
      role: 'system_assistant_only',
      personality: {
        ...DEFAULT_ZAI_ASSISTANT_CONFIG.personality,
        ...(incoming.personality || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(merged)]
    );

    res.json({ success: true, data: merged });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 19. GET /api/ai/evolution/conversation-scores (Real Milestone XP per conversation & Algorithm breakdown)
router.get('/conversation-scores', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const convEvoService = require('../../../services/conversationEvolutionService');
    const result = await convEvoService.getConversationScores({
      companyId,
      agentKey: req.query.agentKey || 'camila',
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
      search: req.query.search || req.query.q || '',
      algorithm: req.query.algorithm || '',
      minXp: req.query.minXp !== undefined ? Number(req.query.minXp) : null,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[EvolutionaryRoutes] Failed to fetch conversation scores:', err);
    res.status(500).json({ success: false, error: 'Falha ao buscar pontuação real de conversas.' });
  }
});

// 20. GET /api/ai/evolution/agent-evolution-metrics (Aggregated real XP & Level overview)
router.get('/agent-evolution-metrics', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const agentKey = req.query.agentKey || 'camila';
    const convEvoService = require('../../../services/conversationEvolutionService');
    const levelData = await humanAttendanceLearner.calculateAgentLevel({ companyId, agentKey });
    const scoreData = await convEvoService.getConversationScores({ companyId, agentKey, limit: 10 });
    res.json({
      success: true,
      data: {
        agentLevel: levelData,
        summary: {
          totalConversations: scoreData.totalConversations,
          totalEarnedXp: scoreData.totalEarnedXp,
          averageScore: scoreData.averageScore,
          totalConversions: scoreData.totalConversions,
          totalSheets: scoreData.totalSheets,
          algorithmDistribution: scoreData.algorithmDistribution,
        },
        recentScores: scoreData.scores,
      },
    });
  } catch (err) {
    console.error('[EvolutionaryRoutes] Failed to fetch agent evolution metrics:', err);
    res.status(500).json({ success: false, error: 'Falha ao carregar métricas de evolução do atendente.' });
  }
});

// 21. POST /api/ai/evolution/conversation-scores/sweep (Trigger manual/batch evaluation sweep)
router.post('/conversation-scores/sweep', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const convEvoService = require('../../../services/conversationEvolutionService');
    const sweepResult = await convEvoService.sweepRecentConversations({
      companyId,
      agentKey: req.body?.agentKey || 'camila',
      limit: Number(req.body?.limit) || 50,
    });
    res.json({ success: sweepResult.ok, ...sweepResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 22. GET /api/ai/evolution/conversation-scores/:conversationId (Single conversation detailed score)
router.get('/conversation-scores/:conversationId', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const convEvoService = require('../../../services/conversationEvolutionService');
    const score = await convEvoService.scoreConversationAndPersist(req.params.conversationId, companyId);
    if (!score) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada para pontuação.' });
    }
    res.json({ success: true, data: score });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

