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

function getCompanyId(req) {
  return req.headers['x-company-id'] || req.query.company_id || req.user?.companyId || 'default';
}

// 1. GET /api/ai/evolution/metrics
router.get('/metrics', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const metrics = await learningEngine.getEvolutionMetrics({ companyId });
    res.json({ success: true, data: metrics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
    res.status(500).json({ success: false, error: err.message });
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
    const { eventId, conversationId, rating, category, note } = req.body;

    const result = await experienceEngine.recordFeedback({
      eventId,
      conversationId,
      companyId,
      rating: rating || 'positive',
      category: category || 'general',
      note: note || ''
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
        learningRate: '92% de precisão de catálogo'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
