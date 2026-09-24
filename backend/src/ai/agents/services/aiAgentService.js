const { selectRandomActiveAgent } = require('../engine/agentSelector');
const { getDelayMs } = require('../engine/delayEngine');
const { buildPersonalityPrompt } = require('../engine/personalityEngine');
const systemSettingsRepository = require('../../../data/repositories/systemSettingsRepository');
const path = require('path');
const fs = require('fs');

const DEFAULT_TENANT_ID = String(process.env.DEFAULT_COMPANY_ID || 'default').trim() || 'default';
const SETTINGS_PREFIX = 'ai_agents_config_v2';
const agentsByTenant = new Map();
const hydratedTenants = new Set();

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT_ID).trim() || DEFAULT_TENANT_ID;
}

function settingsKey(tenantId) {
  return `${SETTINGS_PREFIX}:${normalizeTenantId(tenantId)}`;
}

function getTenantCache(tenantId) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!agentsByTenant.has(normalizedTenantId)) {
    agentsByTenant.set(normalizedTenantId, []);
  }
  return agentsByTenant.get(normalizedTenantId);
}

function cloneAgents(agents = []) {
  return agents.map((agent) => ({
    ...agent,
    delayProfile: {
      maxMs: Number(agent?.delayProfile?.maxMs) || 5000,
      minMs: Number(agent?.delayProfile?.minMs) || 1000,
    },
    typingDelayProfile: {
      maxMs: Number(agent?.typingDelayProfile?.maxMs) || 3000,
      minMs: Number(agent?.typingDelayProfile?.minMs) || 1000,
    },
  }));
}

function normalizeAgent(agent = {}) {
  const key = String(agent.key || agent.name || `agent-${Date.now()}`)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return {
    active: agent.active !== false,
    delayProfile: {
      maxMs: Math.max(Number(agent?.delayProfile?.maxMs) || 5000, Number(agent?.delayProfile?.minMs) || 1000),
      minMs: Math.max(0, Number(agent?.delayProfile?.minMs) || 1000),
    },
    typingDelayProfile: {
      maxMs: Math.max(Number(agent?.typingDelayProfile?.maxMs) || 3000, Number(agent?.typingDelayProfile?.minMs) || 1000),
      minMs: Math.max(0, Number(agent?.typingDelayProfile?.minMs) || 1000),
    },
    key,
    sessionIds: Array.isArray(agent.sessionIds) ? [...new Set(agent.sessionIds.map(String))] : [],
    segment: String(agent.segment || '').slice(0,200),
    serviceType: String(agent.serviceType || '').slice(0,200),
    name: String(agent.name || key).trim(),
    personality: String(agent.personality || agent.prompt || 'Atendente da loja.').trim(),
    responseStyle: String(agent.responseStyle || 'short_natural').trim(),
    tone: String(agent.tone || 'professional').trim(),
    objective: String(agent.objective || '').trim(),
    temperature: typeof agent.temperature === 'number'
      ? agent.temperature
      : (isNaN(Number(agent.temperature)) ? 0.7 : Number(agent.temperature)),
    sector: String(agent.sector || '').trim(),
    avatar: String(agent.avatar || '').trim(),
    hours: String(agent.hours || '').trim(),
    rules: String(agent.rules || '').trim(),
    memory: String(agent.memory || '').trim(),
    company: String(agent.company || '').trim(),
    companyDescription: String(agent.companyDescription || '').trim(),
    products: String(agent.products || '').trim(),
    services: String(agent.services || '').trim(),
    faq: String(agent.faq || '').trim(),
    policies: String(agent.policies || '').trim(),
    escalationPhone: String(agent.escalationPhone || '').trim(),
    escalationWhatsapp: String(agent.escalationWhatsapp || '').trim(),
    escalationActive: Boolean(agent.escalationActive ?? false),
    escalationMode: Number(agent.escalationMode ?? 1),
    escalationTriggers: Array.isArray(agent.escalationTriggers) ? agent.escalationTriggers : [],
    voiceEnabled: Boolean(agent.voiceEnabled ?? false),
    voiceRule: String(agent.voiceRule || 'always').trim(),
    voiceId: String(agent.voiceId || '').trim(),
    voiceProvider: String(agent.voiceProvider || 'default').trim(),
    voiceGender: String(agent.voiceGender || 'female').trim(),
    maxWords: typeof agent.maxWords === 'number'
      ? agent.maxWords
      : (isNaN(Number(agent.maxWords)) ? 0 : Number(agent.maxWords)),
    followUp: agent.followUp ? {
      active: Boolean(agent.followUp.active ?? true),
      aiGenerated: Boolean(agent.followUp.aiGenerated ?? true),
      respectBusinessHours: Boolean(agent.followUp.respectBusinessHours ?? true),
      count: Number(agent.followUp.count || 3),
      checkMin: Number(agent.followUp.checkMin || 300),
      intervalHours: Number(agent.followUp.intervalHours || 8),
      prompt: String(agent.followUp.prompt || '').trim()
    } : {
      active: true,
      aiGenerated: true,
      respectBusinessHours: true,
      count: 3,
      checkMin: 300,
      intervalHours: 8,
      prompt: ""
    },
    mediaAi: agent.mediaAi ? {
      enabled: Boolean(agent.mediaAi.enabled ?? false),
      items: Array.isArray(agent.mediaAi.items) ? agent.mediaAi.items : []
    } : {
      enabled: false,
      items: []
    }
  };
}

function getAgentsSync(tenantId = DEFAULT_TENANT_ID) {
  return cloneAgents(getTenantCache(tenantId));
}

function getActiveAgentsSync(tenantId = DEFAULT_TENANT_ID) {
  return getAgentsSync(tenantId).filter((agent) => agent.active !== false);
}

function findByNameSync(name = '', tenantId = DEFAULT_TENANT_ID) {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) return null;

  return (
    getAgentsSync(tenantId).find((agent) => String(agent.name || '').toLowerCase() === normalizedName) ||
    getAgentsSync(tenantId).find((agent) => String(agent.key || '').toLowerCase() === normalizedName) ||
    null
  );
}

function pickRandomAgentSync(tenantId = DEFAULT_TENANT_ID) {
  return selectRandomActiveAgent(getActiveAgentsSync(tenantId)) || null;
}

function getDelayForAgentMs(agent, tenantId = DEFAULT_TENANT_ID) {
  return getDelayMs(agent || pickRandomAgentSync(tenantId) || {
    delayProfile: { minMs: 1000, maxMs: 3000 },
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function persistAgents(tenantId) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await systemSettingsRepository.setSetting(
    settingsKey(normalizedTenantId),
    JSON.stringify(getTenantCache(normalizedTenantId)),
  );
}

async function hydrateFromSettings(tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (hydratedTenants.has(normalizedTenantId)) return getAgentsSync(normalizedTenantId);

  try {
    const row = await systemSettingsRepository.getSetting(settingsKey(normalizedTenantId));
    let parsed = [];
    let shouldPersist = false;

    if (row?.value) {
      parsed = JSON.parse(row.value);
    } else {
      // Fallback 1: try to load v1 config
      const v1Key = `ai_agents_config_v1:${normalizedTenantId}`;
      const v1Row = await systemSettingsRepository.getSetting(v1Key);
      if (v1Row?.value) {
        console.log(`[AI AGENT SERVICE] Found v1 agents config. Migrating to v2 for tenant: ${normalizedTenantId}`);
        parsed = JSON.parse(v1Row.value);
        shouldPersist = true;
      } else if (normalizedTenantId === DEFAULT_TENANT_ID) {
        // Fallback 2: seed from filesystem agents/ folder if database has no configuration (default tenant only)
        console.log(`[AI AGENT SERVICE] No database agents config found. Seeding default agents from disk for tenant: ${normalizedTenantId}`);
        const defaultAgents = [];
        const agentsDir = path.join(__dirname, '..', 'agents');
        try {
          if (fs.existsSync(agentsDir)) {
            const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.js'));
            for (const file of files) {
              const filePath = path.join(agentsDir, file);
              // Clean node cache to load fresh file contents
              delete require.cache[require.resolve(filePath)];
              const agentObj = require(filePath);
              if (agentObj && agentObj.name) {
                defaultAgents.push(agentObj);
              }
            }
          }
        } catch (fsErr) {
          console.error('[AI AGENT SERVICE] Failed to read default agents from disk:', fsErr.message);
        }
        
        parsed = defaultAgents;
        shouldPersist = true;
      } else {
        parsed = [];
      }
    }

    const normalizedAgents = Array.isArray(parsed) ? parsed.map((agent) => normalizeAgent(agent)) : [];
    agentsByTenant.set(normalizedTenantId, normalizedAgents);
    
    if (shouldPersist && normalizedAgents.length > 0) {
      await persistAgents(normalizedTenantId);
    }
  } catch (error) {
    agentsByTenant.set(normalizedTenantId, []);
    console.warn(`[AI AGENT SERVICE][tenant=${normalizedTenantId}] failed to hydrate agents:`, error.message || error);
  } finally {
    hydratedTenants.add(normalizedTenantId);
  }

  return getAgentsSync(normalizedTenantId);
}

async function listAgents(tenantId = DEFAULT_TENANT_ID) {
  await hydrateFromSettings(tenantId);
  return getAgentsSync(tenantId);
}

async function mutateAgents(companyId, change, reason) {
  if (!companyId) throw new Error('Empresa obrigatória.');
  const {pool}=require('../../../infrastructure/config/database');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[settingsKey(companyId)]);
    const row=(await client.query('SELECT value FROM system_settings WHERE key=$1 FOR UPDATE',[settingsKey(companyId)])).rows[0];
    const all=row?.value ? JSON.parse(row.value) : [];
    const result=await change(all,client);
    await client.query(`INSERT INTO system_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,[settingsKey(companyId),JSON.stringify(all)]);
    if(reason && result) for(const sessionId of result.sessionIds || []) {
      await client.query(`INSERT INTO ai_agent_versions(company_id,session_id,agent_key,snapshot,reason) VALUES($1,$2,$3,$4,$5)`,[companyId,sessionId,result.key,JSON.stringify(result),reason]);
    }
    await client.query('COMMIT'); resetCache(companyId);return result;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function createAgent(payload={},tenantId) {
  await validateSessions(tenantId,payload.sessionIds);
  const next=normalizeAgent({...payload,active:payload.active===true});
  return mutateAgents(tenantId,all=>{if(all.some(a=>a.key===next.key))throw new Error('Atendente já existe.');all.push(next);return next;},'configuration');
}
async function updateAgent(agentKey,payload={},tenantId) {
  return mutateAgents(tenantId,async (all,client)=>{
    const index=all.findIndex(a=>a.key===agentKey);if(index<0)throw new Error('Atendente não encontrado.');
    const next=normalizeAgent({...all[index],...payload,key:agentKey});
    await validateSessions(tenantId,next.sessionIds,client);
    all[index]=next;return next;
  },'configuration');
}
async function setAgentActive(agentKey,active,tenantId){return updateAgent(agentKey,{active:Boolean(active)},tenantId);}
async function deleteAgent(agentKey,tenantId){return mutateAgents(tenantId,all=>{const i=all.findIndex(a=>a.key===agentKey);if(i<0)throw new Error('Atendente não encontrado.');return all.splice(i,1)[0];},'deleted');}
async function cloneAgent(agentKey,tenantId){
  return mutateAgents(tenantId,all=>{const original=all.find(a=>a.key===agentKey);if(!original)throw new Error('Atendente não encontrado.');const next=normalizeAgent({...original,key:require('crypto').randomUUID(),name:original.name+' (Cópia)',active:false});all.push(next);return next;},'configuration');
}

function resetCache(tenantId) {
  if (tenantId) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    hydratedTenants.delete(normalizedTenantId);
    agentsByTenant.delete(normalizedTenantId);
    return;
  }
  hydratedTenants.clear();
  agentsByTenant.clear();
}

// Atomically publish a reviewed history draft with its audit snapshot. No live
// cache mutation happens until the database transaction has committed.
async function publishHistoryCandidate({ companyId, sessionId, draftId, reviewedBy, expectedRevision }) {
  if (!companyId || !reviewedBy) throw new Error('Revisão autenticada obrigatória.');
  const { pool } = require('../../../infrastructure/config/database');
  await hydrateFromSettings(companyId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [settingsKey(companyId)]);
    const draft = (await client.query(`SELECT * FROM ai_history_drafts WHERE id=$1 AND company_id=$2 AND session_id=$3 FOR UPDATE`, [draftId, companyId, sessionId])).rows[0];
    if (!draft || draft.status !== 'draft') throw new Error('Rascunho não disponível para publicação.');
    if (require('../../../data/repositories/historyRepository').draftRevision(draft.candidate) !== expectedRevision) {
      const error = new Error('O rascunho mudou. Revise a versão atual antes de publicar.'); error.status = 409; throw error;
    }
    const setting = (await client.query('SELECT value FROM system_settings WHERE key=$1 FOR UPDATE', [settingsKey(companyId)])).rows[0];
    const agents = setting?.value ? JSON.parse(setting.value) : [];
    const index = agents.findIndex(a => a.key === draft.target_agent_key);
    if (draft.target_agent_key && index < 0) throw new Error('Atendente de destino não existe mais.');
    const previous = index < 0 ? null : agents[index];
    const key = previous?.key || `history-${draft.id}`;
    const candidate = draft.candidate;
    const profile = (await client.query("SELECT segment,service_type FROM session_ai_profiles WHERE company_id=$1 AND session_id=$2",[companyId,sessionId])).rows[0] || {};
    const next = normalizeAgent({ ...(previous || { followUp: { active: false } }), key,
      sessionIds: [...new Set([...(previous?.sessionIds || []),sessionId])], segment: candidate.segment || profile.segment, serviceType: candidate.serviceType || profile.service_type,
      name: candidate.name, personality: candidate.personality, rules: candidate.rules,
      responseStyle: candidate.responseStyle, tone: candidate.tone, active: previous ? previous.active : true });
    if (index < 0) agents.push(next); else agents[index] = next;
    await client.query(`INSERT INTO system_settings(key,value,updated_at) VALUES($1,$2,NOW())
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`, [settingsKey(companyId), JSON.stringify(agents)]);
    await client.query(`UPDATE ai_history_drafts SET status='published',previous_agent=$4,reviewed_by=$5,published_agent_key=$6,updated_at=NOW()
      WHERE id=$1 AND company_id=$2 AND session_id=$3`, [draft.id, companyId, sessionId, previous ? JSON.stringify(previous) : null, reviewedBy, key]);
    for (const assignedSession of next.sessionIds) await client.query(`INSERT INTO ai_agent_versions(company_id,session_id,agent_key,snapshot,evidence,reason) VALUES($1,$2,$3,$4,$5,'history_publication')`,[companyId,assignedSession,key,JSON.stringify(next),JSON.stringify(candidate.evidenceIds || [])]);
    await client.query('COMMIT');
    resetCache(companyId);
    await hydrateFromSettings(companyId);
    return next;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}


async function validateSessions(companyId,sessionIds,client) {
  if (!Array.isArray(sessionIds) || !sessionIds.length || sessionIds.length > 50) throw new Error('Selecione pelo menos um WhatsApp.');
  const memory = require('../../../../services/aiMemoryEngine');
  for (const sessionId of sessionIds) await memory.assertSession(companyId,sessionId,client);
}
async function sessionKnowledge(companyId,sessionId) {
  const {query}=require('../../../infrastructure/config/database');
  const store=(await query(`SELECT s.name,s.knowledge FROM ai_stores s JOIN session_ai_profiles p
    ON p.company_id=s.company_id AND p.store_id=s.id WHERE p.company_id=$1 AND p.session_id=$2`,[companyId,sessionId])).rows[0];
  return store ? '\nCONHECIMENTO OFICIAL ATUAL DA LOJA '+store.name+':\n'+store.knowledge : '';
}
function validateStyle(value) {
  const result={};
  if (['professional','friendly','neutral'].includes(value?.tone)) result.tone=value.tone;
  if (['short_natural','elaborate'].includes(value?.responseStyle)) result.responseStyle=value.responseStyle;
  return result;
}
async function withSessionStyle(agent,companyId,sessionId) {
  const {query}=require('../../../infrastructure/config/database');
  const row=(await query('SELECT style FROM ai_session_agent_styles WHERE company_id=$1 AND session_id=$2 AND agent_key=$3',[companyId,sessionId,agent.key])).rows[0];
  return {...agent,...validateStyle(row?.style)};
}
async function restoreSessionStyle(companyId,sessionId,agentKey,versionId) {
  await validateSessions(companyId,[sessionId]);
  const {pool}=require('../../../infrastructure/config/database');
  const version=(await pool.query('SELECT snapshot FROM ai_agent_versions WHERE company_id=$1 AND session_id=$2 AND agent_key=$3 AND id=$4',[companyId,sessionId,agentKey,versionId])).rows[0];
  if(!version) throw new Error('Versão não encontrada.');
  if(version.snapshot.name) {
    const rawSessions = Array.isArray(version.snapshot.sessionIds) && version.snapshot.sessionIds.length > 0
      ? version.snapshot.sessionIds
      : [sessionId];
    const existing = (await pool.query('SELECT session_id FROM sessions WHERE company_id=$1 AND session_id=ANY($2::text[])',[companyId,rawSessions])).rows.map(r=>r.session_id);
    const validSessions = existing.length > 0 ? existing : [sessionId];
    await validateSessions(companyId,validSessions);
    return mutateAgents(companyId,async (all,client)=>{
      await client.query("UPDATE session_ai_profiles SET evolution_mode='paused' WHERE company_id=$1 AND session_id=ANY($2::text[])",[companyId,validSessions]);
      await client.query("DELETE FROM ai_session_agent_styles WHERE company_id=$1 AND agent_key=$2",[companyId,agentKey]);
      const index=all.findIndex(a=>a.key===agentKey);if(index<0)throw new Error('Atendente não encontrado.');
      all[index]=normalizeAgent({...version.snapshot,key:agentKey,sessionIds:validSessions});return all[index];
    },'configuration_restore');
  }
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    const scope=[companyId,sessionId,agentKey];
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[JSON.stringify(scope)]);
    const row=(await c.query('SELECT snapshot FROM ai_agent_versions WHERE company_id=$1 AND session_id=$2 AND agent_key=$3 AND id=$4',[...scope,versionId])).rows[0];
    if(!row) throw new Error('Versão não encontrada.');
    const style=validateStyle(row.snapshot);
    await c.query(`INSERT INTO ai_session_agent_styles(company_id,session_id,agent_key,style) VALUES($1,$2,$3,$4)
      ON CONFLICT(company_id,session_id,agent_key) DO UPDATE SET style=EXCLUDED.style`,[...scope,JSON.stringify(style)]);
    await c.query(`INSERT INTO ai_agent_versions(company_id,session_id,agent_key,snapshot,reason) VALUES($1,$2,$3,$4,'restore')`,[...scope,JSON.stringify(style)]);
    await c.query(`UPDATE session_ai_profiles SET evolution_mode='paused' WHERE company_id=$1 AND session_id=$2`,[companyId,sessionId]);
    await c.query('COMMIT'); return style;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
// Derive only bounded length/style from explicitly human messages. No generated rules are executable.
async function evolveSessionStyles() {
  const {pool}=require('../../../infrastructure/config/database');
  const profiles=(await pool.query(`SELECT p.company_id,p.session_id FROM session_ai_profiles p
    JOIN sessions s ON s.company_id=p.company_id AND s.session_id=p.session_id WHERE p.evolution_mode='limited'`)).rows;
  for(const profile of profiles) {
    const agents=(await listAgents(profile.company_id)).filter(a=>a.active && (!a.sessionIds?.length || a.sessionIds.includes(profile.session_id)));
    for(const agent of agents) {
      const c=await pool.connect();const scope=[profile.company_id,profile.session_id,agent.key];
      try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[JSON.stringify(scope)]);
        const enabled=(await c.query(`SELECT evolution_mode FROM session_ai_profiles WHERE company_id=$1 AND session_id=$2 FOR UPDATE`,scope.slice(0,2))).rows[0];
        if(enabled?.evolution_mode!=='limited'){await c.query('COMMIT');continue;}
        const rows=(await c.query(`SELECT id,text,content FROM messages WHERE company_id=$1 AND session_id=$2
          AND from_me=TRUE AND (message_origin='human' OR message_origin='unknown') AND memory_projected=TRUE ORDER BY id DESC LIMIT 100`,scope.slice(0,2))).rows;
        const count=Number((await c.query(`SELECT COUNT(*) AS n FROM messages WHERE company_id=$1 AND session_id=$2 AND from_me=TRUE AND (message_origin='human' OR message_origin='unknown') AND memory_projected=TRUE`,scope.slice(0,2))).rows[0].n);
        const previous=(await c.query('SELECT * FROM ai_session_agent_styles WHERE company_id=$1 AND session_id=$2 AND agent_key=$3',scope)).rows[0];
        if(count-(previous?.observed_count || 0)<10){await c.query('COMMIT');continue;}
        const lengths=rows.map(r=>String(r.content || r.text || '').split(/\s+/).length);
        const style={responseStyle:lengths.reduce((a,b)=>a+b,0)/lengths.length>60 ? 'elaborate':'short_natural'};
        if(!previous) await c.query(`INSERT INTO ai_agent_versions(company_id,session_id,agent_key,snapshot,reason) VALUES($1,$2,$3,$4,'baseline')`,[...scope,JSON.stringify(validateStyle(agent))]);
        await c.query(`INSERT INTO ai_session_agent_styles(company_id,session_id,agent_key,style,observed_count) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT(company_id,session_id,agent_key) DO UPDATE SET style=EXCLUDED.style,observed_count=EXCLUDED.observed_count`,[...scope,JSON.stringify(style),count]);
        if(JSON.stringify(previous?.style)!==JSON.stringify(style)) await c.query(`INSERT INTO ai_agent_versions(company_id,session_id,agent_key,snapshot,evidence,reason)
          VALUES($1,$2,$3,$4,$5,'automatic_style')`,[...scope,JSON.stringify(style),JSON.stringify(rows.map(r=>r.id))]);
        await c.query('COMMIT');
      }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    }
  }
}

module.exports = {
  validateSessions, sessionKnowledge, validateStyle, withSessionStyle, restoreSessionStyle, evolveSessionStyles,
  buildPersonalityPrompt,
  cloneAgent,
  createAgent,
  deleteAgent,
  findByNameSync,
  getActiveAgentsSync,
  getAgentsSync,
  getDelayForAgentMs,
  hydrateFromSettings,
  listAgents,
  pickRandomAgentSync,
  publishHistoryCandidate,
  resetCache,
  setAgentActive,
  updateAgent,
  wait,
};
