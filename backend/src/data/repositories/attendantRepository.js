'use strict';

const { query, pool } = require('../../infrastructure/config/database');
const crypto = require('crypto');
const { resolveObjectiveId, resolvePersonalityId } = require('../../ai/agents/engine/agentBehaviorCompiler');

function clampStr(val, maxLen, fallback = '') {
  const s = String(val ?? fallback).trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function assignmentId(prefix, ...parts) {
  const digest = crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40);
  return `${prefix}_${digest}`;
}

async function inTransaction(work, client = null) {
  if (client) return work(client);
  const tx = await pool.connect();
  try {
    await tx.query('BEGIN');
    const result = await work(tx);
    await tx.query('COMMIT');
    return result;
  } catch (error) {
    await tx.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    tx.release();
  }
}

const attendantRepository = {
  async listAttendants(companyId = 'default') {
    const res = await query(
      `SELECT da.*,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('store_id', sa.store_id, 'is_primary', sa.is_primary))
                FILTER (WHERE sa.store_id IS NOT NULL), '[]'
              ) as store_assignments,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('session_id', ca.session_id, 'store_id', ca.store_id))
                FILTER (WHERE ca.session_id IS NOT NULL), '[]'
              ) as connection_assignments
       FROM digital_attendants da
       LEFT JOIN store_attendant_assignments sa ON sa.company_id = da.company_id AND sa.attendant_id = da.id
       LEFT JOIN connection_attendant_assignments ca ON ca.company_id = da.company_id AND ca.attendant_id = da.id
       WHERE da.company_id = $1
       GROUP BY da.id
       ORDER BY da.is_platform_assistant DESC, da.created_at ASC`,
      [companyId]
    );
    return res.rows;
  },

  async getByKey(companyId = 'default', key, client = null) {
    const res = await (client || { query }).query(
      `SELECT da.*,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('store_id', sa.store_id, 'is_primary', sa.is_primary))
                FILTER (WHERE sa.store_id IS NOT NULL), '[]'
              ) as store_assignments,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('session_id', ca.session_id, 'store_id', ca.store_id))
                FILTER (WHERE ca.session_id IS NOT NULL), '[]'
              ) as connection_assignments
       FROM digital_attendants da
       LEFT JOIN store_attendant_assignments sa ON sa.company_id = da.company_id AND sa.attendant_id = da.id
       LEFT JOIN connection_attendant_assignments ca ON ca.company_id = da.company_id AND ca.attendant_id = da.id
       WHERE da.company_id = $1 AND da.key = $2
       GROUP BY da.id
       LIMIT 1`,
      [companyId, key]
    );
    return res.rows[0] || null;
  },

  async upsertAttendant(companyId = 'default', data = {}, client = null) {
    const cleanCompanyId = clampStr(companyId, 64, 'default') || 'default';
    const id = clampStr(data.id || assignmentId('attendant', cleanCompanyId, data.key || Date.now()), 64);
    const key = clampStr(String(data.key || data.name || id).trim().toLowerCase().replace(/\s+/g, '-'), 64);
    const name = clampStr(data.name || key, 128, key);
    const role = clampStr(data.role || 'Vendas', 128, 'Vendas');
    const status = clampStr(data.status || 'active', 32, 'active');
    const active = data.active !== false;
    const isPlatformAssistant = Boolean(data.is_platform_assistant || key === 'zaibot');
    const personality = String(data.personality || data.prompt || 'Atendente da loja.');
    const rawPersonalityType = String(data.personality_type || data.personalityType || 'comercial').trim();
    const personalityType = clampStr(rawPersonalityType, 64, 'comercial');
    const prompt = String(data.prompt || personality);
    const aiProvider = clampStr(data.ai_provider || data.aiProvider || data.providerId || data.provider || 'zai', 64, 'zai');
    const aiModel = clampStr(data.ai_model || data.aiModel || data.modelId || data.model || 'qwen2.5:3b', 64, 'qwen2.5:3b');
    const temperature = typeof data.temperature === 'number' ? data.temperature : 0.70;
    const rawConnId = data.whatsapp_connection_id || data.whatsappConnectionId || (Array.isArray(data.sessionIds) && data.sessionIds[0]) || null;
    const whatsappConnectionId = rawConnId ? clampStr(rawConnId, 120) : null;
    const rawTone = String(data.tone || 'acolhedor').trim();
    const personalityPreset = clampStr(
      resolvePersonalityId(data.personality_preset || data.personalityPreset, rawTone, rawPersonalityType),
      64,
      'consultivo_amigavel'
    );
    const rawObjective = String(data.objective || '').trim();
    const objective = clampStr(resolveObjectiveId(rawObjective), 64, 'fechamento');
    const tone = clampStr(rawTone || 'acolhedor', 64, 'acolhedor');
    const responseStyle = clampStr(data.response_style || data.responseStyle || 'balanced', 64, 'balanced');
    const maxTokens = Math.max(64, Number(data.max_tokens || data.maxTokens) || 600);
    const routingMode = clampStr(String(data.routing_mode || data.routingMode || 'AUTO').toUpperCase(), 32, 'AUTO');
    const systemPromptVersion = Math.max(1, Number(data.system_prompt_version || data.systemPromptVersion) || 1);
    const knowledgeConfiguration = typeof data.knowledge_configuration === 'object' && data.knowledge_configuration !== null
      ? data.knowledge_configuration
      : (typeof data.knowledgeConfiguration === 'object' && data.knowledgeConfiguration !== null ? data.knowledgeConfiguration : {});
    const enabledFeatures = typeof data.enabled_features === 'object' && data.enabled_features !== null
      ? data.enabled_features
      : (typeof data.enabledFeatures === 'object' && data.enabledFeatures !== null ? data.enabledFeatures : {});
    const rawUpdatedBy = data.updated_by || data.updatedBy || null;
    const updatedBy = rawUpdatedBy ? clampStr(rawUpdatedBy, 120) : null;
    const avatarUrl = data.avatar_url || data.avatarUrl || data.avatar || '';
    const avatarConfig = typeof data.avatar_config === 'object' ? data.avatar_config : (typeof data.avatarConfig === 'object' ? data.avatarConfig : {});
    const appearance = typeof data.appearance === 'object' ? data.appearance : {};
    const character = typeof data.character === 'object' ? data.character : {};
    const baseSettings = typeof data.settings === 'object' && data.settings !== null ? { ...data.settings } : {};
    if (rawObjective.length > 64) {
      baseSettings.customObjective = rawObjective;
    }
    const settings = baseSettings;

    const res = await (client || { query }).query(
      `INSERT INTO digital_attendants (
        id, company_id, key, name, role, status, active, is_platform_assistant,
        personality, personality_type, prompt, ai_provider, ai_model, temperature,
        whatsapp_connection_id, personality_preset, objective, tone, response_style,
        max_tokens, routing_mode, system_prompt_version, knowledge_configuration,
        enabled_features, updated_by,
        avatar_url, avatar_config, appearance, character, settings, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19,
        $20, $21, $22, $23::jsonb,
        $24::jsonb, $25,
        $26, $27, $28, $29, $30, NOW()
      )
      ON CONFLICT (company_id, key) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        active = EXCLUDED.active,
        personality = EXCLUDED.personality,
        personality_type = EXCLUDED.personality_type,
        prompt = EXCLUDED.prompt,
        ai_provider = EXCLUDED.ai_provider,
        ai_model = EXCLUDED.ai_model,
        temperature = EXCLUDED.temperature,
        whatsapp_connection_id = COALESCE(EXCLUDED.whatsapp_connection_id, digital_attendants.whatsapp_connection_id),
        personality_preset = EXCLUDED.personality_preset,
        objective = EXCLUDED.objective,
        tone = EXCLUDED.tone,
        response_style = EXCLUDED.response_style,
        max_tokens = EXCLUDED.max_tokens,
        routing_mode = EXCLUDED.routing_mode,
        system_prompt_version = EXCLUDED.system_prompt_version,
        knowledge_configuration = digital_attendants.knowledge_configuration || EXCLUDED.knowledge_configuration,
        enabled_features = digital_attendants.enabled_features || EXCLUDED.enabled_features,
        updated_by = COALESCE(EXCLUDED.updated_by, digital_attendants.updated_by),
        avatar_url = CASE WHEN EXCLUDED.avatar_url <> '' THEN EXCLUDED.avatar_url ELSE digital_attendants.avatar_url END,
        avatar_config = digital_attendants.avatar_config || EXCLUDED.avatar_config,
        appearance = digital_attendants.appearance || EXCLUDED.appearance,
        character = digital_attendants.character || EXCLUDED.character,
        settings = digital_attendants.settings || EXCLUDED.settings,
        updated_at = NOW()
      RETURNING *`,
      [
        id, cleanCompanyId, key, name, role, status, active, isPlatformAssistant,
        personality, personalityType, prompt, aiProvider, aiModel, temperature,
        whatsappConnectionId, personalityPreset, objective, tone, responseStyle,
        maxTokens, routingMode, systemPromptVersion, JSON.stringify(knowledgeConfiguration),
        JSON.stringify(enabledFeatures), updatedBy,
        avatarUrl, JSON.stringify(avatarConfig), JSON.stringify(appearance), JSON.stringify(character), JSON.stringify(settings)
      ]
    );
    return res.rows[0];
  },

  async assignToStore(companyId = 'default', storeId, attendantId, isPrimary = false, client = null) {
    return inTransaction(async tx => {
      const owner = await tx.query(`SELECT 1 FROM ai_stores WHERE company_id=$1 AND id=$2 FOR UPDATE`, [companyId, storeId]);
      const attendant = await tx.query(`SELECT 1 FROM digital_attendants WHERE company_id=$1 AND id=$2 FOR KEY SHARE`, [companyId, attendantId]);
      if (!owner.rows[0] || !attendant.rows[0]) throw new Error('Loja ou atendente não pertence à empresa informada.');
      if (isPrimary) await tx.query(`UPDATE store_attendant_assignments SET is_primary=false WHERE company_id=$1 AND store_id=$2 AND is_primary=true AND attendant_id<>$3`, [companyId, storeId, attendantId]);
      const id = assignmentId('assign_store', companyId, storeId, attendantId);
      await tx.query(
        `INSERT INTO store_attendant_assignments (id, company_id, store_id, attendant_id, is_primary)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, store_id, attendant_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
        [id, companyId, storeId, attendantId, isPrimary]
      );
    }, client);
  },

  async removeStoreAssignment(companyId = 'default', storeId, attendantId, client = null) {
    const tx = client || { query };
    await tx.query(`DELETE FROM store_attendant_assignments WHERE company_id=$1 AND store_id=$2 AND attendant_id=$3`, [companyId, storeId, attendantId]);
  },

  async syncAgent(companyId = 'default', agent = {}, previous = null, client = null) {
    const tx = client || { query };
    const oldAttendant = previous ? await this.getByKey(companyId, previous.key, tx) : null;
    const attendant = await this.upsertAttendant(companyId, {
      ...agent,
      avatar_url: agent.avatar,
      avatar_config: agent.avatarConfig,
      personality_type: agent.personalityType,
      personality_preset: agent.personalityPreset,
      ai_provider: agent.providerId || agent.provider || agent.aiProvider,
      ai_model: agent.modelId || agent.model || agent.aiModel,
      whatsapp_connection_id: agent.whatsappConnectionId || (Array.isArray(agent.sessionIds) ? agent.sessionIds[0] : null),
      response_style: agent.responseStyle,
      max_tokens: agent.maxTokens,
      routing_mode: agent.routingMode,
      system_prompt_version: agent.systemPromptVersion,
      knowledge_configuration: agent.knowledgeConfiguration,
      enabled_features: agent.enabledFeatures,
      updated_by: agent.updatedBy,
      is_platform_assistant: agent.isPlatformAssistant,
      settings: { ...(agent.settings || {}), personalityVisual: agent.personalityVisual || {}, promptTemplate: agent.promptTemplate || null },
    }, tx);
    const nextSessions = new Set(Array.isArray(agent.sessionIds) ? agent.sessionIds : []);
    for (const assignment of oldAttendant?.connection_assignments || []) {
      if (!nextSessions.has(assignment.session_id)) await this.removeConnectionAssignment(companyId, assignment.session_id, attendant.id, tx);
    }
    if (oldAttendant && previous.storeId && previous.storeId !== agent.storeId) {
      await this.removeStoreAssignment(companyId, previous.storeId, attendant.id, tx);
    }
    if (agent.storeId) await this.assignToStore(companyId, agent.storeId, attendant.id, false, tx);
    for (const sessionId of nextSessions) {
      const profile = (await tx.query(`SELECT store_id FROM session_ai_profiles WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId])).rows[0];
      await this.assignToConnection(companyId, sessionId, attendant.id, profile?.store_id || agent.storeId || null, true, tx);
    }
    return attendant;
  },

  async deleteAttendant(companyId = 'default', key, client = null) {
    const tx = client || { query };
    const attendant = await this.getByKey(companyId, key, tx);
    if (!attendant) return null;
    for (const assignment of attendant.connection_assignments || []) {
      await this.removeConnectionAssignment(companyId, assignment.session_id, attendant.id, tx);
    }
    await tx.query(`DELETE FROM store_attendant_assignments WHERE company_id=$1 AND attendant_id=$2`, [companyId, attendant.id]);
    await tx.query(`DELETE FROM digital_attendants WHERE company_id=$1 AND id=$2`, [companyId, attendant.id]);
    return attendant;
  },

  async assignToConnection(companyId = 'default', sessionId, attendantId, storeId = null, isPrimary = true, client = null) {
    return inTransaction(async tx => {
      const session = await tx.query(`SELECT 1 FROM sessions WHERE company_id=$1 AND session_id=$2 FOR UPDATE`, [companyId, sessionId]);
      const attendant = await tx.query(`SELECT 1 FROM digital_attendants WHERE company_id=$1 AND id=$2 FOR KEY SHARE`, [companyId, attendantId]);
      if (!session.rows[0] || !attendant.rows[0]) throw new Error('Sessão ou atendente não pertence à empresa informada.');
      if (storeId) {
        const store = await tx.query(`SELECT 1 FROM ai_stores WHERE company_id=$1 AND id=$2 FOR KEY SHARE`, [companyId, storeId]);
        if (!store.rows[0]) throw new Error('Loja não pertence à empresa informada.');
      }
      if (isPrimary) await tx.query(`UPDATE connection_attendant_assignments SET is_primary=false WHERE company_id=$1 AND session_id=$2 AND is_primary=true AND attendant_id<>$3`, [companyId, sessionId, attendantId]);
      const id = assignmentId('assign_conn', companyId, sessionId, attendantId);
      await tx.query(
        `INSERT INTO connection_attendant_assignments (id, company_id, store_id, session_id, attendant_id, is_primary, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (company_id, session_id, attendant_id) DO UPDATE SET store_id = EXCLUDED.store_id, is_primary = EXCLUDED.is_primary, updated_at = NOW()`,
        [id, companyId, storeId, sessionId, attendantId, isPrimary]
      );
    }, client);
  },

  async removeConnectionAssignment(companyId = 'default', sessionId, attendantId, client = null) {
    const tx = client || { query };
    const session = await tx.query(`SELECT 1 FROM sessions WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId]);
    if (!session.rows[0]) throw new Error('Sessão não pertence à empresa informada.');
    await tx.query(`DELETE FROM connection_attendant_assignments WHERE company_id=$1 AND session_id=$2 AND attendant_id=$3`, [companyId, sessionId, attendantId]);
    await tx.query(`
      UPDATE connection_attendant_assignments
      SET is_primary=true
      WHERE company_id=$1 AND session_id=$2 AND attendant_id=(
        SELECT attendant_id FROM connection_attendant_assignments
        WHERE company_id=$1 AND session_id=$2 AND NOT is_primary
        ORDER BY attendant_id LIMIT 1
      ) AND NOT EXISTS (
        SELECT 1 FROM connection_attendant_assignments
        WHERE company_id=$1 AND session_id=$2 AND is_primary=true
      )`, [companyId, sessionId]);
  },

  async removeSessionAssignments(companyId = 'default', sessionId, client = null) {
    const tx = client || { query };
    const session = await tx.query(`SELECT 1 FROM sessions WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId]);
    if (!session.rows[0]) throw new Error('Sessão não pertence à empresa informada.');
    await tx.query(`DELETE FROM connection_attendant_assignments WHERE company_id=$1 AND session_id=$2`, [companyId, sessionId]);
  },

  async syncRelationalToSystemSettings(companyId = 'default') {
    const attendants = await this.listAttendants(companyId);
    const legacyArray = attendants.map(a => {
      const sessionIds = (a.connection_assignments || []).map(ca => ca.session_id).filter(Boolean);
      const primaryStore = (a.store_assignments || []).find(sa => sa.is_primary) || (a.store_assignments || [])[0];
      const storeId = primaryStore?.store_id || null;

      return {
        key: a.key,
        name: a.name,
        role: a.role,
        status: a.status,
        active: a.active,
        isPlatformAssistant: a.is_platform_assistant,
        personality: a.personality,
        personalityType: a.personality_type,
        prompt: a.prompt,
        aiProvider: a.ai_provider,
        aiModel: a.ai_model,
        temperature: Number(a.temperature) || 0.70,
        avatar: a.avatar_url,
        avatarConfig: a.avatar_config || {},
        appearance: a.appearance || {},
        character: a.character || {},
        settings: a.settings || {},
        sessionIds,
        storeId,
      };
    });

    const settingsKey = `ai_agents_config_v2:${companyId}`;
    await query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [settingsKey, JSON.stringify(legacyArray)]
    );
    return legacyArray;
  }
};

module.exports = attendantRepository;
