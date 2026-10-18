'use strict';

/**
 * Conversation Evolution Service — Real Score (XP) per Conversation & Per-Customer Algorithm
 *
 * Requirements:
 * 1. Calculate REAL evolutionary score (XP) based on actual conversation interaction milestones:
 *    - Coleta de Dados Cadastrais: +15 a +25 XP (nome, bairro/endereço, telefone confirmados)
 *    - Especificação de Produto: +20 XP (identificação precisa de capacidade/modelo, ex: caixa d'água 5.000L)
 *    - Geração de Ficha / Orçamento: +40 XP (orçamento gerado no catálogo com cálculo de frete/pagamento)
 *    - Conversão / Avanço de Funil: +50 XP (avanço para negociação, aguarda_pix ou fechamento)
 *    - Qualidade de Atendimento: +15 XP (zero repetições e zero delírios/alucinações na conversa)
 * 2. Total calculated transparently per real conversation and persisted in PostgreSQL
 *    (`conversation_evolution_scores`, `agent_metrics`, `agent_evolution_log`, `ai_experience_events`).
 * 3. Link each conversation's per-customer algorithm (`ALGO-01` to `ALGO-05`) with persistent memory
 *    and anti-delirium catalog grounding.
 */

const { query } = require('../src/infrastructure/config/database');
const { buildLeadAlgorithm, STORE_EVOLUTION_ALGORITHMS, formatHumanClientName } = require('./leadAnalyzer');
const { normalizeCapacity } = require('./conversationMemoryEngine');
const agentLearningRepo = require('../src/data/repositories/agentLearningRepository');

const XP_MILESTONES = {
  CADASTRAL_DATA: { min: 15, max: 25 },
  PRODUCT_SPECIFICATION: 20,
  ORDER_SHEET_QUOTE: 40,
  FUNNEL_CONVERSION: 50,
  ATTENDANCE_QUALITY: 15,
};

let tablesEnsured = false;

/**
 * Ensure database tables exist with graceful fallback
 */
async function ensureTables() {
  if (tablesEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS conversation_evolution_scores (
        id SERIAL PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'default',
        conversation_id INTEGER NOT NULL,
        agent_key VARCHAR(100) DEFAULT 'camila',
        lead_id INTEGER,
        contact_name VARCHAR(255),
        contact_phone VARCHAR(50),
        algorithm_code VARCHAR(50) DEFAULT 'ALGO-01',
        algorithm_name VARCHAR(255) DEFAULT 'Fechamento Rápido',
        conversation_style VARCHAR(100) DEFAULT 'direct_objective',
        cadastral_xp INTEGER NOT NULL DEFAULT 0,
        product_xp INTEGER NOT NULL DEFAULT 0,
        sheet_xp INTEGER NOT NULL DEFAULT 0,
        conversion_xp INTEGER NOT NULL DEFAULT 0,
        quality_xp INTEGER NOT NULL DEFAULT 0,
        total_xp INTEGER NOT NULL DEFAULT 0,
        milestones JSONB NOT NULL DEFAULT '{}'::jsonb,
        breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
        evaluation_summary TEXT,
        funnel_stage VARCHAR(100),
        has_order_sheet BOOLEAN DEFAULT FALSE,
        evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_conv_evo_score UNIQUE (company_id, conversation_id)
      );

      CREATE INDEX IF NOT EXISTS idx_conv_evo_company
        ON conversation_evolution_scores(company_id, total_xp DESC);

      CREATE INDEX IF NOT EXISTS idx_conv_evo_algo
        ON conversation_evolution_scores(company_id, algorithm_code);

      CREATE TABLE IF NOT EXISTS agent_metrics (
        id SERIAL PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'default',
        agent_key VARCHAR(100) NOT NULL DEFAULT 'camila',
        metric_type VARCHAR(100) NOT NULL,
        metric_value NUMERIC(12,2) DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_agent_metrics_key UNIQUE (company_id, agent_key, metric_type)
      );
    `);
    tablesEnsured = true;
  } catch (err) {
    // Non-blocking in case of constrained privileges
    console.warn('[ConversationEvolution] ensureTables warning:', err.message);
  }
}

/**
 * Pure evaluation function for a conversation and its messages
 */
function evaluateConversationMilestones(conversation = {}, messages = [], options = {}) {
  const convTags = Array.isArray(conversation.tags) ? conversation.tags : [];
  const funnelStage = String(conversation.funnel_stage || conversation.funnelStage || '').toLowerCase();
  const rawName = String(conversation.name || conversation.lead_name || '').trim();
  const rawPhone = String(conversation.phone || conversation.remote_jid || '').trim();
  const allTexts = messages.map(m => String(m.text || m.content || '')).join(' ');
  const lowerTexts = allTexts.toLowerCase();

  // 1. MILESTONE: Coleta de Dados Cadastrais (+15 a +25 XP)
  // - Nome confirmado (+10 XP)
  // - Bairro / Endereço / CEP confirmado (+10 XP)
  // - Telefone confirmado (+5 XP)
  let cadastralDetails = [];
  let nameConfirmed = false;
  let addressConfirmed = false;
  let phoneConfirmed = false;

  const validName = formatHumanClientName(rawName);
  if (validName) {
    nameConfirmed = true;
    cadastralDetails.push(`Nome confirmado: ${validName}`);
  } else {
    const nameMatch = lowerTexts.match(/(?:meu nome [eé]|sou [oa]|chamo|aqui [eé] [oa])\s+([a-zA-ZÀ-ÿ]{2,25})/i);
    if (nameMatch && nameMatch[1]) {
      const candidate = formatHumanClientName(nameMatch[1]);
      if (candidate) {
        nameConfirmed = true;
        cadastralDetails.push(`Nome informado na conversa: ${candidate}`);
      }
    }
  }

  // Check Address / Neighborhood / CEP
  const cepMatch = allTexts.match(/\b\d{5}-?\d{3}\b/);
  const bairroMatch = lowerTexts.match(/(?:bairro|no bairro|moro no|sou do|entrega no|rua|av\.|avenida)\s+([a-zA-ZÀ-ÿ0-9\s]{3,35})/i);
  if (cepMatch) {
    addressConfirmed = true;
    cadastralDetails.push(`CEP detectado: ${cepMatch[0]}`);
  } else if (bairroMatch && bairroMatch[1]) {
    const b = bairroMatch[1].replace(/[?.,!].*$/, '').trim();
    if (b.length > 2 && !b.includes('quanto') && !b.includes('qual') && !b.includes('obrigad')) {
      addressConfirmed = true;
      cadastralDetails.push(`Bairro/Endereço: ${b}`);
    }
  } else if (conversation.delivery_neighborhood || conversation.delivery_address) {
    addressConfirmed = true;
    cadastralDetails.push(`Endereço registrado na ficha`);
  }

  // Check Phone
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length >= 10 && !digits.startsWith('000')) {
    phoneConfirmed = true;
    cadastralDetails.push(`Telefone/WhatsApp verificado: ${digits.slice(-4).padStart(digits.length, '*')}`);
  }

  let cadastralXp = 0;
  if (nameConfirmed && addressConfirmed && phoneConfirmed) {
    cadastralXp = 25; // All 3 complete (+25 XP)
  } else if (nameConfirmed && addressConfirmed) {
    cadastralXp = 20; // Name + Address (+20 XP)
  } else if ((nameConfirmed && phoneConfirmed) || (addressConfirmed && phoneConfirmed)) {
    cadastralXp = 15; // At least 2 verified (+15 XP)
  } else if (nameConfirmed || addressConfirmed) {
    cadastralXp = 10;
  }

  // 2. MILESTONE: Especificação de Produto (+20 XP)
  // Identificação precisa de capacidade/modelo (ex: caixa d'água 5.000L, churrasqueira trio, etc.)
  let productXp = 0;
  let productDetails = [];
  const detectedCap = normalizeCapacity(allTexts);
  let hasSpecificProduct = false;

  if (detectedCap) {
    productXp = 20;
    hasSpecificProduct = true;
    productDetails.push(`Capacidade canônica especificada: ${detectedCap}`);
  } else if (
    lowerTexts.includes('churrasqueira') ||
    lowerTexts.includes('trio') ||
    lowerTexts.includes('cimento') ||
    lowerTexts.includes('tijolo') ||
    lowerTexts.includes('milheiro') ||
    lowerTexts.includes('bloco') ||
    lowerTexts.includes('telha')
  ) {
    productXp = 20;
    hasSpecificProduct = true;
    if (lowerTexts.includes('churrasqueira')) productDetails.push('Churrasqueira Pré-Moldada');
    else if (lowerTexts.includes('cimento')) productDetails.push('Cimento CP II 50kg');
    else if (lowerTexts.includes('tijolo')) productDetails.push('Tijolo Cerâmico');
    else productDetails.push('Material de Construção especificado');
  }

  // 3. MILESTONE: Geração de Ficha / Orçamento (+40 XP)
  // Orçamento gerado no catálogo com cálculo de frete/pagamento
  let sheetXp = 0;
  let sheetDetails = [];
  const hasSheetFlag = Boolean(
    options.hasOrderSheet ||
    convTags.includes('ficha_gerada') ||
    convTags.includes('orcamento_gerado') ||
    conversation.has_order_sheet ||
    conversation.sheet_id ||
    /ficha de pedido|orçamento oficial|pedido nº|total do pedido|resumo do pedido/i.test(allTexts)
  );

  if (hasSheetFlag) {
    sheetXp = 40;
    sheetDetails.push('Ficha de pedido / orçamento comercial gerado no catálogo');
  }

  // 4. MILESTONE: Conversão / Avanço de Funil (+50 XP)
  // Avanço para negociação, aguarda_pix ou fechamento
  let conversionXp = 0;
  let conversionDetails = [];
  const isConvertedOrAdvanced = Boolean(
    ['negotiation', 'fechamento', 'aguarda_pix', 'aguardando_pix', 'closed', 'won', 'payment_confirmed', 'ready_to_buy'].includes(funnelStage) ||
    convTags.includes('aguarda_pix') ||
    convTags.includes('atendimento_finalizado') ||
    convTags.includes('pedido_confirmado') ||
    convTags.includes('comprou') ||
    convTags.includes('fechado') ||
    conversation.status === 'aguarda_pix' ||
    /(?:chave pix|manda o pix|comprovante|pedido fechado|confirmado o agendamento|pode agendar)/i.test(allTexts)
  );

  if (isConvertedOrAdvanced) {
    conversionXp = 50;
    conversionDetails.push(`Avanço de funil confirmado (Estágio: ${funnelStage || 'fechamento'})`);
  }

  // 5. MILESTONE: Qualidade de Atendimento (+15 XP)
  // Zero repetições e zero delírios/alucinações na conversa
  let qualityXp = 0;
  let qualityDetails = [];
  const botMessages = messages.filter(m => m.from_me === true || m.fromMe === true);
  let hasRepetition = false;
  let hasHallucination = false;

  // Check consecutive identical or nearly identical bot messages
  for (let i = 1; i < botMessages.length; i++) {
    const prev = String(botMessages[i - 1].text || botMessages[i - 1].content || '').trim().toLowerCase();
    const curr = String(botMessages[i].text || botMessages[i].content || '').trim().toLowerCase();
    if (prev.length > 15 && curr.length > 15 && prev === curr) {
      hasRepetition = true;
      break;
    }
  }

  // Check anti-delirium / hallucination signals
  if (
    /R\$\s*9999|R\$\s*99\.999|desconto de 70%|desconto de 80%|brinde um carro|nossa loja em marte/i.test(allTexts) ||
    /sou um modelo de linguagem|como inteligência artificial não posso/i.test(allTexts)
  ) {
    hasHallucination = true;
  }

  if (!hasRepetition && !hasHallucination && botMessages.length > 0) {
    qualityXp = 15;
    qualityDetails.push('Zero repetições em loop e zero delírios/alucinações detectados');
  } else if (hasRepetition) {
    qualityDetails.push('Penalidade de qualidade: repetição de mensagens detectada');
  } else if (hasHallucination) {
    qualityDetails.push('Penalidade de qualidade: inconsistência com o catálogo detectada');
  } else {
    // If no bot messages yet, neutral pass
    qualityXp = 15;
    qualityDetails.push('Conformidade padrão mantida');
  }

  const totalXp = cadastralXp + productXp + sheetXp + conversionXp + qualityXp;

  // 6. PER-CUSTOMER CONVERSATION ALGORITHM
  const lastClientMsg = messages.slice().reverse().find(m => !m.from_me && !m.fromMe);
  const clientText = String(lastClientMsg?.text || lastClientMsg?.content || conversation.last_message || '');
  const leadAlgorithm = buildLeadAlgorithm(clientText, messages, conversation);

  return {
    conversationId: conversation.id,
    contactName: validName || rawName || 'Cliente',
    contactPhone: rawPhone,
    algorithm: {
      id: leadAlgorithm.algorithmId,
      code: leadAlgorithm.algorithmCode,
      name: leadAlgorithm.algorithmName,
      style: leadAlgorithm.conversationStyle,
      styleLabel: leadAlgorithm.styleLabel,
      storeStandardRule: leadAlgorithm.storeStandardRule,
      directive: leadAlgorithm.directive,
    },
    totalXp,
    milestones: {
      cadastral: {
        xp: cadastralXp,
        max: 25,
        achieved: cadastralXp >= 15,
        details: cadastralDetails.join(' | ') || 'Aguardando dados cadastrais',
        nameConfirmed,
        addressConfirmed,
        phoneConfirmed,
      },
      product: {
        xp: productXp,
        max: 20,
        achieved: productXp > 0,
        details: productDetails.join(' | ') || 'Aguardando especificação precisa',
      },
      sheet: {
        xp: sheetXp,
        max: 40,
        achieved: sheetXp > 0,
        details: sheetDetails.join(' | ') || 'Ficha de pedido ainda não emitida',
      },
      conversion: {
        xp: conversionXp,
        max: 50,
        achieved: conversionXp > 0,
        details: conversionDetails.join(' | ') || 'Em atendimento inicial',
      },
      quality: {
        xp: qualityXp,
        max: 15,
        achieved: qualityXp > 0,
        details: qualityDetails.join(' | ') || 'Conformidade de qualidade avaliada',
        zeroRepetitions: !hasRepetition,
        zeroDelirium: !hasHallucination,
      },
    },
    breakdown: {
      cadastralXp,
      productXp,
      sheetXp,
      conversionXp,
      qualityXp,
    },
    funnelStage: funnelStage || 'new_lead',
    hasOrderSheet: hasSheetFlag,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Score a single conversation by ID and persist the result into PostgreSQL
 */
async function scoreConversationAndPersist(conversationId, companyId = 'default', options = {}) {
  await ensureTables();
  const cleanCompany = String(companyId || 'default').trim();
  const numId = Number(conversationId);
  if (!numId || isNaN(numId)) return null;

  try {
    // 1. Fetch conversation
    const convRes = await query(
      `SELECT c.id, c.company_id, c.session_id, c.lead_id, c.status, c.funnel_stage,
              c.lead_temperature, c.tags, c.summary, c.last_message, c.agent_name,
              c.created_at, c.updated_at,
              COALESCE(l.name, c.name, 'Cliente') as name,
              COALESCE(l.phone, c.remote_jid, c.phone, '') as phone
       FROM conversations c
       LEFT JOIN leads l ON c.lead_id = l.id
       WHERE c.id = $1 AND c.company_id = $2
       LIMIT 1`,
      [numId, cleanCompany]
    );

    if (convRes.rows.length === 0) return null;
    const conv = convRes.rows[0];

    // 2. Fetch messages
    const msgRes = await query(
      `SELECT id, conversation_id, text, content, from_me, sender, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 50`,
      [numId]
    );
    const messages = msgRes.rows;

    // 3. Check conversation_sheets
    let hasOrderSheet = false;
    try {
      const sheetRes = await query(
        `SELECT id, total_price, status FROM conversation_sheets
         WHERE conversation_id = $1 AND company_id = $2
         LIMIT 1`,
        [numId, cleanCompany]
      );
      if (sheetRes.rows.length > 0) {
        hasOrderSheet = true;
      }
    } catch (_) {}

    // 4. Run milestone evaluation
    const evaluation = evaluateConversationMilestones(conv, messages, { ...options, hasOrderSheet });
    const agentKey = conv.agent_name || options.agentKey || 'camila';

    // 5. Persist into conversation_evolution_scores
    await query(
      `INSERT INTO conversation_evolution_scores (
        company_id, conversation_id, agent_key, lead_id, contact_name, contact_phone,
        algorithm_code, algorithm_name, conversation_style,
        cadastral_xp, product_xp, sheet_xp, conversion_xp, quality_xp, total_xp,
        milestones, breakdown, evaluation_summary, funnel_stage, has_order_sheet,
        evaluated_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18, $19, $20, NOW(), NOW())
      ON CONFLICT (company_id, conversation_id) DO UPDATE SET
        contact_name = EXCLUDED.contact_name,
        contact_phone = EXCLUDED.contact_phone,
        algorithm_code = EXCLUDED.algorithm_code,
        algorithm_name = EXCLUDED.algorithm_name,
        conversation_style = EXCLUDED.conversation_style,
        cadastral_xp = EXCLUDED.cadastral_xp,
        product_xp = EXCLUDED.product_xp,
        sheet_xp = EXCLUDED.sheet_xp,
        conversion_xp = EXCLUDED.conversion_xp,
        quality_xp = EXCLUDED.quality_xp,
        total_xp = EXCLUDED.total_xp,
        milestones = EXCLUDED.milestones,
        breakdown = EXCLUDED.breakdown,
        evaluation_summary = EXCLUDED.evaluation_summary,
        funnel_stage = EXCLUDED.funnel_stage,
        has_order_sheet = EXCLUDED.has_order_sheet,
        evaluated_at = NOW(),
        updated_at = NOW()`,
      [
        cleanCompany,
        numId,
        agentKey,
        conv.lead_id || null,
        evaluation.contactName,
        evaluation.contactPhone,
        evaluation.algorithm.code,
        evaluation.algorithm.name,
        evaluation.algorithm.style,
        evaluation.breakdown.cadastralXp,
        evaluation.breakdown.productXp,
        evaluation.breakdown.sheetXp,
        evaluation.breakdown.conversionXp,
        evaluation.breakdown.qualityXp,
        evaluation.totalXp,
        JSON.stringify(evaluation.milestones),
        JSON.stringify(evaluation.breakdown),
        `Conversa #${numId} com ${evaluation.contactName}: +${evaluation.totalXp} XP (${evaluation.algorithm.code})`,
        evaluation.funnelStage,
        evaluation.hasOrderSheet,
      ]
    );

    // 6. Record in agent_evolution_log for transparency
    if (evaluation.totalXp >= 15) {
      try {
        await agentLearningRepo.createEvolutionLog({
          agentKey,
          changeType: 'conversation_score',
          sourceDescription: `Conversa #${numId} pontuada (+${evaluation.totalXp} XP) via ${evaluation.algorithm.code}`,
          fieldsChanged: {
            conversationId: numId,
            totalXp: evaluation.totalXp,
            algorithm: evaluation.algorithm.code,
            milestones: evaluation.breakdown,
          },
          companyId: cleanCompany,
        });
      } catch (_) {}
    }

    // 7. Update aggregated agent_metrics in PostgreSQL
    await updateAggregatedMetrics(cleanCompany, agentKey);

    return evaluation;
  } catch (err) {
    console.error(`[ConversationEvolution] Failed to score conversation #${conversationId}:`, err.message);
    return null;
  }
}

/**
 * Update agent_metrics summary table
 */
async function updateAggregatedMetrics(companyId = 'default', agentKey = 'camila') {
  try {
    const aggRes = await query(
      `SELECT
         COUNT(*)::int as total_scored,
         COALESCE(SUM(total_xp), 0)::int as sum_xp,
         COALESCE(AVG(total_xp), 0)::numeric(5,1) as avg_xp,
         COUNT(*) FILTER (WHERE conversion_xp > 0)::int as conversions,
         COUNT(*) FILTER (WHERE sheet_xp > 0)::int as sheets_generated,
         COUNT(*) FILTER (WHERE quality_xp = 15)::int as perfect_quality
       FROM conversation_evolution_scores
       WHERE company_id = $1 AND agent_key = $2`,
      [companyId, agentKey]
    );

    const agg = aggRes.rows[0] || {};
    const metricTypes = [
      { type: 'total_conversation_xp', val: agg.sum_xp || 0 },
      { type: 'scored_conversations_count', val: agg.total_scored || 0 },
      { type: 'average_conversation_xp', val: agg.avg_xp || 0 },
      { type: 'conversions_count', val: agg.conversions || 0 },
      { type: 'sheets_generated_count', val: agg.sheets_generated || 0 },
    ];

    for (const m of metricTypes) {
      await query(
        `INSERT INTO agent_metrics (company_id, agent_key, metric_type, metric_value, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (company_id, agent_key, metric_type) DO UPDATE SET
           metric_value = EXCLUDED.metric_value,
           updated_at = NOW()`,
        [companyId, agentKey, m.type, m.val]
      );
    }
  } catch (err) {
    console.warn('[ConversationEvolution] updateAggregatedMetrics error:', err.message);
  }
}

/**
 * Sweeps all recent conversations and ensures they are scored
 */
async function sweepRecentConversations({ companyId = 'default', agentKey = 'camila', limit = 100 } = {}) {
  await ensureTables();
  const cleanCompany = String(companyId || 'default').trim();

  try {
    const convsRes = await query(
      `SELECT c.id
       FROM conversations c
       LEFT JOIN conversation_evolution_scores s
         ON s.conversation_id = c.id AND s.company_id = c.company_id
       WHERE c.company_id = $1
       ORDER BY (s.updated_at IS NULL) DESC, c.updated_at DESC
       LIMIT $2`,
      [cleanCompany, Math.min(Math.max(Number(limit) || 50, 1), 200)]
    );

    let scoredCount = 0;
    for (const row of convsRes.rows) {
      const res = await scoreConversationAndPersist(row.id, cleanCompany, { agentKey });
      if (res) scoredCount++;
    }

    return { ok: true, scoredCount, totalChecked: convsRes.rows.length };
  } catch (err) {
    console.error('[ConversationEvolution] sweepRecentConversations error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Get itemized conversation scores for API endpoints and UI
 */
async function getConversationScores({
  companyId = 'default',
  agentKey = 'camila',
  limit = 50,
  offset = 0,
  search = '',
  algorithm = '',
  minXp = null,
} = {}) {
  await ensureTables();
  const cleanCompany = String(companyId || 'default').trim();

  // If table is completely empty, run a quick auto-sweep so user sees real data immediately
  const countCheck = await query(
    `SELECT COUNT(*)::int as count FROM conversation_evolution_scores WHERE company_id = $1`,
    [cleanCompany]
  ).catch(() => ({ rows: [{ count: 0 }] }));

  if (Number(countCheck.rows[0]?.count || 0) === 0) {
    await sweepRecentConversations({ companyId: cleanCompany, agentKey, limit: 30 });
  }

  const conditions = ['s.company_id = $1'];
  const params = [cleanCompany];
  let paramIndex = 2;

  if (algorithm && algorithm !== 'todos') {
    conditions.push(`s.algorithm_code = $${paramIndex}`);
    params.push(algorithm);
    paramIndex++;
  }

  if (minXp !== null && !isNaN(minXp)) {
    conditions.push(`s.total_xp >= $${paramIndex}`);
    params.push(Number(minXp));
    paramIndex++;
  }

  if (search && search.trim()) {
    conditions.push(`(s.contact_name ILIKE $${paramIndex} OR s.contact_phone ILIKE $${paramIndex} OR s.evaluation_summary ILIKE $${paramIndex})`);
    params.push(`%${search.trim()}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // Fetch aggregate stats
  const statsRes = await query(
    `SELECT
       COUNT(*)::int as total_conversations,
       COALESCE(SUM(total_xp), 0)::int as total_earned_xp,
       COALESCE(AVG(total_xp), 0)::numeric(5,1) as average_score,
       COUNT(*) FILTER (WHERE conversion_xp > 0)::int as total_conversions,
       COUNT(*) FILTER (WHERE sheet_xp > 0)::int as total_sheets
     FROM conversation_evolution_scores s
     WHERE s.company_id = $1`,
    [cleanCompany]
  );
  const summaryStats = statsRes.rows[0] || {};

  // Algorithm distribution
  const algoDistRes = await query(
    `SELECT algorithm_code, COUNT(*)::int as count, COALESCE(SUM(total_xp), 0)::int as total_xp
     FROM conversation_evolution_scores
     WHERE company_id = $1
     GROUP BY algorithm_code
     ORDER BY count DESC`,
    [cleanCompany]
  );

  // Paginated scores
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 100));
  const limitClause = `LIMIT $${paramIndex}`;
  paramIndex++;

  params.push(Math.max(Number(offset) || 0, 0));
  const offsetClause = `OFFSET $${paramIndex}`;

  const scoresQuery = `
    SELECT
      s.conversation_id as "conversationId",
      s.contact_name as "contactName",
      s.contact_phone as "contactPhone",
      s.algorithm_code as "algorithmCode",
      s.algorithm_name as "algorithmName",
      s.conversation_style as "conversationStyle",
      s.cadastral_xp as "cadastralXp",
      s.product_xp as "productXp",
      s.sheet_xp as "sheetXp",
      s.conversion_xp as "conversionXp",
      s.quality_xp as "qualityXp",
      s.total_xp as "totalXp",
      s.milestones,
      s.breakdown,
      s.evaluation_summary as "evaluationSummary",
      s.funnel_stage as "funnelStage",
      s.has_order_sheet as "hasOrderSheet",
      s.evaluated_at as "evaluatedAt",
      s.updated_at as "updatedAt"
    FROM conversation_evolution_scores s
    WHERE ${whereClause}
    ORDER BY s.total_xp DESC, s.updated_at DESC
    ${limitClause} ${offsetClause}
  `;

  const scoresRes = await query(scoresQuery, params);

  return {
    totalConversations: Number(summaryStats.total_conversations || 0),
    totalEarnedXp: Number(summaryStats.total_earned_xp || 0),
    averageScore: Number(summaryStats.average_score || 0),
    totalConversions: Number(summaryStats.total_conversions || 0),
    totalSheets: Number(summaryStats.total_sheets || 0),
    algorithmDistribution: algoDistRes.rows,
    scores: scoresRes.rows.map(row => ({
      ...row,
      algorithm: {
        code: row.algorithmCode,
        name: row.algorithmName,
        style: row.conversationStyle,
      },
    })),
  };
}

module.exports = {
  XP_MILESTONES,
  evaluateConversationMilestones,
  scoreConversationAndPersist,
  getConversationScores,
  sweepRecentConversations,
  updateAggregatedMetrics,
  ensureTables,
};
