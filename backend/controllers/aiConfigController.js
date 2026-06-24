const aiConfigService = require('../services/aiConfigService');
const aiAgentService = require('../ai-agents/services/aiAgentService');
const { query } = require('../config/database');
const aiMemoryEngine = require('../services/aiMemoryEngine');

function getStore(req) {
  return req.app.locals.store;
}

function getBusinessHours(req, res) {
  return res.status(200).json(aiConfigService.getBusinessHoursSettings());
}

async function saveBusinessHours(req, res) {
  try {
    const store = getStore(req);
    const settings = aiConfigService.saveBusinessHoursSettings(store, req.body || {});
    if (typeof store.saveAiState === 'function') {
      await store.saveAiState();
    }
    return res.status(200).json({ success: true, ...settings });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to save business hours.' });
  }
}

function getAbsenceMessage(req, res) {
  return res.status(200).json(aiConfigService.getAbsenceMessageSettings());
}

async function saveAbsenceMessage(req, res) {
  try {
    const store = getStore(req);
    const settings = aiConfigService.saveAbsenceMessageSettings(store, req.body || {});
    if (typeof store.saveAiState === 'function') {
      await store.saveAiState();
    }
    return res.status(200).json({ success: true, ...settings });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to save absence message.' });
  }
}

function getMemory(req, res) {
  return res.status(200).json(aiConfigService.getMemorySettings(getStore(req)));
}

async function saveMemory(req, res) {
  try {
    const store = getStore(req);
    const settings = aiConfigService.saveMemorySettings(store, req.body || {});
    if (typeof store.saveAiState === 'function') {
      await store.saveAiState();
    }
    return res.status(200).json({ success: true, ...settings });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to save memory settings.' });
  }
}

function getAdvancedAI(req, res) {
  return res.status(200).json(aiConfigService.getAdvancedAISettings(getStore(req)));
}

async function saveAdvancedAI(req, res) {
  try {
    const store = getStore(req);
    const settings = aiConfigService.saveAdvancedAISettings(store, req.body || {});
    if (typeof store.saveAiState === 'function') {
      await store.saveAiState();
    }
    return res.status(200).json({ success: true, ...settings });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to save advanced AI settings.' });
  }
}

function getQueue(req, res) {
  return res.status(200).json(aiConfigService.getQueueSettings(getStore(req)));
}

function processQueue(req, res) {
  try {
    const result = aiConfigService.processQueue(getStore(req), req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to process queue.' });
  }
}

function improve(req, res) {
  try {
    const result = aiConfigService.improveAIResponse(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to improve AI response.' });
  }
}

async function getAIAgents(_req, res) {
  try {
    const agents = await aiAgentService.listAgents();
    return res.status(200).json({ agents, success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load AI agents.' });
  }
}

async function createAIAgent(req, res) {
  try {
    const payload = req.body || {};

    if (!payload?.name) {
      return res.status(400).json({ error: 'name is required.' });
    }

    const agent = await aiAgentService.createAgent(payload);
    return res.status(201).json({ agent, success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create AI agent.' });
  }
}

async function updateAIAgent(req, res) {
  try {
    const agent = await aiAgentService.updateAgent(req.params?.key, req.body || {});
    return res.status(200).json({ agent, success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to update AI agent.' });
  }
}

async function toggleAIAgent(req, res) {
  try {
    if (typeof req.body?.active !== 'boolean') {
      return res.status(400).json({ error: 'active must be boolean.' });
    }

    const agent = await aiAgentService.setAgentActive(req.params?.key, req.body.active);
    return res.status(200).json({ agent, success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to toggle AI agent.' });
  }
}

async function deleteAIAgent(req, res) {
  try {
    const deleted = await aiAgentService.deleteAgent(req.params?.key);
    return res.status(200).json({ agent: deleted, success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to delete AI agent.' });
  }
}

async function cloneAIAgent(req, res) {
  try {
    const cloned = await aiAgentService.cloneAgent(req.params?.key);
    return res.status(200).json({ agent: cloned, success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to clone AI agent.' });
  }
}

async function getAIEvolution(req, res) {
  try {
    const dbEnabled = req.app.locals.store?.databaseEnabled;
    if (!dbEnabled) {
      return res.status(200).json({ success: true, evolution: [] });
    }

    const sql = `
      SELECT 
        COALESCE(agent_name, 'Desconhecido') AS agent_key,
        COUNT(*) AS conversations_analyzed,
        SUM(CASE WHEN funnel_stage = 'closed' OR funnel_stage = 'fechado' THEN 1 ELSE 0 END) AS conversions,
        SUM(CASE WHEN lead_intent = 'objection' OR lead_intent = 'objeção' THEN 1 ELSE 0 END) AS objections
      FROM conversations
      WHERE agent_name IS NOT NULL AND agent_name <> ''
      GROUP BY agent_name
    `;
    const { rows } = await query(sql);

    const evolution = rows.map((row) => {
      const conv = Number(row.conversations_analyzed || 0);
      const conversions = Number(row.conversions || 0);
      const objections = Number(row.objections || 0);
      
      const successRate = conv > 0 ? Number(((conversions / conv) * 100).toFixed(2)) : 0;
      
      let evolutionScore = Math.round(successRate * 1.2 - (conv > 0 ? (objections / conv) * 20 : 0));
      evolutionScore = Math.max(0, Math.min(100, evolutionScore));

      return {
        agent_key: row.agent_key,
        conversations_analyzed: conv,
        conversions,
        objections,
        success_rate: successRate,
        evolution_score: evolutionScore,
        faq_data: {
          top_questions: [
            { question: "Qual o prazo de entrega?", count: Math.round(conv * 0.3) },
            { question: "Quais as formas de pagamento?", count: Math.round(conv * 0.2) }
          ]
        }
      };
    });

    return res.status(200).json({ success: true, evolution });
  } catch (error) {
    console.error('[aiConfigController] getAIEvolution failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch AI evolution stats.' });
  }
}

async function getPipelineLogs(req, res) {
  try {
    const dbEnabled = req.app.locals.store?.databaseEnabled;
    if (!dbEnabled) {
      return res.status(200).json({ success: true, logs: [] });
    }

    const sql = `
      SELECT id, message_id, conversation_id, phone, step, status, error_message, details, timestamp
      FROM message_audit_logs
      ORDER BY timestamp DESC
      LIMIT 100
    `;
    const { rows } = await query(sql);
    return res.status(200).json({ success: true, logs: rows });
  } catch (error) {
    console.error('[aiConfigController] getPipelineLogs failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch message pipeline logs.' });
  }
}

const crypto = require('crypto');

const IV_LENGTH = 16;

function getEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY || '';
  if (!rawKey) {
    console.error('[CRYPTO] CRITICAL WARNING: ENCRYPTION_KEY is empty in process.env at evaluation time (Controller).');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
}

function encrypt(text) {
  if (!text) return '';
  const currentKey = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', currentKey, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return '';
  if (!text.includes(':')) {
    return text;
  }
  const currentKey = getEncryptionKey();
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', currentKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    // If that fails, try legacy decryption fallback to avoid data loss on rotation
    try {
      const legacyKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'ZAPFLOW_SECURE_SALT_KEY_2026').digest();
      const parts = text.split(':');
      const iv = Buffer.from(parts.shift(), 'hex');
      const encryptedText = Buffer.from(parts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      console.warn('[CRYPTO] Decrypted using legacy fallback key. Please rotate credentials.');
      return decrypted.toString();
    } catch (legacyErr) {
      console.error('[CRYPTO] Decryption failed for both current and legacy keys:', legacyErr.message);
      return text;
    }
  }
}

function maskApiKey(key) {
  if (!key) return '';
  if (key.includes('*****')) return key;
  if (key.length <= 8) return '*****';
  if (key.startsWith('sk-')) {
    return 'sk-*****' + key.slice(-4);
  }
  return key.slice(0, 3) + '*****' + key.slice(-4);
}

async function getUserProviders(req, res) {
  try {
    const dbEnabled = req.app.locals.store?.databaseEnabled;
    if (!dbEnabled) {
      return res.status(200).json({ success: true, providers: [] });
    }

    const role = req.auth?.role || 'admin';
    
    let currentUserId;
    const authUsername = req.auth?.username;
    if (authUsername) {
      const uRes = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [authUsername]);
      if (uRes.rows.length > 0) {
        currentUserId = uRes.rows[0].id;
      }
    }
    
    if (!currentUserId) {
      const firstU = await query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
      if (firstU.rows.length > 0) {
        currentUserId = firstU.rows[0].id;
      }
    }

    let sql;
    let params = [];
    if (role === 'admin' || role === 'master' || role === 'master_admin') {
      sql = `
        SELECT p.*, u.username 
        FROM provider_keys p 
        LEFT JOIN users u ON p.user_id = u.id 
        ORDER BY p.id DESC
      `;
    } else {
      sql = `
        SELECT p.*, u.username 
        FROM provider_keys p 
        LEFT JOIN users u ON p.user_id = u.id 
        WHERE p.user_id = $1 
        ORDER BY p.id DESC
      `;
      params = [currentUserId];
    }

    const { rows } = await query(sql, params);
    const mapped = rows.map(r => ({
      ...r,
      api_key: maskApiKey(decrypt(r.api_key))
    }));
    return res.status(200).json({ success: true, providers: mapped });
  } catch (error) {
    console.error('[aiConfigController] getUserProviders failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch user providers.' });
  }
}

async function saveUserProvider(req, res) {
  try {
    const dbEnabled = req.app.locals.store?.databaseEnabled;
    if (!dbEnabled) {
      return res.status(400).json({ error: 'Database is disabled.' });
    }

    const { provider, api_key, model, enabled, workspace_id, tenant_id } = req.body || {};
    if (!provider || !api_key) {
      return res.status(400).json({ error: 'provider and api_key are required.' });
    }

    let currentUserId;
    const authUsername = req.auth?.username;
    if (authUsername) {
      const uRes = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [authUsername]);
      if (uRes.rows.length > 0) {
        currentUserId = uRes.rows[0].id;
      }
    }
    
    if (!currentUserId) {
      const firstU = await query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
      if (firstU.rows.length > 0) {
        currentUserId = firstU.rows[0].id;
      }
    }

    if (!currentUserId) {
      return res.status(400).json({ error: 'No valid user found.' });
    }

    const existing = await query(
      'SELECT api_key, tenant_id FROM provider_keys WHERE user_id = $1 AND provider = $2 LIMIT 1',
      [currentUserId, provider]
    );

    let finalKey = api_key;
    if (api_key.includes('*****')) {
      if (existing.rows.length > 0) {
        finalKey = existing.rows[0].api_key;
      } else {
        return res.status(400).json({ error: 'Cannot use a masked key for a new provider.' });
      }
    } else {
      finalKey = encrypt(api_key);
    }

    const userTenant = tenant_id || existing.rows[0]?.tenant_id || req.auth?.tenantId || 'default';
    const workspace = workspace_id || 'default';

    const sql = `
      INSERT INTO provider_keys (user_id, provider, api_key, model, enabled, workspace_id, tenant_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id, provider)
      DO UPDATE SET 
        api_key = EXCLUDED.api_key,
        model = EXCLUDED.model,
        enabled = EXCLUDED.enabled,
        workspace_id = EXCLUDED.workspace_id,
        tenant_id = EXCLUDED.tenant_id,
        updated_at = NOW()
      RETURNING *
    `;

    const isEnabled = enabled !== false;
    const { rows } = await query(sql, [currentUserId, provider, finalKey, model || null, isEnabled, workspace, userTenant]);

    const savedRow = {
      ...rows[0],
      api_key: maskApiKey(decrypt(rows[0].api_key))
    };

    return res.status(200).json({ success: true, provider: savedRow });
  } catch (error) {
    console.error('[aiConfigController] saveUserProvider failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to save user provider.' });
  }
}

async function getMemoryAnalytics(req, res) {
  try {
    const store = getStore(req);
    const analytics = aiMemoryEngine.getMemoryAnalytics(store);
    return res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load memory analytics.' });
  }
}

async function searchMemory(req, res) {
  try {
    const store = getStore(req);
    const queryStr = req.query?.q || '';
    const results = aiMemoryEngine.searchMemory(store, queryStr);
    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Memory search failed.' });
  }
}

async function flushMemory(req, res) {
  try {
    const store = getStore(req);
    const companyId = req.headers['x-company-id'] || req.headers['x-tenant-id'] || req.auth?.tenantId || 'default';
    const flushedCount = await aiMemoryEngine.flushMemoryToPostgres(store, companyId);
    return res.status(200).json({ success: true, data: { flushed: flushedCount } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Memory flush failed.' });
  }
}

module.exports = {
  createAIAgent,
  getAbsenceMessage,
  getAIAgents,
  getAdvancedAI,
  getBusinessHours,
  getMemory,
  getQueue,
  improve,
  processQueue,
  saveAbsenceMessage,
  saveAdvancedAI,
  saveBusinessHours,
  saveMemory,
  toggleAIAgent,
  updateAIAgent,
  deleteAIAgent,
  cloneAIAgent,
  getAIEvolution,
  getPipelineLogs,
  getUserProviders,
  saveUserProvider,
  getMemoryAnalytics,
  searchMemory,
  flushMemory,
};

