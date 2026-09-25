const express = require('express');
const { historySync } = require('../../../services/whatsapp/historySync');
const { pool } = require('../../infrastructure/config/database');
const agents = require('../agents/services/aiAgentService');
const ai = require('../../../services/ai.service');
const { redact, isHeldOut, GUARDRAILS } = require('./historyLearning');
const { rateLimit } = require('express-rate-limit');

function requireHistoryAuth(req, res, next) {
  if (!req.authTenantId || !req.auth) return res.status(401).json({ error: 'Autenticação obrigatória.' });
  if (req.method !== 'GET' && !['admin', 'owner', 'superadmin', 'super_admin', 'master_admin', 'manager'].includes(String(req.auth.role).toLowerCase())) {
    return res.status(403).json({ error: 'Somente administradores podem alterar o aprendizado.' });
  }
  next();
}

function createHistoryRouter({ repository = historySync.repository, db = pool, agentService = agents, analyze = ai.analyzeHistoryText } = {}) {
  const router = express.Router();
  router.use(requireHistoryAuth);
  router.use(rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente novamente em instantes.' }
  }));
  const handle = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (error) {
      if (!res.headersSent) {
        const status = error.status || 503;
        res.status(status).json({ error: error.message || 'Operação indisponível. Confira o sync, o banco e o provedor de IA.' });
      }
    }
  };
  router.get('/', handle(async (req, res) => {
    const sessions = (await db.query(`SELECT session_id,session_name,status FROM sessions WHERE company_id=$1 ORDER BY created_at`, [req.authTenantId])).rows;
    res.json({ sessions, agents: await agentService.listAgents(req.authTenantId), stores: (await db.query('SELECT * FROM ai_stores WHERE company_id=$1 ORDER BY name',[req.authTenantId])).rows });
  }));
  // Ownership is checked independently of any tenant supplied by the client.
  router.param('sessionId', async (req, res, next, sessionId) => {
    try {
      if (!sessionId || sessionId.length > 100 || await repository.owner(sessionId) !== req.authTenantId) return res.status(404).json({ error: 'Sessão não encontrada.' });
      await repository.ensure(req.authTenantId, sessionId);
      next();
    } catch (_) { res.status(404).json({ error: 'Sessão não encontrada.' }); }
  });
  router.post('/stores', handle(async(req,res)=>{
    const {
      name,
      segment='',
      knowledge='',
      phone='',
      website='',
      business_hours='',
      policies='',
      catalog_summary='',
      theme_color='#10b981',
      address='',
      attendant_name='',
      attendant_role='Assistente de Vendas',
      attendant_config={},
      settings={}
    }=req.body || {};
    if(typeof name!=='string' || !name.trim() || name.length>200 || typeof knowledge!=='string' || knowledge.length>30000) return res.status(400).json({error:'Informe nome e conhecimento válidos.'});
    const id=require('crypto').randomUUID();
    try {
      await db.query(`INSERT INTO ai_stores(
        company_id, id, name, segment, knowledge, phone, website, business_hours, policies, catalog_summary,
        theme_color, address, attendant_name, attendant_role, attendant_config, settings
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb)`,
      [
        req.authTenantId, id, name.trim(), String(segment).slice(0,200), knowledge,
        String(phone).slice(0,50), String(website).slice(0,200), String(business_hours).slice(0,200),
        String(policies).slice(0,5000), String(catalog_summary).slice(0,10000),
        String(theme_color || '#10b981').slice(0,50), String(address).slice(0,300),
        String(attendant_name).slice(0,100), String(attendant_role).slice(0,100),
        JSON.stringify(attendant_config || {}), JSON.stringify(settings || {})
      ]);
    } catch (_) {
      await db.query('INSERT INTO ai_stores(company_id,id,name,segment,knowledge) VALUES($1,$2,$3,$4,$5)',[req.authTenantId,id,name.trim(),String(segment).slice(0,200),knowledge]);
    }

    // Se informou nome do atendente para a loja, sincronizar/criar agente persona
    if (attendant_name && attendant_name.trim()) {
      try {
        const existingAgents = await agentService.listAgents(req.authTenantId);
        const match = existingAgents.find(a => a.name?.toLowerCase() === attendant_name.trim().toLowerCase());
        if (!match) {
          await agentService.createAgent({
            name: attendant_name.trim(),
            personality: `Você é ${attendant_name.trim()}, ${attendant_role || 'assistente oficial'} da loja ${name.trim()}. Atendimento prestativo, consultivo e focado em apresentar os melhores produtos e condições.`,
            active: true,
          }, req.authTenantId);
        }
      } catch (_) {}
    }

    res.status(201).json({id});
  }));
  router.put('/stores/:storeId',handle(async(req,res)=>{
    const {
      name,
      knowledge='',
      segment='',
      phone='',
      website='',
      business_hours='',
      policies='',
      catalog_summary='',
      theme_color='#10b981',
      address='',
      attendant_name='',
      attendant_role='Assistente de Vendas',
      attendant_config={},
      settings={}
    }=req.body || {};
    const safeKnowledge = typeof knowledge === 'string' ? knowledge : '';
    if(typeof name!=='string' || !name.trim() || name.length>200 || safeKnowledge.length>30000) return res.status(400).json({error:'Dados da loja inválidos.'});
    let result;
    try {
      result=await db.query(`UPDATE ai_stores SET
        name=$3, knowledge=$4, segment=$5, phone=$6, website=$7, business_hours=$8, policies=$9, catalog_summary=$10,
        theme_color=$11, address=$12, attendant_name=$13, attendant_role=$14, attendant_config=$15::jsonb, settings=$16::jsonb
        WHERE company_id=$1 AND id=$2 RETURNING id`,
      [
        req.authTenantId, req.params.storeId, name, safeKnowledge, String(segment).slice(0,200),
        String(phone).slice(0,50), String(website).slice(0,200), String(business_hours).slice(0,200),
        String(policies).slice(0,5000), String(catalog_summary).slice(0,10000),
        String(theme_color || '#10b981').slice(0,50), String(address).slice(0,300),
        String(attendant_name).slice(0,100), String(attendant_role).slice(0,100),
        JSON.stringify(attendant_config || {}), JSON.stringify(settings || {})
      ]);
    } catch (_) {
      result=await db.query('UPDATE ai_stores SET name=$3,knowledge=$4,segment=$5 WHERE company_id=$1 AND id=$2 RETURNING id',[req.authTenantId,req.params.storeId,name,knowledge,String(segment).slice(0,200)]);
    }

    // Se informou nome do atendente para a loja, sincronizar/criar ou atualizar agente persona
    if (attendant_name && attendant_name.trim()) {
      try {
        const existingAgents = await agentService.listAgents(req.authTenantId);
        const match = existingAgents.find(a => a.name?.toLowerCase() === attendant_name.trim().toLowerCase());
        const personality = `Você é ${attendant_name.trim()}, ${attendant_role || 'assistente oficial'} da loja ${name.trim()}. Atendimento prestativo, consultivo e focado em apresentar os melhores produtos e condições.`;
        if (!match) {
          await agentService.createAgent({
            name: attendant_name.trim(),
            personality,
            active: true,
          }, req.authTenantId);
        } else {
          await agentService.updateAgent(match.id || match.key, {
            personality,
          }, req.authTenantId);
        }
      } catch (_) {}
    }

    res.status(result.rows.length?200:404).json({success:Boolean(result.rows.length)});
  }));
  router.get('/:sessionId/profile',handle(async(req,res)=>{
    const profile=(await db.query('SELECT * FROM session_ai_profiles WHERE company_id=$1 AND session_id=$2',[req.authTenantId,req.params.sessionId])).rows[0];
    const memory=await require('../../../services/aiMemoryEngine').status(req.authTenantId,req.params.sessionId);
    res.json({profile:profile || {store_id:null,segment:'',service_type:'',evolution_mode:'limited'},memory});
  }));
  router.put('/:sessionId/profile',handle(async(req,res)=>{
    const {storeId=null,segment='',serviceType='',evolutionMode='limited'}=req.body || {};
    if(!['limited','paused'].includes(evolutionMode)) return res.status(400).json({error:'Modo inválido.'});
    if(storeId && !(await db.query('SELECT id FROM ai_stores WHERE company_id=$1 AND id=$2',[req.authTenantId,storeId])).rows.length) return res.status(404).json({error:'Loja não encontrada.'});
    await db.query(`INSERT INTO session_ai_profiles(company_id,session_id,store_id,segment,service_type,evolution_mode) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(company_id,session_id) DO UPDATE SET store_id=EXCLUDED.store_id,segment=EXCLUDED.segment,service_type=EXCLUDED.service_type,evolution_mode=EXCLUDED.evolution_mode`,[req.authTenantId,req.params.sessionId,storeId,String(segment).slice(0,200),String(serviceType).slice(0,200),evolutionMode]);
    res.json({success:true});
  }));
  router.post('/:sessionId/preview',handle(async(req,res)=>{
    const {prompt,segment='',serviceType=''}=req.body || {};
    if(typeof prompt!=='string' || !prompt.trim() || prompt.length>10000) return res.status(400).json({error:'Descreva o atendente em até 10.000 caracteres.'});
    const raw=await analyze({companyId:req.authTenantId,prompt:'Crie um atendente. Retorne somente JSON com name e personality (strings). Não invente produtos, preços ou condições comerciais. '+GUARDRAILS,message:JSON.stringify({prompt,segment,serviceType}),history:[]});
    let candidate;
    try {candidate=JSON.parse(String(raw).replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));}catch(_){return res.status(502).json({error:'A IA não retornou uma prévia válida. Tente novamente.'});}
    if(typeof candidate.name!=='string' || typeof candidate.personality!=='string') return res.status(502).json({error:'Prévia incompleta.'});
    res.json({candidate:{name:candidate.name.slice(0,200),personality:candidate.personality.slice(0,10000),rules:GUARDRAILS,segment:String(segment).slice(0,200),serviceType:String(serviceType).slice(0,200),sessionIds:[req.params.sessionId],active:false}});
  }));
  router.post('/:sessionId/agents',handle(async(req,res)=>{
    const {reviewed, ...payload}=req.body || {};
    if(reviewed!==true || typeof payload.name!=='string' || !payload.name.trim() || typeof payload.personality!=='string' || !payload.personality.trim() || payload.personality.length>10000) return res.status(400).json({error:'Revise nome e instruções antes de ativar.'});
    await agentService.validateSessions(req.authTenantId,payload.sessionIds);
    if(!payload.sessionIds.includes(req.params.sessionId)) return res.status(400).json({error:'Inclua a conexão selecionada.'});
    const agent=await agentService.createAgent({...payload,key:require('crypto').randomUUID(),rules:GUARDRAILS,active:true},req.authTenantId);
    res.status(201).json({agent});
  }));
  router.post('/:sessionId/agents/:agentKey/link',handle(async(req,res)=>{
    const current=(await agentService.listAgents(req.authTenantId)).find(a=>a.key===req.params.agentKey);
    if(!current) return res.status(404).json({error:'Atendente não encontrado.'});
    const agent=await agentService.updateAgent(current.key,{sessionIds:[...new Set([...(current.sessionIds || []),req.params.sessionId])]},req.authTenantId);
    res.json({agent});
  }));
  router.post('/:sessionId/agents/:agentKey/preview',handle(async(req,res)=>{
    const prompt=String(req.body?.prompt || '').trim();
    if(!prompt || prompt.length>10000) return res.status(400).json({error:'Descreva a alteração em até 10.000 caracteres.'});
    const current=(await agentService.listAgents(req.authTenantId)).find(a=>a.key===req.params.agentKey && a.sessionIds?.includes(req.params.sessionId));
    if(!current) return res.status(404).json({error:'Atendente não vinculado à conexão.'});
    const raw=await analyze({companyId:req.authTenantId,prompt:`Revise as instruções de um atendente. Retorne somente JSON com name e personality (strings). Preserve regras comerciais existentes; não invente produtos, preços ou políticas. ${GUARDRAILS}`,
      message:JSON.stringify({name:current.name,personality:current.personality,request:prompt}),history:[]});
    let candidate;
    try {candidate=JSON.parse(String(raw).replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));}catch(_){return res.status(502).json({error:'A IA não retornou uma prévia válida.'});}
    if(typeof candidate.name!=='string' || typeof candidate.personality!=='string') return res.status(502).json({error:'Prévia incompleta.'});
    res.json({candidate:{name:candidate.name.slice(0,100),personality:candidate.personality.slice(0,10000)}});
  }));
  router.patch('/:sessionId/agents/:agentKey',handle(async(req,res)=>{
    const {name,personality,reviewed}=req.body || {};
    if(reviewed!==true || typeof name!=='string' || !name.trim() || name.length>100 || typeof personality!=='string' || !personality.trim() || personality.length>10000) return res.status(400).json({error:'Revise nome e instruções antes de salvar.'});
    const current=(await agentService.listAgents(req.authTenantId)).find(a=>a.key===req.params.agentKey && a.sessionIds?.includes(req.params.sessionId));
    if(!current) return res.status(404).json({error:'Atendente não vinculado à conexão.'});
    const agent=await agentService.updateAgent(current.key,{name:name.trim(),personality},req.authTenantId);
    res.json({agent});
  }));
  router.get('/:sessionId/versions/:agentKey',handle(async(req,res)=>{
    res.json({versions:(await db.query('SELECT * FROM ai_agent_versions WHERE company_id=$1 AND session_id=$2 AND agent_key=$3 ORDER BY id DESC LIMIT 50',[req.authTenantId,req.params.sessionId,req.params.agentKey])).rows});
  }));
  router.post('/:sessionId/versions/:agentKey/:versionId/restore',handle(async(req,res)=>{
    if (!/^\d+$/.test(String(req.params.versionId || ''))) return res.status(400).json({ error: 'ID de versão inválido.' });
    await agentService.restoreSessionStyle(req.authTenantId,req.params.sessionId,req.params.agentKey,req.params.versionId);
    res.json({success:true});
  }));
  router.get('/:sessionId/memory',handle(async(req,res)=>{
    res.json({entries:await require('../../../services/aiMemoryEngine').searchPersisted(req.authTenantId,req.params.sessionId,req.query.q)});
  }));
  router.get('/:sessionId/status', handle(async (req, res) => {
    const status = await repository.status(req.authTenantId, req.params.sessionId);
    const unavailable = (await db.query(`SELECT COUNT(*)::int AS count FROM whatsapp_history_requests WHERE company_id=$1 AND session_id=$2
      AND (status='unavailable' OR (status='waiting' AND requested_at<NOW()-INTERVAL '2 minutes'))`, [req.authTenantId, req.params.sessionId])).rows[0].count;
    res.json({ ...status, history_requests_without_response: unavailable });
  }));
  router.post('/:sessionId/resume', handle(async (req, res) => {
    await repository.resume(req.authTenantId, req.params.sessionId);
    await db.query(`UPDATE ai_history_drafts SET last_error=NULL WHERE company_id=$1 AND session_id=$2 AND status='analyzing'`, [req.authTenantId, req.params.sessionId]);
    await db.query(`DELETE FROM whatsapp_history_requests WHERE company_id=$1 AND session_id=$2`, [req.authTenantId, req.params.sessionId]);
    res.status(202).json({ success: true });
  }));
  router.post('/:sessionId/learning', handle(async (req, res) => {
    const { enabled, targetAgentKey } = req.body || {};
    if (typeof enabled !== 'boolean' || (targetAgentKey != null && (typeof targetAgentKey !== 'string' || targetAgentKey.length > 100))) return res.status(400).json({ error: 'Configuração inválida.' });
    const list = await agentService.listAgents(req.authTenantId);
    if (targetAgentKey && !list.some(a => a.key === targetAgentKey)) return res.status(400).json({ error: 'Atendente não pertence à loja.' });
    await db.query(`UPDATE whatsapp_history_sync SET learning_enabled=$3,target_agent_key=$4 WHERE company_id=$1 AND session_id=$2`, [req.authTenantId, req.params.sessionId, enabled, targetAgentKey || null]);
    res.status(202).json({ success: true });
  }));
  router.get('/:sessionId/evidence', handle(async (req, res) => {
    const cursor = /^\d+$/.test(String(req.query.after || '0')) ? String(req.query.after || '0') : '0';
    const mediaOnly = req.query.media === '1';
    const rows = (await db.query(`SELECT id,text,media_text,media_state,media_type,media_path,origin,from_me,occurred_at,chat_name FROM whatsapp_history_items
      WHERE company_id=$1 AND session_id=$2 AND id>$3 AND ($4::boolean=FALSE OR (media_type IS NOT NULL AND media_type NOT IN ('text','none')))
      ORDER BY id LIMIT 50`, [req.authTenantId, req.params.sessionId, cursor, mediaOnly])).rows;
    res.json({ items: rows.map(({ chat_name, ...r }) => ({ ...r, text: redact(r.text, [chat_name]), media_text: redact(r.media_text, [chat_name]) })), next: rows.length === 50 ? rows[49].id : null });
  }));
  router.post('/:sessionId/evidence/:id/author', handle(async (req, res) => {
    const origin = req.body?.origin;
    if (!['human', 'campaign', 'automation', 'unknown'].includes(origin) || !/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Autoria inválida.' });
    const result = await db.query(`UPDATE whatsapp_history_items SET origin=$4,updated_at=NOW() WHERE id=$1 AND company_id=$2 AND session_id=$3 AND from_me=TRUE RETURNING id`, [req.params.id, req.authTenantId, req.params.sessionId, origin]);
    res.status(result.rowCount ? 200 : 404).json({ success: Boolean(result.rowCount) });
  }));
  router.param('draftId', async (req, res, next, id) => {
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Rascunho inválido.' });
    try {
      const row = (await db.query(`SELECT * FROM ai_history_drafts WHERE id=$1 AND company_id=$2 AND session_id=$3`, [id, req.authTenantId, req.params.sessionId])).rows[0];
      if (!row) return res.status(404).json({ error: 'Rascunho não encontrado.' });
      req.historyDraft = row; next();
    } catch (_) { res.status(503).json({ error: 'Falha ao consultar rascunho.' }); }
  });
  router.patch('/:sessionId/drafts/:draftId', handle(async (req, res) => {
    const { name, personality } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || typeof personality !== 'string' || !personality.trim() || personality.length > 20000) return res.status(400).json({ error: 'Nome e instruções válidos são obrigatórios.' });
    const result = await db.query(`UPDATE ai_history_drafts SET candidate=candidate || $4::jsonb,updated_at=NOW()
      WHERE id=$1 AND company_id=$2 AND session_id=$3 AND status='draft' RETURNING id`, [req.params.draftId, req.authTenantId, req.params.sessionId, JSON.stringify({ name: name.trim(), personality, rules: GUARDRAILS, segment:String(req.body.segment || "").slice(0,200), serviceType:String(req.body.serviceType || "").slice(0,200) })]);
    res.status(result.rowCount ? 200 : 409).json({ success: Boolean(result.rowCount) });
  }));
  router.post('/:sessionId/drafts/:draftId/discard', handle(async (req, res) => {
    const result = await db.query(`UPDATE ai_history_drafts SET status='discarded',updated_at=NOW() WHERE id=$1 AND company_id=$2 AND session_id=$3 AND status IN ('draft','analyzing') RETURNING id`, [req.params.draftId, req.authTenantId, req.params.sessionId]);
    res.status(result.rowCount ? 200 : 409).json({ success: Boolean(result.rowCount) });
  }));
  router.post('/:sessionId/drafts/:draftId/publish', handle(async (req, res) => {
    if (req.body?.reviewed !== true || req.historyDraft.status !== 'draft') return res.status(409).json({ error: 'Revise o rascunho antes de publicar.' });
    const agent = await agentService.publishHistoryCandidate({ companyId: req.authTenantId, sessionId: req.params.sessionId,
      draftId: req.params.draftId, expectedRevision: req.body.expectedRevision, reviewedBy: String(req.auth.sub || req.auth.userId || req.auth.email || 'admin') });
    res.json({ success: true, agent });
  }));
  router.post('/:sessionId/drafts/:draftId/simulate', handle(async (req, res) => {
    const draft = req.historyDraft;
    if (draft.status !== 'draft') return res.status(409).json({ error: 'Aguarde a análise terminar.' });
    const chats = (await db.query(`SELECT DISTINCT chat_jid FROM whatsapp_history_items WHERE company_id=$1 AND session_id=$2 AND id<=$3`, [req.authTenantId, req.params.sessionId, draft.watermark])).rows;
    const jid = chats.map(r => r.chat_jid).find(isHeldOut);
    if (!jid) return res.status(409).json({ error: 'Ainda não há conversa reservada para comparação.' });
    const sample = (await db.query(`SELECT id,text,media_text,chat_name,from_me FROM whatsapp_history_items WHERE company_id=$1 AND session_id=$2 AND chat_jid=$3 AND id<=$4
      AND import_state='done' ORDER BY occurred_at,id LIMIT 20`, [req.authTenantId, req.params.sessionId, jid, draft.watermark])).rows;
    const questionIndex = sample.findLastIndex(i => !i.from_me && (i.text || i.media_text));
    if (questionIndex < 0) return res.status(409).json({ error: 'Conversa reservada sem pergunta disponível.' });
    const names = sample.map(i => i.chat_name);
    const question = redact(sample[questionIndex].text || sample[questionIndex].media_text, names);
    const history = sample.slice(0, questionIndex).map(i => ({ role: i.from_me ? 'assistant' : 'user', content: redact([i.text, i.media_text].filter(Boolean).join('\n'), names).slice(0, 3000) }));
    const current = (await agentService.listAgents(req.authTenantId)).find(a => a.key === draft.target_agent_key);
    const knowledge = [{title:'Conhecimento vinculado',content:await agentService.sessionKnowledge(req.authTenantId,req.params.sessionId)}];
    const common = `\n${GUARDRAILS}\nConhecimento oficial da loja: ${JSON.stringify(knowledge)}\nSimulação textual: não execute ferramentas nem envie mensagens.`;
    const [before, after] = await Promise.all([
      current ? analyze({ companyId: req.authTenantId, prompt: `${current.personality}\n${current.rules || ''}${common}`, message: question, history }) : Promise.resolve('Sem atendente anterior.'),
      analyze({ companyId: req.authTenantId, prompt: `${draft.candidate.personality}${common}`, message: question, history }),
    ]);
    res.json({ question, before: redact(before, names), after: redact(after, names), evidenceId: sample[questionIndex].id,
      note: 'Conversa reservada fora da modelagem. Simulação textual, sem envio ou execução de ferramentas.' });
  }));
  return router;
}
module.exports = { createHistoryRouter, requireHistoryAuth };
