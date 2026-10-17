'use strict';

/**
 * OrderSheet Service — Gestão e Geração de Fichas de Pedido / Orçamento Comercial
 *
 * Responsável por:
 * 1. Analisar conversas comerciais e colher automaticamente dados do cliente:
 *    - Nome completo
 *    - Endereço / Bairro / Cidade / CEP
 *    - Itens do pedido, especificações/capacidades e quantidades
 *    - Forma de pagamento preferida (PIX à vista / Cartão)
 * 2. Gerar ficha de pedido e orçamento estruturado com persistência em PostgreSQL (`conversation_sheets`).
 * 3. Enviar mensagem de confirmação para o WhatsApp do cliente.
 * 4. Ao confirmar, finalizar o atendimento da IA e passar para o atendente humano aguardando o comprovante PIX:
 *    - Tags: `ficha_gerada`, `aguarda_pix`, `atendimento_finalizado`
 *    - Funil: `fechamento` / `aguardando_pix`
 *    - `ai_enabled = false` / `controlMode = 'human_active'`
 * 5. Listar e consultar fichas já geradas (`GET /api/conversations/sheets`).
 */

const { query } = require('../src/infrastructure/config/database');
const conversationRepository = require('../src/data/repositories/conversationRepository');
const messageRepository = require('../src/data/repositories/messageRepository');
const conversationRuntimeService = require('../src/messaging/inbox/inbox/services/ConversationRuntimeService');
const { normalizePhone } = require('./whatsapp/shared/identifiers');

// Preços de referência padrão do catálogo oficial
const DEFAULT_CATALOG_PRICES = {
  'churrasqueira': { name: 'Churrasqueira Pré-Moldada Trio Completa', defaultPrice: 990.00, unit: 'unidade' },
  'tijolo': { name: 'Tijolo 8 Furos Cerâmico (Milheiro)', defaultPrice: 720.00, unit: 'milheiro' },
  'cimento': { name: 'Cimento CP II 50kg', defaultPrice: 34.90, unit: 'saco' },
  'caixa_5000': { name: "Caixa d'Água 5.000 Litros Polietileno com Tampa", defaultPrice: 2490.00, unit: 'unidade' },
  'caixa_3000': { name: "Caixa d'Água 3.000 Litros Polietileno com Tampa", defaultPrice: 1690.00, unit: 'unidade' },
  'caixa_1000': { name: "Caixa d'Água 1.000 Litros Polietileno com Tampa", defaultPrice: 449.00, unit: 'unidade' },
  'caixa_500': { name: "Caixa d'Água 500 Litros Polietileno com Tampa", defaultPrice: 289.00, unit: 'unidade' },
  'bloco': { name: 'Bloco de Concreto Estrutural 14x19x39', defaultPrice: 4.80, unit: 'unidade' },
  'telha': { name: 'Telha Fibrocimento 2,44 x 1,10m', defaultPrice: 49.90, unit: 'unidade' },
  'betoneira': { name: 'Betoneira 400L com Motor Monofásico', defaultPrice: 3890.00, unit: 'unidade' },
};

function formatMoneyBRL(amount = 0) {
  const num = Number(amount) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function cleanText(val = '') {
  return String(val || '').trim();
}

/**
 * Extrai dados consolidados da conversa para a ficha de pedido
 */
async function extractSheetDataFromConversation(conversationId, companyId = 'default') {
  const cleanCompany = String(companyId || 'default').trim();
  const convResult = await query(
    `SELECT c.*, l.name as lead_name, l.phone as lead_phone,
            COALESCE(l.phone, c.remote_jid) as phone
     FROM conversations c
     LEFT JOIN leads l ON c.lead_id = l.id
     WHERE c.id = $1 AND c.company_id = $2
     LIMIT 1`,
    [conversationId, cleanCompany]
  );

  if (convResult.rows.length === 0) {
    throw Object.assign(new Error('Conversa não encontrada.'), { status: 404 });
  }

  const conv = convResult.rows[0];
  const messagesResult = await query(
    `SELECT id, text, content, from_me, sender, direction, created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );
  const messages = messagesResult.rows;

  // Carrega memória do cliente se disponível
  let memoryCommercial = {};
  let memoryFacts = {};
  try {
    const memRes = await query(
      `SELECT metrics FROM ai_conversation_memory 
       WHERE (contact_id = $1 OR phone = $2) AND company_id = $3
       LIMIT 1`,
      [conv.phone, conv.phone, cleanCompany]
    );
    if (memRes.rows.length > 0 && memRes.rows[0].metrics) {
      memoryCommercial = memRes.rows[0].metrics.commercial || {};
      memoryFacts = memRes.rows[0].metrics.facts || {};
    }
  } catch (_) {}

  // Extrai nome do cliente
  let customerName = conv.name || conv.lead_name || '';
  if (!customerName || customerName === 'Contato' || customerName.includes('@') || /^\d+$/.test(customerName)) {
    // Procura em mensagens do cliente se ele disse "meu nome é X" ou "sou o X"
    for (const msg of messages.filter(m => !m.from_me)) {
      const text = String(msg.text || msg.content || '');
      const nameMatch = text.match(/(?:meu nome [eé]|sou [oa]|pode me chamar de)\s+([A-ZÀ-Úa-zà-ú]{2,20}(?:\s+[A-ZÀ-Úa-zà-ú]{2,20})?)/i);
      if (nameMatch && nameMatch[1]) {
        customerName = nameMatch[1].trim();
        break;
      }
    }
  }
  if (!customerName || customerName === 'Contato') {
    customerName = 'Cliente';
  }

  // Extrai endereço, bairro, cidade, CEP
  let neighborhood = memoryCommercial.neighborhood || memoryCommercial.deliveryCity || null;
  let city = memoryCommercial.deliveryCity || null;
  let cep = null;
  let fullAddress = null;

  for (const msg of messages.filter(m => !m.from_me)) {
    const text = String(msg.text || msg.content || '');
    if (!cep) {
      const cepMatch = text.match(/\b\d{5}-?\d{3}\b/);
      if (cepMatch) cep = cepMatch[0];
    }
    if (!neighborhood) {
      const bMatch = text.match(/(?:bairro|moro no|entrega no|fica no|sou do)\s+([a-zA-ZÀ-ÿ\s]{3,30})/i);
      if (bMatch && bMatch[1]) {
        const cand = bMatch[1].trim();
        if (!cand.toLowerCase().includes('qual') && !cand.toLowerCase().includes('quanto') && !cand.toLowerCase().includes('preco')) {
          neighborhood = cand;
        }
      }
    }
    if (!fullAddress) {
      const addrMatch = text.match(/(?:rua|av\.|avenida|estrada|travessa)\s+[^,\n]+(?:,\s*\d+)?/i);
      if (addrMatch) {
        fullAddress = addrMatch[0].trim();
      }
    }
  }

  // Se tem bairro e cidade, monta endereço de entrega sugerido
  const deliveryAddress = fullAddress || [neighborhood, city, cep].filter(Boolean).join(', ') || 'A combinar com o atendente';

  // Identifica itens do pedido e quantidade
  const items = [];
  const allCustomerText = messages.filter(m => !m.from_me).map(m => String(m.text || m.content || '')).join(' ');
  const normalizedAll = allCustomerText.toLowerCase();

  // 1. Caixa d'água
  if (normalizedAll.includes('caixa') || normalizedAll.includes('dagua') || normalizedAll.includes('reservatorio') || memoryCommercial.activeProduct?.toLowerCase().includes('caixa')) {
    let capacity = memoryCommercial.capacity;
    if (!capacity) {
      if (normalizedAll.includes('5000') || normalizedAll.includes('5 mil')) capacity = '5.000 Litros';
      else if (normalizedAll.includes('3000') || normalizedAll.includes('3 mil')) capacity = '3.000 Litros';
      else if (normalizedAll.includes('1000') || normalizedAll.includes('1 mil') || normalizedAll.includes('mil litros')) capacity = '1.000 Litros';
      else if (normalizedAll.includes('500')) capacity = '500 Litros';
      else capacity = '5.000 Litros'; // Default mais comum no anúncio
    }
    const catKey = capacity.includes('5.000') ? 'caixa_5000' : capacity.includes('3.000') ? 'caixa_3000' : capacity.includes('1.000') ? 'caixa_1000' : 'caixa_500';
    const def = DEFAULT_CATALOG_PRICES[catKey] || DEFAULT_CATALOG_PRICES.caixa_5000;
    items.push({
      item: def.name,
      specification: `Capacidade ${capacity}`,
      quantity: 1,
      unitPrice: def.defaultPrice,
      totalPrice: def.defaultPrice,
    });
  }

  // 2. Churrasqueira
  if (normalizedAll.includes('churrasqueira') || normalizedAll.includes('trio') || memoryCommercial.activeProduct?.toLowerCase().includes('churrasqueira')) {
    const def = DEFAULT_CATALOG_PRICES.churrasqueira;
    items.push({
      item: def.name,
      specification: 'Modelo Tijolinho 3 em 1 (Churrasqueira + Forno + Fogão)',
      quantity: 1,
      unitPrice: def.defaultPrice,
      totalPrice: def.defaultPrice,
    });
  }

  // 3. Tijolos
  if (normalizedAll.includes('tijolo') || normalizedAll.includes('milheiro') || memoryCommercial.activeProduct?.toLowerCase().includes('tijolo')) {
    let qty = 1;
    const qtyMatch = normalizedAll.match(/(\d+)\s*(?:milheiro|mil|milheiros)/);
    if (qtyMatch && Number(qtyMatch[1]) > 0) qty = Number(qtyMatch[1]);
    const def = DEFAULT_CATALOG_PRICES.tijolo;
    items.push({
      item: def.name,
      specification: '8 Furos Cerâmico Alta Resistência',
      quantity: qty,
      unitPrice: def.defaultPrice,
      totalPrice: def.defaultPrice * qty,
    });
  }

  // 4. Cimento
  if (normalizedAll.includes('cimento') || memoryCommercial.activeProduct?.toLowerCase().includes('cimento')) {
    let qty = 10;
    const qtyMatch = normalizedAll.match(/(\d+)\s*(?:saco|sacos)/);
    if (qtyMatch && Number(qtyMatch[1]) > 0) qty = Number(qtyMatch[1]);
    const def = DEFAULT_CATALOG_PRICES.cimento;
    items.push({
      item: def.name,
      specification: 'CP II Nacional 50kg',
      quantity: qty,
      unitPrice: def.defaultPrice,
      totalPrice: def.defaultPrice * qty,
    });
  }

  // Se nenhum item foi detectado por padrão, usa produto geral de cotação
  if (items.length === 0) {
    const primaryName = memoryCommercial.activeProduct || conv.summary || 'Item sob cotação';
    items.push({
      item: primaryName,
      specification: 'Conforme interesse manifestado na conversa',
      quantity: 1,
      unitPrice: 0.00,
      totalPrice: 0.00,
    });
  }

  // Calcula total
  const totalPrice = items.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);

  // Forma de pagamento
  let paymentMethod = 'pix';
  if (normalizedAll.includes('cartao') || normalizedAll.includes('cartão') || normalizedAll.includes('parcel')) {
    paymentMethod = 'cartao';
  }

  return {
    conversationId: conv.id,
    leadId: conv.lead_id,
    phone: conv.phone,
    customerName,
    deliveryAddress,
    deliveryNeighborhood: neighborhood || '',
    deliveryCity: city || '',
    deliveryCep: cep || '',
    items,
    totalPrice,
    paymentMethod,
    summary: conv.summary || '',
  };
}

/**
 * Cria ou atualiza a Ficha de Pedido no PostgreSQL
 */
async function saveConversationSheet(sheetData, companyId = 'default') {
  const cleanCompany = String(companyId || 'default').trim();
  const {
    conversationId,
    leadId,
    phone,
    customerName,
    deliveryAddress,
    deliveryNeighborhood,
    deliveryCity,
    deliveryCep,
    items,
    totalPrice,
    paymentMethod,
    status = 'generated',
  } = sheetData;

  const summaryText = buildSheetText({
    customerName,
    phone,
    deliveryAddress,
    items,
    totalPrice,
    paymentMethod,
    status,
  });

  const res = await query(
    `INSERT INTO conversation_sheets (
      company_id, conversation_id, lead_id, phone, customer_name,
      delivery_address, delivery_neighborhood, delivery_city, delivery_cep,
      items, total_price, payment_method, status, summary_text, sheet_data,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10::jsonb, $11, $12, $13, $14, $15::jsonb,
      NOW()
    )
    RETURNING *`,
    [
      cleanCompany,
      conversationId,
      leadId || null,
      phone,
      customerName,
      deliveryAddress,
      deliveryNeighborhood,
      deliveryCity,
      deliveryCep,
      JSON.stringify(items || []),
      totalPrice || 0,
      paymentMethod || 'pix',
      status,
      summaryText,
      JSON.stringify(sheetData),
    ]
  );

  return res.rows[0];
}

/**
 * Monta o texto oficial e humanizado da ficha de pedido para WhatsApp
 */
function buildSheetText(sheet) {
  const itemsText = (sheet.items || [])
    .map(i => `• *${i.item}* ${i.specification ? `(${i.specification})` : ''} - Qtd: ${i.quantity}x - ${formatMoneyBRL(i.totalPrice)}`)
    .join('\n');

  const paymentLabel = sheet.paymentMethod === 'pix'
    ? 'PIX à Vista (com desconto especial)'
    : 'Cartão de Crédito (em até 10x sem juros)';

  return [
    '📋 *FICHA DE PEDIDO & ORÇAMENTO*',
    '──────────────────────────────',
    `👤 *Cliente:* ${sheet.customerName || 'Cliente'}`,
    `📞 *Telefone:* ${sheet.phone || ''}`,
    `📍 *Entrega:* ${sheet.deliveryAddress || 'A confirmar'}`,
    '',
    '📦 *Itens do Pedido:*',
    itemsText || '• Materiais conforme negociação',
    '',
    `💰 *Valor Total:* ${formatMoneyBRL(sheet.totalPrice)}`,
    `💳 *Condição:* ${paymentLabel}`,
    '──────────────────────────────',
    'Por favor confirme se os dados e o endereço acima estão corretos para agendarmos sua entrega e gerarmos a chave PIX!',
  ].join('\n');
}

/**
 * Lista fichas de pedido geradas ("veja fichas já geradas")
 */
async function listConversationSheets({ companyId = 'default', status, limit = 50, offset = 0 }) {
  const cleanCompany = String(companyId || 'default').trim();
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);

  let sql = `
    SELECT s.*, c.status as conversation_status, c.ai_enabled, c.funnel_stage
    FROM conversation_sheets s
    LEFT JOIN conversations c ON s.conversation_id = c.id
    WHERE s.company_id = $1
  `;
  const params = [cleanCompany];

  if (status) {
    params.push(status);
    sql += ` AND s.status = $${params.length}`;
  }

  sql += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(safeLimit, safeOffset);

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Consulta a última ficha de uma conversa específica
 */
async function getLatestSheetForConversation(conversationId, companyId = 'default') {
  const cleanCompany = String(companyId || 'default').trim();
  const result = await query(
    `SELECT * FROM conversation_sheets
     WHERE conversation_id = $1 AND company_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [conversationId, cleanCompany]
  );
  return result.rows[0] || null;
}

/**
 * Finaliza o atendimento na ficha, comuta status para aguarda humano com PIX
 * e desativa a IA da conversa para o operador humano assumir.
 */
async function finalizeAttendanceWithSheet({
  conversationId,
  companyId = 'default',
  sheetId = null,
  store = null,
  io = null,
}) {
  const cleanCompany = String(companyId || 'default').trim();

  // 1. Atualiza status da ficha
  let updatedSheet = null;
  if (sheetId) {
    const sRes = await query(
      `UPDATE conversation_sheets 
       SET status = 'aguarda_pix', updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [sheetId, cleanCompany]
    );
    updatedSheet = sRes.rows[0];
  } else {
    const sRes = await query(
      `UPDATE conversation_sheets 
       SET status = 'aguarda_pix', updated_at = NOW()
       WHERE conversation_id = $1 AND company_id = $2
       RETURNING *`,
      [conversationId, cleanCompany]
    );
    updatedSheet = sRes.rows[0];
  }

  // 2. Transiciona a conversa:
  // - Adiciona tags: 'ficha_gerada', 'aguarda_pix', 'atendimento_finalizado'
  // - Funil: 'fechamento' (ou 'aguardando_pix')
  // - ai_enabled = false
  // - status = 'aguarda_pix'
  // - Modo de controle: human_active (takeover)
  const convRes = await query(
    `SELECT * FROM conversations WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [conversationId, cleanCompany]
  );
  if (convRes.rows.length === 0) return null;
  const conv = convRes.rows[0];

  const currentTags = Array.isArray(conv.tags) ? conv.tags : [];
  const targetTags = ['ficha_gerada', 'aguarda_pix', 'atendimento_finalizado'];
  const newTags = Array.from(new Set([...currentTags, ...targetTags]));

  await conversationRepository.updateConversationState(conversationId, {
    tags: newTags,
    funnel_stage: 'fechamento',
    status: 'aguarda_pix',
    lead_temperature: 'ready_to_buy',
    aiEnabled: false,
  });

  if (store) {
    conversationRuntimeService.setHumanTakeover(store, conversationId, 48 * 60 * 60 * 1000);
  }

  const updatedConv = await conversationRepository.getConversationById(conversationId);
  const activeIo = io || store?.io || global.io;
  if (activeIo && updatedConv) {
    activeIo.emit('conversation:update', updatedConv);
    activeIo.emit('conversation_updated', updatedConv);
    activeIo.emit('sheet:finalized', { conversationId, sheet: updatedSheet });
  }

  return {
    success: true,
    sheet: updatedSheet,
    conversation: updatedConv,
  };
}

module.exports = {
  extractSheetDataFromConversation,
  saveConversationSheet,
  buildSheetText,
  listConversationSheets,
  getLatestSheetForConversation,
  finalizeAttendanceWithSheet,
  formatMoneyBRL,
};
