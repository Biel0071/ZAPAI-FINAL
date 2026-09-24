/**
 * ConversationMemory Engine — Memória Ativa Real em 5 Níveis do ZAPFLOW AI
 *
 * Nível 1: Memória da Mensagem (última interação, timestamp, canal)
 * Nível 2: Memória da Conversa (resumo, pendências, sentimento, estágio do funil)
 * Nível 3: Memória do Cliente (fatos do cliente, nome, cidade/endereço, preferências, objeções)
 * Nível 4: Memória Comercial (produtos de interesse, quantidades, capacidade, cotações, condições)
 * Nível 5: Memória do Atendente (aprendizados aplicados para futuras respostas)
 *
 * Classificação de Fatos:
 * - temporary_context
 * - conversation_context
 * - customer_fact
 * - commercial_intent
 * - preference
 * - objection
 * - purchase_intent
 * - important_information
 * - learned_response
 *
 * Suporte a:
 * - Resolução de conflitos / atualização de fatos (novo dado substitui dado contraditório anterior)
 * - Importance (1 a 10), Confidence (0.0 a 1.0), Source ('customer'|'agent'|'inferred')
 * - Isolamento total por company_id (multi-tenant)
 * - Persistência no PostgreSQL na tabela ai_conversation_memory
 */

const { query } = require('../src/infrastructure/config/database');

const MEMORY_CATEGORIES = {
  TEMPORARY_CONTEXT: 'temporary_context',
  CONVERSATION_CONTEXT: 'conversation_context',
  CUSTOMER_FACT: 'customer_fact',
  COMMERCIAL_INTENT: 'commercial_intent',
  PREFERENCE: 'preference',
  OBJECTION: 'objection',
  PURCHASE_INTENT: 'purchase_intent',
  IMPORTANT_INFO: 'important_information',
  LEARNED_RESPONSE: 'learned_response',
};

// Normalização de chave de fato para evitar duplicação
function normalizeFactKey(key = '') {
  return String(key)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Recupera ou inicializa a memória de um cliente/conversa por telefone/contactId e companyId.
 */
async function getConversationMemory({ contactId, phone, companyId = 'default', sessionId }) {
  const normalizedId = String(contactId || phone || '').trim();
  const normalizedPhone = String(phone || contactId || '').trim();
  const cleanCompany = String(companyId || 'default').trim();
  if (!normalizedId) return null;
  const cleanSessionId = sessionId ? String(sessionId).trim() : null;

  try {
    let res;
    if (cleanSessionId) {
      res = await query(
        `SELECT contact_id, company_id, phone, name, intent, sentiment, session_id, tags, summary, metrics, messages, last_updated, updated_at
         FROM ai_conversation_memory
         WHERE (contact_id = $1 OR phone = $2) AND company_id = $3 AND session_id = $4
         LIMIT 1`,
        [normalizedId, normalizedPhone, cleanCompany, cleanSessionId]
      );
    } else {
      res = await query(
        `SELECT contact_id, company_id, phone, name, intent, sentiment, session_id, tags, summary, metrics, messages, last_updated, updated_at
         FROM ai_conversation_memory
         WHERE (contact_id = $1 OR phone = $2) AND company_id = $3
         ORDER BY updated_at DESC
         LIMIT 1`,
        [normalizedId, normalizedPhone, cleanCompany]
      );
    }

    if (res.rows.length > 0) {
      const row = res.rows[0];
      const metrics = typeof row.metrics === 'object' && row.metrics !== null ? row.metrics : {};
      
      // Níveis de memória estruturados armazenados em metrics
      const facts = metrics.facts || {};
      const commercial = metrics.commercial || {
        activeProduct: null,
        capacity: null,
        quantity: null,
        quotedPrice: null,
        deliveryCity: null,
        paymentPreference: null,
      };
      const pendingQuestions = metrics.pendingQuestions || [];

      return {
        contactId: row.contact_id,
        phone: row.phone,
        name: row.name,
        companyId: row.company_id,
        sessionId,
        intent: row.intent || 'information',
        sentiment: row.sentiment || 'neutral',
        tags: Array.isArray(row.tags) ? row.tags : [],
        summary: row.summary || '',
        messages: Array.isArray(row.messages) ? row.messages : [],
        lastUpdated: row.last_updated,
        facts, // Nível 3
        commercial, // Nível 4
        pendingQuestions, // Nível 2
        metrics,
      };
    }
  } catch (err) {
    console.warn('[ConversationMemory] Erro ao carregar memória do DB:', err.message);
  }

  // Estrutura vazia padrão
  return {
    contactId: normalizedId,
    phone: normalizedPhone,
    name: 'Cliente',
    companyId,
    sessionId,
    intent: 'information',
    sentiment: 'neutral',
    tags: [],
    summary: '',
    messages: [],
    lastUpdated: new Date().toISOString(),
    facts: {},
    commercial: {
      activeProduct: null,
      capacity: null,
      quantity: null,
      quotedPrice: null,
      deliveryCity: null,
      paymentPreference: null,
    },
    pendingQuestions: [],
    metrics: {},
  };
}

/**
 * Atualiza ou insere um fato do cliente (Nível 3/4) resolvendo conflitos.
 */
function setCustomerFact(memory, { key, value, category = MEMORY_CATEGORIES.CUSTOMER_FACT, importance = 5, confidence = 1.0, source = 'customer' }) {
  if (!memory || !key) return;
  if (!memory.facts) memory.facts = {};

  const normKey = normalizeFactKey(key);
  const now = new Date().toISOString();

  // Se já existe, atualizamos o fato (ex: nova capacidade informada substitui a anterior)
  const existing = memory.facts[normKey];
  memory.facts[normKey] = {
    key: normKey,
    label: key,
    value: String(value).trim(),
    category,
    importance: Math.min(10, Math.max(1, Number(importance) || 5)),
    confidence: Math.min(1.0, Math.max(0.0, Number(confidence) || 1.0)),
    source,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastUsedAt: now,
  };

  // Mapeamentos automáticos para memória comercial (Nível 4)
  if (!memory.commercial) memory.commercial = {};
  if (normKey.includes('produto') || normKey === 'product') {
    memory.commercial.activeProduct = String(value).trim();
  } else if (normKey.includes('capacidade') || normKey === 'capacity' || normKey.includes('litros')) {
    memory.commercial.capacity = String(value).trim();
  } else if (normKey.includes('quantidade') || normKey === 'quantity') {
    memory.commercial.quantity = String(value).trim();
  } else if (normKey.includes('cidade') || normKey === 'city' || normKey.includes('endereco') || normKey === 'address') {
    memory.commercial.deliveryCity = String(value).trim();
  } else if (normKey.includes('pagamento') || normKey === 'payment') {
    memory.commercial.paymentPreference = String(value).trim();
  } else if (normKey.includes('preco') || normKey === 'price' || normKey.includes('orcamento')) {
    memory.commercial.quotedPrice = String(value).trim();
  }
}

/**
 * Detecta e extrai fatos automaticamente do texto e metadados.
 */
function extractFactsFromContext(text = '', analysis = {}, memory) {
  const lower = text.toLowerCase();

  // 1. Extração de Produto e Capacidade (ex: Caixa d'água 5000L / Churrasqueira)
  if (lower.includes('caixa d') || lower.includes('caixa d’agua') || lower.includes('caixa dagua') || lower.includes('caixa d água')) {
    setCustomerFact(memory, {
      key: 'produto_interesse',
      value: "Caixa d'água",
      category: MEMORY_CATEGORIES.COMMERCIAL_INTENT,
      importance: 9,
    });
  } else if (lower.includes('churrasqueira')) {
    setCustomerFact(memory, {
      key: 'produto_interesse',
      value: 'Churrasqueira pré-moldada',
      category: MEMORY_CATEGORIES.COMMERCIAL_INTENT,
      importance: 9,
    });
  } else if (lower.includes('cimento')) {
    setCustomerFact(memory, {
      key: 'produto_interesse',
      value: 'Cimento',
      category: MEMORY_CATEGORIES.COMMERCIAL_INTENT,
      importance: 8,
    });
  } else if (lower.includes('tijolo')) {
    setCustomerFact(memory, {
      key: 'produto_interesse',
      value: 'Tijolos',
      category: MEMORY_CATEGORIES.COMMERCIAL_INTENT,
      importance: 8,
    });
  }

  // Capacidade em litros
  const capacityMatch = lower.match(/(\d+[\.,]?\d*)\s*(mil\s*litros|mil\s*l|litros|l\b)/i) ||
                        lower.match(/(\d{3,5})\s*l/i) ||
                        (lower.includes('5 mil') || lower.includes('5mil') ? ['5 mil litros', '5', 'mil litros'] : null);
  if (capacityMatch) {
    let cap = capacityMatch[0].trim();
    if (cap.includes('5 mil') || cap.includes('5mil') || cap.includes('5000')) {
      cap = '5.000 Litros';
    } else if (cap.includes('3 mil') || cap.includes('3mil') || cap.includes('3000')) {
      cap = '3.000 Litros';
    } else if (cap.includes('1 mil') || cap.includes('1mil') || cap.includes('1000')) {
      cap = '1.000 Litros';
    }
    setCustomerFact(memory, {
      key: 'capacidade',
      value: cap,
      category: MEMORY_CATEGORIES.COMMERCIAL_INTENT,
      importance: 9,
    });
  }

  // Localização / Entrega
  const cityMatch = text.match(/(?:entrega|entregam|entregas|envio|frete|manda)\s+(?:para|pra|em|no|na)?\s*([a-zA-ZÀ-ÿ\s]+)/i) ||
                    text.match(/(?:sou|moro|estou)\s+(?:de|em)\s+([a-zA-ZÀ-ÿ\s]+)/i);
  if (cityMatch && cityMatch[1]) {
    let rawCity = cityMatch[1].replace(/[?.,!].*$/, '').trim();
    const lowerCity = rawCity.toLowerCase();
    if (rawCity.length > 2 && !lowerCity.includes('quanto') && !lowerCity.includes('onde') && !lowerCity.includes('qual') && !lowerCity.includes('aqui')) {
      // Capitalização elegante de cidades
      rawCity = rawCity.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      setCustomerFact(memory, {
        key: 'cidade_entrega',
        value: rawCity,
        category: MEMORY_CATEGORIES.CUSTOMER_FACT,
        importance: 8,
      });
    }
  }

  // Objeção de compra (ex: "vou pensar", "está caro")
  if (lower.includes('vou pensar') || lower.includes('depois vejo') || lower.includes('falo com meu')) {
    setCustomerFact(memory, {
      key: 'objecao_compra',
      value: 'Pediu tempo para pensar / decidir',
      category: MEMORY_CATEGORIES.OBJECTION,
      importance: 7,
    });
  } else if (lower.includes('caro') || lower.includes('desconto')) {
    setCustomerFact(memory, {
      key: 'objecao_compra',
      value: 'Sensibilidade a preço / solicitou desconto',
      category: MEMORY_CATEGORIES.OBJECTION,
      importance: 7,
    });
  }

  // Fatos vindos da análise da IA (se fornecidos)
  if (analysis && typeof analysis === 'object') {
    if (analysis.address) {
      setCustomerFact(memory, {
        key: 'endereco_completo',
        value: analysis.address,
        category: MEMORY_CATEGORIES.CUSTOMER_FACT,
        importance: 9,
      });
    }
    if (analysis.product_name) {
      setCustomerFact(memory, {
        key: 'produto_interesse',
        value: analysis.product_name,
        category: MEMORY_CATEGORIES.COMMERCIAL_INTENT,
        importance: 9,
      });
    }
    if (analysis.product_capacity) {
      setCustomerFact(memory, {
        key: 'capacidade',
        value: analysis.product_capacity,
        category: MEMORY_CATEGORIES.COMMERCIAL_INTENT,
        importance: 9,
      });
    }
    if (analysis.facts_learned && typeof analysis.facts_learned === 'object') {
      for (const [k, v] of Object.entries(analysis.facts_learned)) {
        if (v) {
          setCustomerFact(memory, {
            key: k,
            value: v,
            category: MEMORY_CATEGORIES.CUSTOMER_FACT,
            importance: 8,
          });
        }
      }
    }
  }
}

/**
 * Salva a memória atualizada no banco de dados com segurança transacional e merge.
 */
async function persistConversationMemory(memory, companyId = 'default') {
  if (!memory || (!memory.contactId && !memory.phone)) return;

  const cleanCompany = String(companyId || memory.companyId || 'default').trim();
  const sessionId = String(memory.sessionId || 'default').trim();
  const contactId = memory.contactId || memory.phone;
  const phone = memory.phone || memory.contactId;
  const metrics = {
    ...(memory.metrics || {}),
    facts: memory.facts || {},
    commercial: memory.commercial || {},
    pendingQuestions: memory.pendingQuestions || [],
    memoriesUpdatedCount: ((memory.metrics?.memoriesUpdatedCount || 0) + 1),
  };

  try {
    await query(
      `INSERT INTO ai_conversation_memory (
        contact_id, company_id, phone, name, intent, sentiment, session_id,
        tags, summary, metrics, messages, last_updated, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $11, $7, $8, $9::jsonb, $10::jsonb, NOW(), NOW(), NOW())
      ON CONFLICT (company_id, session_id, contact_id) DO UPDATE SET
        name = COALESCE(NULLIF(EXCLUDED.name, ''), ai_conversation_memory.name),
        phone = COALESCE(NULLIF(EXCLUDED.phone, ''), ai_conversation_memory.phone),
        intent = EXCLUDED.intent,
        sentiment = EXCLUDED.sentiment,
        tags = EXCLUDED.tags,
        summary = EXCLUDED.summary,
        metrics = EXCLUDED.metrics,
        messages = EXCLUDED.messages,
        last_updated = NOW(),
        updated_at = NOW()`,
      [
        contactId,
        cleanCompany,
        phone,
        memory.name || 'Cliente',
        memory.intent || 'information',
        memory.sentiment || 'neutral',
        memory.tags || [],
        memory.summary || '',
        JSON.stringify(metrics),
        JSON.stringify((memory.messages || []).slice(-40)),
        sessionId,
      ]
    );
  } catch (err) {
    throw err;
  }
}

/**
 * Constrói o bloco de prompt formatado em 5 níveis para o LLM.
 */
function buildContextualPrompt(memory) {
  if (!memory) return '';

  const sections = [];
  sections.push('[MEMÓRIA ATIVA DO CLIENTE & CONTEXTO MULTI-NÍVEL]');

  // Nível 3 & 4: Fatos e Contexto Comercial
  const factsList = Object.values(memory.facts || {})
    .sort((a, b) => b.importance - a.importance)
    .map(f => `- ${f.label || f.key}: "${f.value}" (confiança: ${Math.round(f.confidence * 100)}%)`);

  if (memory.commercial?.activeProduct) {
    sections.push(`- PRODUTO ATUAL EM FOCO: ${memory.commercial.activeProduct}`);
  }
  if (memory.commercial?.capacity) {
    sections.push(`- CAPACIDADE / MEDIDA DEFINIDA: ${memory.commercial.capacity}`);
  }
  if (memory.commercial?.quantity) {
    sections.push(`- QUANTIDADE DEFINIDA: ${memory.commercial.quantity}`);
  }
  if (memory.commercial?.deliveryCity) {
    sections.push(`- DESTINO DE ENTREGA / CIDADE: ${memory.commercial.deliveryCity}`);
  }
  if (memory.commercial?.quotedPrice) {
    sections.push(`- PREÇO JÁ COTADO: ${memory.commercial.quotedPrice}`);
  }

  if (factsList.length > 0) {
    sections.push('FATOS CONSOLIDADOS DO CLIENTE (NÃO RE-PERGUNTAR):');
    sections.push(factsList.join('\n'));
  }

  if (memory.pendingQuestions && memory.pendingQuestions.length > 0) {
    sections.push(`PENDÊNCIAS DA CONVERSA: ${memory.pendingQuestions.join('; ')}`);
  }

  // Regras de Ouro de Continuidade
  sections.push(
    'REGRA CRÍTICA DE CONTINUIDADE: Você JAMAIS deve pedir informações que já constam na memória acima. ' +
    'Se o cliente perguntar "Quanto fica?", "Tem foto?" ou "Entrega?", responda DIRETAMENTE considerando o produto, ' +
    'capacidade e cidade especificados acima. Não responda de forma genérica nem reinicie a conversa!'
  );

  return sections.join('\n');
}

module.exports = {
  MEMORY_CATEGORIES,
  getConversationMemory,
  setCustomerFact,
  extractFactsFromContext,
  persistConversationMemory,
  buildContextualPrompt,
};
