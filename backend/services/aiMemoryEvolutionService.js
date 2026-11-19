'use strict';

const crypto = require('crypto');
const { query, pool } = require('../src/infrastructure/config/database');
const aiAgentService = require('../src/ai/agents/services/aiAgentService');

const MEMORY_CATEGORIES = Object.freeze([
  'preferences',
  'products',
  'pricing_conditions',
  'objections',
  'commercial_rules',
  'attendance_strategies',
  'insights',
]);

const MEMORY_CATEGORY_LABELS = Object.freeze({
  preferences: 'Preferências',
  products: 'Produtos',
  pricing_conditions: 'Preços e condições',
  objections: 'Objeções',
  commercial_rules: 'Regras comerciais',
  attendance_strategies: 'Estratégias de atendimento',
  insights: 'Insights',
});

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|rules)/i,
  /(?:esquec[ea]|desconsidere|anule|substitua)\s+(?:as\s+)?(?:regras|instru[cç][õo]es|sistema|pre[cç]os)/i,
  /(?:system\s*prompt|developer\s*message|jailbreak|bypass\s*guardrail)/i,
  /<\/?(?:system|assistant|tool|instruction)>/i,
  /voc[eê]\s+(?:agora\s+[eé]|deve\s+obedecer\s+apenas|passe\s+a\s+vender\s+por\s+r\$\s*0)/i,
  /(?:pre[cç]o\s+novo|mude\s+o\s+pre[cç]o|desconto\s+de\s+100%|gr[aá]tis\s+para\s+sempre)/i,
];

function sanitizeMemoryCandidate({ category = 'insights', title = '', content = '', sourceRole = 'human_admin', isUntrustedCustomer = false } = {}) {
  const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const cleanContent = String(content || '').trim().slice(0, 4000);
  const normCategory = MEMORY_CATEGORIES.includes(category) ? category : 'insights';

  if (!cleanContent || cleanContent.length < 3) {
    return { allowed: false, reason: 'Conteúdo de memória vazio ou muito curto.' };
  }

  const combined = `${cleanTitle} ${cleanContent}`;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(combined)) {
      return { allowed: false, reason: 'Conteúdo bloqueado por política anti-injeção de prompt.' };
    }
  }

  // Never allow untrusted single customer utterances to create permanent commercial/pricing rules
  const fromCustomer = isUntrustedCustomer || sourceRole === 'customer' || sourceRole === 'user';
  if (fromCustomer && (normCategory === 'commercial_rules' || normCategory === 'pricing_conditions')) {
    return {
      allowed: false,
      reason: 'Mensagens de clientes não podem criar regras comerciais ou preços permanentes.',
    };
  }

  return {
    allowed: true,
    category: normCategory,
    title: cleanTitle || cleanContent.slice(0, 80),
    content: cleanContent,
  };
}

function normalizePeriod(period = '30d', start = null, end = null) {
  const p = String(period || '30d').trim().toLowerCase();
  const now = new Date();
  let startDate = null;
  let endDate = end ? new Date(end) : null;

  if (p === 'today') {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
  } else if (p === '7d') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (p === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (p === 'custom' && start) {
    startDate = new Date(start);
  } else if (p === 'all' || p === 'geral') {
    startDate = null;
  } else {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (startDate && Number.isNaN(startDate.getTime())) startDate = null;
  if (endDate && Number.isNaN(endDate.getTime())) endDate = null;

  return {
    period: p,
    startIso: startDate ? startDate.toISOString() : null,
    endIso: endDate ? endDate.toISOString() : null,
  };
}

function mapNodeToCategory(nodeType, explicitCategory) {
  if (explicitCategory && MEMORY_CATEGORIES.includes(explicitCategory)) return explicitCategory;
  if (nodeType === 'preference' || nodeType === 'habit') return 'preferences';
  if (nodeType === 'product' || nodeType === 'product_media') return 'products';
  if (nodeType === 'objection') return 'objections';
  if (nodeType === 'commercial_rule') return 'commercial_rules';
  if (nodeType === 'attendance_strategy') return 'attendance_strategies';
  if (nodeType === 'pricing_condition') return 'pricing_conditions';
  return 'insights';
}

function categoryToNodeType(category) {
  const map = {
    preferences: 'preference',
    products: 'product',
    pricing_conditions: 'pricing_condition',
    objections: 'objection',
    commercial_rules: 'commercial_rule',
    attendance_strategies: 'attendance_strategy',
    insights: 'evolution_insight',
  };
  return map[category] || 'evolution_insight';
}

async function listMemories({
  companyId = 'default',
  agentKey = null,
  sessionId = null,
  category = null,
  search = '',
  status = 'all',
  scope = 'all',
  limit = 80,
  offset = 0,
} = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 80));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const params = [cleanCompany];
  const where = [
    `company_id = $1`,
    `node_type NOT IN ('conversation', 'contact')`,
  ];

  if (agentKey && agentKey !== 'all') {
    params.push(String(agentKey).trim().toLowerCase());
    where.push(`(LOWER(agent_key) = $${params.length} OR memory_scope = 'company_shared')`);
  }

  if (sessionId && sessionId !== 'all') {
    params.push(String(sessionId).trim());
    where.push(`(session_id IS NULL OR session_id = '' OR session_id = $${params.length} OR properties->>'sessionId' = $${params.length} OR memory_scope = 'company_shared')`);
  }

  if (category && category !== 'all' && MEMORY_CATEGORIES.includes(category)) {
    params.push(category);
    where.push(`(category = $${params.length} OR (category IS NULL AND (
      ($${params.length} = 'preferences' AND node_type IN ('preference', 'habit'))
      OR ($${params.length} = 'products' AND node_type IN ('product', 'product_media'))
      OR ($${params.length} = 'objections' AND node_type = 'objection')
      OR ($${params.length} = 'pricing_conditions' AND node_type = 'pricing_condition')
      OR ($${params.length} = 'commercial_rules' AND node_type = 'commercial_rule')
      OR ($${params.length} = 'attendance_strategies' AND node_type = 'attendance_strategy')
      OR ($${params.length} = 'insights' AND node_type IN ('evolution_insight', 'learned_pattern', 'topic', 'intent', 'city', 'concept', 'episode'))
    )))`);
  }

  if (status && status !== 'all') {
    params.push(status);
    where.push(`COALESCE(status, 'active') = $${params.length}`);
  }

  if (scope && scope !== 'all') {
    params.push(scope);
    where.push(`COALESCE(memory_scope, 'agent') = $${params.length}`);
  }

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    where.push(`(label ILIKE $${params.length} OR COALESCE(content, '') ILIKE $${params.length} OR searchable_text ILIKE $${params.length})`);
  }

  params.push(safeLimit, safeOffset);

  const sql = `
    SELECT id, company_id, agent_key, session_id, memory_scope, node_key, node_type, category,
           label, content, properties, provenance, weight, occurrences, confidence,
           COALESCE(status, 'active') AS status, created_at, COALESCE(updated_at, last_seen_at) AS updated_at, last_seen_at
    FROM agent_memory_nodes
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(updated_at, last_seen_at) DESC, weight DESC, id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const res = await query(sql, params);

  const countSql = `
    SELECT
      COALESCE(category,
        CASE
          WHEN node_type IN ('preference', 'habit') THEN 'preferences'
          WHEN node_type IN ('product', 'product_media') THEN 'products'
          WHEN node_type = 'objection' THEN 'objections'
          WHEN node_type = 'pricing_condition' THEN 'pricing_conditions'
          WHEN node_type = 'commercial_rule' THEN 'commercial_rules'
          WHEN node_type = 'attendance_strategy' THEN 'attendance_strategies'
          ELSE 'insights'
        END
      ) AS cat,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(status, 'active') = 'active')::int AS active_count
    FROM agent_memory_nodes
    WHERE company_id = $1 AND node_type NOT IN ('conversation', 'contact')
    ${agentKey && agentKey !== 'all' ? `AND (LOWER(agent_key) = $2 OR memory_scope = 'company_shared')` : ''}
    GROUP BY cat
  `;
  const countParams = agentKey && agentKey !== 'all' ? [cleanCompany, String(agentKey).trim().toLowerCase()] : [cleanCompany];
  const countsRes = await query(countSql, countParams).catch(() => ({ rows: [] }));

  const categoryCounts = {};
  for (const cat of MEMORY_CATEGORIES) categoryCounts[cat] = { total: 0, active: 0 };
  for (const row of countsRes.rows || []) {
    if (categoryCounts[row.cat]) {
      categoryCounts[row.cat].total += Number(row.total || 0);
      categoryCounts[row.cat].active += Number(row.active_count || 0);
    }
  }

  const items = (res.rows || []).map((row) => {
    const resolvedCategory = mapNodeToCategory(row.node_type, row.category);
    return {
      id: row.id,
      companyId: row.company_id,
      agentKey: row.agent_key,
      sessionId: row.session_id || row.properties?.sessionId || null,
      memoryScope: row.memory_scope || 'agent',
      category: resolvedCategory,
      categoryLabel: MEMORY_CATEGORY_LABELS[resolvedCategory] || 'Insights',
      title: row.label,
      content: row.content || row.label,
      origin: row.provenance?.source || row.properties?.source || (row.node_type === 'evolution_insight' ? 'evolution_engine' : 'conversation'),
      provenance: row.provenance || {},
      occurrences: Math.max(1, Number(row.occurrences || Math.round(row.weight || 1))),
      confidence: Number(row.confidence || 0.8),
      status: row.status || 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.last_seen_at,
    };
  });

  return { items, categoryCounts };
}

async function createMemory({
  companyId = 'default',
  agentKey = 'camila',
  sessionId = null,
  memoryScope = 'agent',
  category = 'insights',
  title,
  content,
  confidence = 0.9,
  origin = 'manual_operator',
  sourceRole = 'human_admin',
  actor = {},
} = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const cleanAgent = String(agentKey || 'camila').trim().toLowerCase();
  const cleanScope = ['agent', 'session', 'company_shared'].includes(memoryScope) ? memoryScope : 'agent';

  const check = sanitizeMemoryCandidate({ category, title, content, sourceRole });
  if (!check.allowed) {
    const err = new Error(check.reason);
    err.status = 400;
    throw err;
  }

  const nodeType = categoryToNodeType(check.category);
  const digest = crypto.createHash('md5').update(`${cleanScope}:${check.category}:${check.title}:${check.content}`).digest('hex').slice(0, 16);
  const nodeKey = `mem:${check.category}:${digest}`;
  const conf = Math.min(1, Math.max(0.1, Number(confidence) || 0.9));
  const provenance = {
    source: origin,
    createdBy: actor?.username || actor?.name || 'operator',
    sessionId: sessionId || null,
    verified: sourceRole === 'human_admin',
  };

  const res = await query(
    `INSERT INTO agent_memory_nodes (
      company_id, agent_key, session_id, memory_scope, node_key, node_type, category,
      label, content, searchable_text, properties, provenance, weight, occurrences, confidence, status,
      created_at, last_seen_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11::jsonb, $12::jsonb, 1, 1, $13, 'active',
      NOW(), NOW(), NOW()
    )
    ON CONFLICT (company_id, agent_key, node_key) DO UPDATE SET
      label = EXCLUDED.label,
      content = EXCLUDED.content,
      category = EXCLUDED.category,
      memory_scope = EXCLUDED.memory_scope,
      session_id = COALESCE(EXCLUDED.session_id, agent_memory_nodes.session_id),
      confidence = EXCLUDED.confidence,
      occurrences = agent_memory_nodes.occurrences + 1,
      weight = agent_memory_nodes.weight + 1,
      status = 'active',
      provenance = agent_memory_nodes.provenance || EXCLUDED.provenance,
      last_seen_at = NOW(),
      updated_at = NOW()
    RETURNING *`,
    [
      cleanCompany,
      cleanAgent,
      sessionId || null,
      cleanScope,
      nodeKey,
      nodeType,
      check.category,
      check.title,
      check.content,
      `${check.title} ${check.content} ${check.category}`,
      JSON.stringify({ sessionId: sessionId || null, source: origin }),
      JSON.stringify(provenance),
      conf,
    ]
  );

  return res.rows[0];
}

async function updateMemory({ companyId = 'default', id, title, content, category, memoryScope, status, actor = {} } = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const existing = (await query(`SELECT * FROM agent_memory_nodes WHERE id = $1 AND company_id = $2 LIMIT 1`, [Number(id), cleanCompany])).rows[0];
  if (!existing) return null;

  const nextCategory = category && MEMORY_CATEGORIES.includes(category) ? category : mapNodeToCategory(existing.node_type, existing.category);
  const nextTitle = title !== undefined ? String(title).trim() : existing.label;
  const nextContent = content !== undefined ? String(content).trim() : (existing.content || existing.label);

  const check = sanitizeMemoryCandidate({ category: nextCategory, title: nextTitle, content: nextContent, sourceRole: 'human_admin' });
  if (!check.allowed) {
    const err = new Error(check.reason);
    err.status = 400;
    throw err;
  }

  const nextScope = memoryScope && ['agent', 'session', 'company_shared'].includes(memoryScope) ? memoryScope : (existing.memory_scope || 'agent');
  const nextStatus = status && ['active', 'disabled'].includes(status) ? status : (existing.status || 'active');

  const res = await query(
    `UPDATE agent_memory_nodes
     SET label = $3,
         content = $4,
         category = $5,
         node_type = $6,
         memory_scope = $7,
         status = $8,
         searchable_text = $9,
         provenance = COALESCE(provenance, '{}'::jsonb) || $10::jsonb,
         updated_at = NOW()
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [
      Number(id),
      cleanCompany,
      check.title,
      check.content,
      check.category,
      categoryToNodeType(check.category),
      nextScope,
      nextStatus,
      `${check.title} ${check.content} ${check.category}`,
      JSON.stringify({ lastEditedBy: actor?.username || actor?.name || 'operator', lastEditedAt: new Date().toISOString() }),
    ]
  );
  return res.rows[0] || null;
}

async function deleteMemory({ companyId = 'default', id } = {}) {
  const res = await query(
    `DELETE FROM agent_memory_nodes WHERE id = $1 AND company_id = $2 RETURNING id`,
    [Number(id), String(companyId || 'default').trim()]
  );
  return Boolean(res.rows[0]);
}

async function proposeEvolutionLearning({
  companyId = 'default',
  agentKey = 'camila',
  sessionId = null,
  patternType = 'attendance_improvement',
  title,
  beforeBehavior = 'Resposta genérica sem estratégia padronizada',
  afterBehavior,
  suggestedCta = null,
  evidenceItems = [],
  impactMetrics = {},
  sourceRole = 'evolution_engine',
  minConfirmationsForApproval = 3,
} = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const check = sanitizeMemoryCandidate({
    category: 'attendance_strategies',
    title,
    content: afterBehavior,
    sourceRole,
    isUntrustedCustomer: sourceRole === 'customer',
  });
  if (!check.allowed) {
    return { ok: false, blocked: true, reason: check.reason };
  }

  const existing = (await query(
    `SELECT * FROM ai_learning_suggestions
     WHERE company_id = $1 AND pattern_type = $2 AND LOWER(situation_summary) = LOWER($3)
     ORDER BY id DESC LIMIT 1`,
    [cleanCompany, String(patternType), check.title]
  )).rows[0];

  const distinctConvs = new Set(
    (Array.isArray(existing?.evidence_items) ? existing.evidence_items : [])
      .concat(Array.isArray(evidenceItems) ? evidenceItems : [])
      .map((e) => String(e?.conversationId || e?.id || ''))
      .filter(Boolean)
  );

  const nextFreq = Math.max(Number(existing?.observed_frequency || 0) + 1, distinctConvs.size || 1);
  // Single conversation never skips to pending_approval automatically unless >= threshold
  const stage = existing?.stage === 'applied' || existing?.stage === 'rejected'
    ? existing.stage
    : (nextFreq >= minConfirmationsForApproval ? 'pending_approval' : 'identified');
  const legacyStatus = stage === 'applied' ? 'approved' : (stage === 'rejected' ? 'rejected' : 'pending');

  if (existing) {
    const mergedEvidence = [...(Array.isArray(existing.evidence_items) ? existing.evidence_items : []), ...(evidenceItems || [])].slice(-15);
    const upd = await query(
      `UPDATE ai_learning_suggestions
       SET observed_frequency = $2,
           stage = CASE WHEN stage IN ('applied', 'rejected') THEN stage ELSE $3 END,
           status = CASE WHEN stage IN ('applied', 'rejected') THEN status ELSE $4 END,
           evidence_items = $5::jsonb,
           evidence_data = COALESCE(evidence_data, '{}'::jsonb) || $6::jsonb,
           impact_metrics = COALESCE(impact_metrics, '{}'::jsonb) || $7::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        existing.id,
        nextFreq,
        stage,
        legacyStatus,
        JSON.stringify(mergedEvidence),
        JSON.stringify({ distinctConversations: distinctConvs.size, lastUpdatedAt: new Date().toISOString() }),
        JSON.stringify(impactMetrics || {}),
      ]
    );
    return { ok: true, proposal: upd.rows[0], created: false };
  }

  const ins = await query(
    `INSERT INTO ai_learning_suggestions (
      company_id, agent_key, session_id, pattern_type, situation_summary,
      suggested_strategy, suggested_cta, before_behavior, after_behavior,
      observed_frequency, continuity_impact_pct, evidence_data, evidence_items, impact_metrics,
      status, stage, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16, NOW(), NOW())
    RETURNING *`,
    [
      cleanCompany,
      String(agentKey || 'camila').toLowerCase(),
      sessionId || null,
      String(patternType),
      check.title,
      check.content,
      suggestedCta,
      String(beforeBehavior || ''),
      check.content,
      nextFreq,
      Number(impactMetrics?.continuityLiftPct || 0),
      JSON.stringify({ distinctConversations: distinctConvs.size, provenance: sourceRole }),
      JSON.stringify((evidenceItems || []).slice(0, 15)),
      JSON.stringify(impactMetrics || {}),
      legacyStatus,
      stage,
    ]
  );
  return { ok: true, proposal: ins.rows[0], created: true };
}

async function listEvolutionPipeline({ companyId = 'default', agentKey = null, limit = 60 } = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const safeLimit = Math.min(120, Math.max(1, Number(limit) || 60));

  const params = [cleanCompany];
  let agentFilter = '';
  if (agentKey && agentKey !== 'all') {
    params.push(String(agentKey).trim().toLowerCase());
    agentFilter = `AND (agent_key IS NULL OR LOWER(agent_key) = $2)`;
  }

  const suggestionsRes = await query(
    `SELECT *
     FROM ai_learning_suggestions
     WHERE company_id = $1 ${agentFilter}
     ORDER BY updated_at DESC, id DESC
     LIMIT ${safeLimit}`,
    params
  ).catch(() => ({ rows: [] }));

  const identified = [];
  const pendingApproval = [];
  const applied = [];
  const history = [];

  for (const row of suggestionsRes.rows || []) {
    const stage = row.stage || (row.status === 'approved' ? 'applied' : row.status === 'rejected' ? 'rejected' : 'pending_approval');
    const dto = {
      id: row.id,
      companyId: row.company_id,
      agentKey: row.agent_key,
      patternType: row.pattern_type,
      title: row.situation_summary,
      beforeBehavior: row.before_behavior || 'Comportamento anterior sem regra padronizada',
      afterBehavior: row.after_behavior || row.suggested_strategy,
      suggestedCta: row.suggested_cta,
      observedFrequency: Number(row.observed_frequency || 1),
      continuityImpactPct: Number(row.continuity_impact_pct || 0),
      evidenceItems: Array.isArray(row.evidence_items) ? row.evidence_items : [],
      evidenceData: row.evidence_data || {},
      impactMetrics: row.impact_metrics || {},
      stage,
      status: row.status,
      proposedPlaybookId: row.proposed_playbook_id,
      appliedVersionId: row.applied_version_id,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rolledBackAt: row.rolled_back_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (stage === 'identified') identified.push(dto);
    else if (stage === 'pending_approval' || stage === 'testing') pendingApproval.push(dto);
    else if (stage === 'applied') applied.push(dto);
    else history.push(dto);
  }

  const versions = agentKey && agentKey !== 'all'
    ? await aiAgentService.listAgentVersions(cleanCompany, agentKey, 25).catch(() => [])
    : [];

  return {
    identified,
    pendingApproval,
    applied,
    history,
    versions,
    counts: {
      identified: identified.length,
      pendingApproval: pendingApproval.length,
      applied: applied.length,
      rolledBackOrRejected: history.length,
    },
  };
}

async function approveProposal({ companyId = 'default', proposalId, actor = {} } = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const actorName = String(actor?.username || actor?.name || 'operator');
  const row = (await query(
    `SELECT * FROM ai_learning_suggestions WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [Number(proposalId), cleanCompany]
  )).rows[0];
  if (!row) {
    throw new Error('Proposta de melhoria não encontrada nesta empresa.');
  }

  const slug = `approved_strategy_${row.id}_${String(row.pattern_type || 'evo').replace(/[^a-z0-9_]/gi, '').slice(0, 24)}`;
  const playbookRes = await query(
    `INSERT INTO ai_playbooks (
      company_id, name, slug, trigger_condition, goal, steps, recommended_cta,
      confidence, evidence_count, continuity_boost_pct, status, created_by, approved_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 0.90, $8, $9, 'approved', 'controlled_evolution', $10, NOW(), NOW())
    ON CONFLICT (company_id, slug) DO UPDATE SET
      goal = EXCLUDED.goal,
      steps = EXCLUDED.steps,
      status = 'approved',
      approved_by = EXCLUDED.approved_by,
      updated_at = NOW()
    RETURNING id`,
    [
      cleanCompany,
      String(row.situation_summary || 'Estratégia Aprovada').slice(0, 240),
      slug,
      String(row.pattern_type || 'general').slice(0, 240),
      String(row.after_behavior || row.suggested_strategy || ''),
      JSON.stringify([{ action: 'approved_strategy', text: row.after_behavior || row.suggested_strategy }]),
      row.suggested_cta || null,
      Math.max(1, Number(row.observed_frequency) || 1),
      Number(row.continuity_impact_pct || 0),
      actorName,
    ]
  );
  const playbookId = playbookRes.rows[0]?.id || null;

  let appliedVersionId = null;
  if (row.agent_key) {
    const versions = await aiAgentService.listAgentVersions(cleanCompany, row.agent_key, 1).catch(() => []);
    appliedVersionId = versions[0]?.id || null;
  }

  const upd = await query(
    `UPDATE ai_learning_suggestions
     SET status = 'approved',
         stage = 'applied',
         proposed_playbook_id = COALESCE($3, proposed_playbook_id),
         applied_version_id = COALESCE($4, applied_version_id),
         approved_by = $5,
         approved_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [Number(proposalId), cleanCompany, playbookId, appliedVersionId, actorName]
  );

  await createMemory({
    companyId: cleanCompany,
    agentKey: row.agent_key || 'camila',
    sessionId: row.session_id,
    memoryScope: 'company_shared',
    category: 'attendance_strategies',
    title: row.situation_summary,
    content: row.after_behavior || row.suggested_strategy,
    confidence: 0.95,
    origin: 'approved_evolution',
    sourceRole: 'human_admin',
    actor,
  }).catch(() => {});

  await query(
    `INSERT INTO agent_evolution_log (agent_key, company_id, change_type, source_description, fields_changed, applied_by, created_at)
     VALUES ($1, $2, 'evolution_approved', $3, $4::jsonb, $5, NOW())`,
    [
      row.agent_key || 'camila',
      cleanCompany,
      `Melhoria #${row.id} aprovada e aplicada: ${row.situation_summary}`,
      JSON.stringify({ proposalId: row.id, playbookId, before: row.before_behavior, after: row.after_behavior }),
      actorName,
    ]
  ).catch(() => {});

  return upd.rows[0];
}

async function rejectProposal({ companyId = 'default', proposalId, actor = {} } = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const upd = await query(
    `UPDATE ai_learning_suggestions
     SET status = 'rejected',
         stage = 'rejected',
         approved_by = $3,
         updated_at = NOW()
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [Number(proposalId), cleanCompany, String(actor?.username || actor?.name || 'operator')]
  );
  return upd.rows[0] || null;
}

async function rollbackProposal({ companyId = 'default', proposalId, actor = {} } = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const actorName = String(actor?.username || actor?.name || 'operator');
  const row = (await query(
    `SELECT * FROM ai_learning_suggestions WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [Number(proposalId), cleanCompany]
  )).rows[0];
  if (!row) {
    throw new Error('Melhoria não encontrada nesta empresa.');
  }

  if (row.proposed_playbook_id) {
    await query(
      `UPDATE ai_playbooks SET status = 'archived', updated_at = NOW() WHERE id = $1 AND company_id = $2`,
      [row.proposed_playbook_id, cleanCompany]
    ).catch(() => {});
  }

  await query(
    `UPDATE agent_memory_nodes
     SET status = 'disabled', updated_at = NOW()
     WHERE company_id = $1 AND label = $2 AND provenance->>'source' = 'approved_evolution'`,
    [cleanCompany, row.situation_summary]
  ).catch(() => {});

  if (row.applied_version_id && row.agent_key) {
    await aiAgentService.restoreAgentVersion(cleanCompany, row.agent_key, row.applied_version_id, actor).catch(() => {});
  }

  const upd = await query(
    `UPDATE ai_learning_suggestions
     SET status = 'rejected',
         stage = 'rolled_back',
         rolled_back_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [Number(proposalId), cleanCompany]
  );

  await query(
    `INSERT INTO agent_evolution_log (agent_key, company_id, change_type, source_description, fields_changed, applied_by, created_at)
     VALUES ($1, $2, 'evolution_rollback', $3, $4::jsonb, $5, NOW())`,
    [
      row.agent_key || 'camila',
      cleanCompany,
      `Rollback executado para melhoria #${row.id}: ${row.situation_summary}`,
      JSON.stringify({ proposalId: row.id, restoredVersionId: row.applied_version_id || null }),
      actorName,
    ]
  ).catch(() => {});

  return upd.rows[0];
}

async function getOverview({ companyId = 'default', agentKey = null, sessionId = null, period = '30d', start = null, end = null } = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const range = normalizePeriod(period, start, end);
  const sessFilter = sessionId && sessionId !== 'all' ? String(sessionId).trim() : null;
  const agentFilter = agentKey && agentKey !== 'all' ? String(agentKey).trim().toLowerCase() : null;

  const convRes = await query(
    `SELECT
       COUNT(*)::int AS accumulated_conversations,
       COUNT(*) FILTER (
         WHERE ($3::timestamptz IS NULL OR COALESCE(last_message_at, updated_at, created_at) >= $3::timestamptz)
           AND ($4::timestamptz IS NULL OR COALESCE(last_message_at, updated_at, created_at) <= $4::timestamptz)
       )::int AS period_conversations,
       MAX(COALESCE(last_message_at, updated_at, created_at)) AS last_conversation_at
     FROM conversations
     WHERE company_id = $1
       AND ($2::text IS NULL OR session_id = $2)`,
    [cleanCompany, sessFilter, range.startIso, range.endIso]
  ).catch(() => ({ rows: [{}] }));

  const memRes = await query(
    `SELECT
       COUNT(*) FILTER (WHERE COALESCE(status, 'active') = 'active')::int AS active_memories,
       COUNT(*) FILTER (WHERE COALESCE(status, 'active') = 'active' AND ($3::timestamptz IS NULL OR last_seen_at >= $3::timestamptz))::int AS period_memories,
       COUNT(*) FILTER (WHERE COALESCE(status, 'active') = 'active' AND (category = 'objections' OR node_type = 'objection'))::int AS objections_identified,
       MAX(COALESCE(updated_at, last_seen_at)) AS last_memory_at
     FROM agent_memory_nodes
     WHERE company_id = $1
       AND node_type NOT IN ('conversation', 'contact')
       AND ($2::text IS NULL OR LOWER(agent_key) = $2 OR memory_scope = 'company_shared')`,
    [cleanCompany, agentFilter, range.startIso]
  ).catch(() => ({ rows: [{}] }));

  const evoRes = await query(
    `SELECT
       COUNT(*) FILTER (WHERE stage IN ('identified', 'pending_approval', 'testing') OR (stage IS NULL AND status = 'pending'))::int AS pending_count,
       COUNT(*) FILTER (WHERE stage = 'identified')::int AS identified_count,
       COUNT(*) FILTER (WHERE stage = 'pending_approval')::int AS awaiting_approval_count,
       COUNT(*) FILTER (WHERE stage = 'applied' OR status = 'approved')::int AS applied_count,
       MAX(updated_at) AS last_proposal_at
     FROM ai_learning_suggestions
     WHERE company_id = $1`,
    [cleanCompany]
  ).catch(() => ({ rows: [{}] }));

  const playbookRes = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'approved')::int AS active_strategies
     FROM ai_playbooks
     WHERE company_id = $1`,
    [cleanCompany]
  ).catch(() => ({ rows: [{}] }));

  const expRes = await query(
    `SELECT
       COUNT(*) FILTER (WHERE ($2::timestamptz IS NULL OR created_at >= $2::timestamptz))::int AS period_experiences,
       COUNT(*) FILTER (WHERE customer_replied = TRUE AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz))::int AS continued_turns,
       MAX(created_at) AS last_experience_at
     FROM ai_experience_events
     WHERE company_id = $1`,
    [cleanCompany, range.startIso]
  ).catch(() => ({ rows: [{}] }));

  const conv = convRes.rows[0] || {};
  const mem = memRes.rows[0] || {};
  const evo = evoRes.rows[0] || {};
  const pb = playbookRes.rows[0] || {};
  const exp = expRes.rows[0] || {};

  const lastUpdateCandidates = [conv.last_conversation_at, mem.last_memory_at, evo.last_proposal_at, exp.last_experience_at]
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t));

  return {
    period: range,
    agentKey: agentFilter || 'all',
    sessionId: sessFilter || 'all',
    dataOrigin: {
      companyId: cleanCompany,
      source: 'PostgreSQL tempo real (conversations, agent_memory_nodes, ai_learning_suggestions, ai_playbooks, ai_experience_events)',
      lastUpdatedAt: lastUpdateCandidates.length > 0 ? new Date(Math.max(...lastUpdateCandidates)).toISOString() : null,
    },
    accumulated: {
      conversationsTotal: Number(conv.accumulated_conversations || 0),
      activeMemories: Number(mem.active_memories || 0),
      objectionsIdentified: Number(mem.objections_identified || 0),
      strategiesActive: Number(pb.active_strategies || 0),
    },
    periodMetrics: {
      conversationsAnalyzed: Number(conv.period_conversations || 0),
      recentLearnings: Number(mem.period_memories || 0) + Number(evo.identified_count || 0),
      aiTurnsExecuted: Number(exp.period_experiences || 0),
      customerContinuedTurns: Number(exp.continued_turns || 0),
    },
    pending: {
      identifiedLearnings: Number(evo.identified_count || 0),
      awaitingApproval: Number(evo.awaiting_approval_count || 0),
      totalPendingAnalysis: Number(evo.pending_count || 0),
    },
    applied: {
      provenImprovements: Number(evo.applied_count || 0),
      activePlaybooks: Number(pb.active_strategies || 0),
    },
  };
}

async function getResultsAndConversations({
  companyId = 'default',
  agentKey = null,
  sessionId = null,
  period = '30d',
  start = null,
  end = null,
  search = '',
  limit = 40,
} = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const range = normalizePeriod(period, start, end);
  const sessFilter = sessionId && sessionId !== 'all' ? String(sessionId).trim() : null;
  const agentFilter = agentKey && agentKey !== 'all' ? String(agentKey).trim().toLowerCase() : null;
  const searchPattern = String(search || '').trim() ? `%${String(search).trim()}%` : null;

  const summaryRes = await query(
    `SELECT
       COUNT(*)::int AS analyzed_conversations,
       COUNT(*) FILTER (WHERE lead_temperature IN ('warm', 'hot') OR funnel_stage IN ('interested', 'price_sent', 'negotiation', 'ready_to_buy', 'closed', 'won'))::int AS qualified_conversations,
       COUNT(*) FILTER (WHERE lead_intent = 'objection' OR 'desconto' = ANY(tags) OR 'objecao' = ANY(tags))::int AS objections_count,
       COUNT(*) FILTER (WHERE funnel_stage IN ('closed', 'won', 'ready_to_buy', 'aguarda_pix', 'fechamento'))::int AS conversion_stage_count
     FROM conversations
     WHERE company_id = $1
       AND ($2::text IS NULL OR session_id = $2)
       AND ($3::timestamptz IS NULL OR COALESCE(last_message_at, updated_at, created_at) >= $3::timestamptz)
       AND ($4::timestamptz IS NULL OR COALESCE(last_message_at, updated_at, created_at) <= $4::timestamptz)`,
    [cleanCompany, sessFilter, range.startIso, range.endIso]
  ).catch(() => ({ rows: [{}] }));

  const salesRes = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM customer_orders WHERE company_id = $1 AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)) AS orders_count,
       (SELECT COALESCE(SUM(total_amount), 0)::numeric(12,2) FROM customer_orders WHERE company_id = $1 AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)) AS orders_total,
       (SELECT COUNT(*)::int FROM conversation_sheets WHERE company_id = $1 AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)) AS sheets_count,
       (SELECT COUNT(*)::int FROM quotes WHERE company_id = $1 AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)) AS quotes_count`,
    [cleanCompany, range.startIso]
  ).catch(() => ({ rows: [{}] }));

  const latencyRes = await query(
    `SELECT
       COUNT(*) FILTER (WHERE customer_replied = TRUE)::int AS replied_turns,
       COUNT(*)::int AS total_turns,
       AVG(customer_replied_seconds) FILTER (WHERE customer_replied_seconds IS NOT NULL AND customer_replied_seconds < 86400)::numeric(10,1) AS avg_reply_sec
     FROM ai_experience_events
     WHERE company_id = $1
       AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)`,
    [cleanCompany, range.startIso]
  ).catch(() => ({ rows: [{}] }));

  const aiLogLatency = await query(
    `SELECT AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL)::int AS avg_ai_latency_ms
     FROM ai_logs
     WHERE company_id = $1
       AND ($2::timestamptz IS NULL OR timestamp >= $2::timestamptz)`,
    [cleanCompany, range.startIso]
  ).catch(() => ({ rows: [{}] }));

  const algoRes = await query(
    `SELECT
       COALESCE(algorithm_code, 'ALGO-PADRAO') AS algorithm_code,
       COALESCE(algorithm_name, 'Atendimento Padrão') AS algorithm_name,
       COUNT(*)::int AS conversations,
       AVG(total_xp)::numeric(10,1) AS avg_xp,
       COUNT(*) FILTER (WHERE conversion_xp > 0 OR has_order_sheet = TRUE)::int AS conversions
     FROM conversation_evolution_scores
     WHERE company_id = $1
       AND ($2::text IS NULL OR LOWER(agent_key) = $2)
       AND ($3::timestamptz IS NULL OR updated_at >= $3::timestamptz)
     GROUP BY algorithm_code, algorithm_name
     ORDER BY conversations DESC`,
    [cleanCompany, agentFilter, range.startIso]
  ).catch(() => ({ rows: [] }));

  const listRes = await query(
    `SELECT
       c.id, c.session_id, COALESCE(l.name, c.remote_jid, 'Contato') AS contact_name,
       COALESCE(l.phone, c.remote_jid) AS contact_phone,
       c.agent_name, c.funnel_stage, c.lead_temperature, c.lead_intent, c.ai_enabled,
       COALESCE(c.last_message_at, c.updated_at, c.created_at) AS last_activity_at,
       s.algorithm_code, s.algorithm_name, s.total_xp, s.has_order_sheet,
       (SELECT a.model FROM ai_logs a WHERE a.conversation_id = c.id::text ORDER BY a.timestamp DESC LIMIT 1) AS last_model,
       (SELECT a.provider FROM ai_logs a WHERE a.conversation_id = c.id::text ORDER BY a.timestamp DESC LIMIT 1) AS last_provider,
       (SELECT e.strategy_applied FROM ai_experience_events e WHERE e.company_id = c.company_id AND e.conversation_id = c.id::text ORDER BY e.created_at DESC LIMIT 1) AS last_strategy
     FROM conversations c
     LEFT JOIN leads l ON l.id = c.lead_id AND l.company_id = c.company_id
     LEFT JOIN conversation_evolution_scores s ON s.company_id = c.company_id AND s.conversation_id = c.id
     WHERE c.company_id = $1
       AND ($2::text IS NULL OR c.session_id = $2)
       AND ($3::timestamptz IS NULL OR COALESCE(c.last_message_at, c.updated_at, c.created_at) >= $3::timestamptz)
       AND ($4::text IS NULL OR COALESCE(l.name, '') ILIKE $4 OR COALESCE(l.phone, c.remote_jid, '') ILIKE $4)
     ORDER BY COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC
     LIMIT $5`,
    [cleanCompany, sessFilter, range.startIso, searchPattern, Math.min(100, Math.max(1, Number(limit) || 40))]
  ).catch(() => ({ rows: [] }));

  const sum = summaryRes.rows[0] || {};
  const sales = salesRes.rows[0] || {};
  const lat = latencyRes.rows[0] || {};
  const totalTurns = Number(lat.total_turns || 0);
  const repliedTurns = Number(lat.replied_turns || 0);

  return {
    period: range,
    metrics: {
      conversationsAnalyzed: Number(sum.analyzed_conversations || 0),
      qualifiedConversations: Number(sum.qualified_conversations || 0),
      objectionsCount: Number(sum.objections_count || 0),
      conversionsCount: Math.max(Number(sales.orders_count || 0), Number(sum.conversion_stage_count || 0)),
      salesCount: Number(sales.orders_count || 0),
      sheetsCount: Number(sales.sheets_count || 0),
      quotesCount: Number(sales.quotes_count || 0),
      salesRevenue: Number(sales.orders_total || 0),
      continuityRatePct: totalTurns > 0 ? Number(((repliedTurns / totalTurns) * 100).toFixed(1)) : null,
      avgAiLatencyMs: aiLogLatency.rows[0]?.avg_ai_latency_ms != null ? Number(aiLogLatency.rows[0].avg_ai_latency_ms) : null,
      avgCustomerReplySec: lat.avg_reply_sec != null ? Number(lat.avg_reply_sec) : null,
    },
    byAlgorithm: (algoRes.rows || []).map((r) => ({
      code: r.algorithm_code,
      name: r.algorithm_name,
      conversations: Number(r.conversations || 0),
      avgXp: Number(r.avg_xp || 0),
      conversions: Number(r.conversions || 0),
    })),
    conversations: listRes.rows || [],
  };
}

async function explainConversation({ companyId = 'default', conversationId } = {}) {
  const cleanCompany = String(companyId || 'default').trim();
  const convRes = await query(
    `SELECT c.*, COALESCE(l.name, c.remote_jid) AS display_name, COALESCE(l.phone, c.remote_jid) AS display_phone
     FROM conversations c
     LEFT JOIN leads l ON l.id = c.lead_id AND l.company_id = c.company_id
     WHERE c.company_id = $1 AND c.id = $2
     LIMIT 1`,
    [cleanCompany, Number(conversationId)]
  );
  const conversation = convRes.rows[0];
  if (!conversation) return null;

  const [logsRes, expRes, scoreRes, sheetsRes, ordersRes, quotesRes] = await Promise.all([
    query(
      `SELECT id, provider, model, prompt_tokens, completion_tokens, total_tokens, routing_mode, credential_scope, latency_ms, estimated_cost_usd, effective_config, message_sent, message_received, timestamp
       FROM ai_logs WHERE conversation_id = $1 AND (company_id = $2 OR company_id IS NULL) ORDER BY timestamp DESC LIMIT 10`,
      [String(conversation.id), cleanCompany]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT id, customer_utterance, intent_detected, strategy_applied, playbook_id, ai_reply, customer_replied, customer_replied_seconds, human_intervened, funnel_outcome, metadata, created_at
       FROM ai_experience_events WHERE company_id = $1 AND conversation_id = $2 ORDER BY created_at DESC LIMIT 10`,
      [cleanCompany, String(conversation.id)]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT * FROM conversation_evolution_scores WHERE company_id = $1 AND conversation_id = $2 LIMIT 1`,
      [cleanCompany, Number(conversationId)]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT id, total_price, payment_method, status, created_at FROM conversation_sheets WHERE company_id = $1 AND conversation_id = $2 ORDER BY created_at DESC LIMIT 5`,
      [cleanCompany, Number(conversationId)]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT id, order_id, order_title, total_amount, status, created_at FROM customer_orders WHERE company_id = $1 AND conversation_id = $2 ORDER BY created_at DESC LIMIT 5`,
      [cleanCompany, Number(conversationId)]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT id, quote_number, total_amount, status, created_at FROM quotes WHERE company_id = $1 AND conversation_id = $2 ORDER BY created_at DESC LIMIT 5`,
      [cleanCompany, Number(conversationId)]
    ).catch(() => ({ rows: [] })),
  ]);

  const recalledKeys = new Set();
  for (const e of expRes.rows || []) {
    const arr = Array.isArray(e.metadata?.recalledMemoryIds) ? e.metadata.recalledMemoryIds : [];
    for (const k of arr) recalledKeys.add(String(k));
  }

  let retrievedMemories = [];
  if (recalledKeys.size > 0) {
    const keys = [...recalledKeys];
    const memRes = await query(
      `SELECT id, category, label, content, memory_scope, confidence FROM agent_memory_nodes
       WHERE company_id = $1 AND (node_key = ANY($2::text[]) OR label = ANY($2::text[])) LIMIT 20`,
      [cleanCompany, keys]
    ).catch(() => ({ rows: [] }));
    retrievedMemories = memRes.rows || [];
  }

  const agents = await aiAgentService.listAgents(cleanCompany).catch(() => []);
  const matchedAgent = agents.find((a) => a.name === conversation.agent_name || a.sessionIds?.includes(conversation.session_id)) || null;
  const lastLog = logsRes.rows[0] || null;
  const lastExp = expRes.rows[0] || null;

  return {
    conversation: {
      id: conversation.id,
      sessionId: conversation.session_id,
      name: conversation.display_name,
      phone: conversation.display_phone,
      funnelStage: conversation.funnel_stage,
      leadTemperature: conversation.lead_temperature,
      leadIntent: conversation.lead_intent,
      agentName: conversation.agent_name,
      aiEnabled: conversation.ai_enabled,
    },
    configurationUsed: lastLog?.effective_config && Object.keys(lastLog.effective_config).length > 0
      ? lastLog.effective_config
      : (lastExp?.metadata?.effectiveConfig || (matchedAgent ? {
          personalityPreset: matchedAgent.personalityPreset,
          objective: matchedAgent.objective,
          tone: matchedAgent.tone,
          responseStyle: matchedAgent.responseStyle,
          temperature: matchedAgent.temperature,
          providerId: matchedAgent.providerId,
          modelId: matchedAgent.modelId,
          routingMode: matchedAgent.routingMode,
        } : null)),
    modelUsed: lastLog
      ? { provider: lastLog.provider, model: lastLog.model, routingMode: lastLog.routing_mode, credentialScope: lastLog.credential_scope, latencyMs: lastLog.latency_ms, tokens: lastLog.total_tokens }
      : (lastExp?.metadata ? { provider: lastExp.metadata.provider, model: lastExp.metadata.model, routingMode: lastExp.metadata.routingMode, tokens: lastExp.metadata.tokens } : null),
    retrievedMemories,
    appliedStrategy: lastExp?.strategy_applied || scoreRes.rows[0]?.algorithm_code || null,
    outcome: {
      funnelStage: conversation.funnel_stage,
      score: scoreRes.rows[0] || null,
      sheets: sheetsRes.rows || [],
      orders: ordersRes.rows || [],
      quotes: quotesRes.rows || [],
    },
    turns: expRes.rows || [],
    aiLogs: logsRes.rows || [],
  };
}

module.exports = {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_LABELS,
  sanitizeMemoryCandidate,
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  proposeEvolutionLearning,
  listEvolutionPipeline,
  approveProposal,
  rejectProposal,
  rollbackProposal,
  getOverview,
  getResultsAndConversations,
  explainConversation,
};
