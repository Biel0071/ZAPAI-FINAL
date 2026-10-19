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

const PRODUCT_EXCLUDE_REGEX = /(?:churrasqueira|trio|forno|fog[aã]o|caixa|d['’]?\s*agua|d['’]?\s*água|reservat[oó]rio|tijolo|milheiro|cimento|bloco|telha|areia|brita|produto|material|pre[çc]o|valor|quanto|qual|entrega\s+d[ao]|loja|gr[aá]tis|frete|sem\s+custo|promo[çc][aã]o|desconto)/i;

function sanitizeDeliveryField(val) {
  if (!val) return '';
  const str = cleanText(val);
  if (!str || str === '-' || PRODUCT_EXCLUDE_REGEX.test(str)) return '';
  if (str.length < 3) return '';
  return str;
}

/**
 * Resolve número telefônico limpo eliminando LIDs e formatando padrão brasileiro
 */
async function resolveCleanCustomerPhone(rawPhone) {
  if (!rawPhone) return '';
  let str = String(rawPhone).trim();
  const isLid = str.includes('@lid') || (/^\d{14,16}$/.test(str.replace(/\D/g, '')) && !str.startsWith('55'));

  if (isLid) {
    const rawDigits = str.replace(/@.*$/, '').replace(/\D/g, '');
    try {
      const res = await query(
        `SELECT phone FROM whatsapp_lid_mappings WHERE lid = $1 OR lid = $2 LIMIT 1`,
        [str, rawDigits]
      );
      if (res.rows.length > 0 && res.rows[0].phone) {
        str = res.rows[0].phone;
      }
    } catch (_) {}
  }

  const digits = str.replace(/@.*$/, '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (!str.includes('@lid')) {
    return str.replace(/@.*$/, '');
  }
  return '';
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

  // Extrai telefone limpo e formatado
  const customerPhone = await resolveCleanCustomerPhone(conv.lead_phone || conv.phone || conv.remote_jid);

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

  // Extrai endereço, bairro, cidade, CEP, CPF, e-mail e referência
  let neighborhood = sanitizeDeliveryField(memoryCommercial.neighborhood) || null;
  let city = sanitizeDeliveryField(memoryCommercial.deliveryCity) || null;
  let state = null;
  let cep = null;
  let fullAddress = null;
  let cpf = null;
  let email = null;
  let reference = null;

  for (const msg of messages.filter(m => !m.from_me)) {
    const text = String(msg.text || msg.content || '');
    
    // CEP
    const cepMatch = text.match(/\b\d{5}-?\d{3}\b/);
    if (cepMatch) cep = cepMatch[0];

    // CPF
    const cpfMatch = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
    if (cpfMatch) cpf = cpfMatch[0];

    // E-mail
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    if (emailMatch) email = emailMatch[0];

    // Bairro (blindado contra nomes de produto)
    const bMatch = text.match(/(?:bairro|moro no|moro na|fica no|fica na|sou do|sou da|vila|jardim)\s+([a-zA-ZÀ-ÿ0-9\s]{3,35})/i);
    if (bMatch && bMatch[1]) {
      let cand = bMatch[1].trim();
      if (/\s+(?:em|de|na|no)\s+/i.test(cand)) {
        cand = cand.split(/\s+(?:em|de|na|no)\s+/i)[0].trim();
      }
      if (!PRODUCT_EXCLUDE_REGEX.test(cand) && cand.length >= 3) {
        neighborhood = cand;
      }
    }

    // Cidade e UF (ex: Sorocaba/SP, Ipojuca - PE)
    const cityUfMatch = text.match(/(?:cidade|munic[ií]pio|em|de)\s+([a-zA-ZÀ-ÿ\s]{3,25})\s*(?:[-/]|,\s*|\s+em\s+|\s+de\s+)?([A-Z]{2})\b/i);
    if (cityUfMatch && cityUfMatch[1] && cityUfMatch[2]) {
      const candCity = cityUfMatch[1].trim();
      const candUf = cityUfMatch[2].toUpperCase();
      const validUfs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
      if (validUfs.includes(candUf) && !PRODUCT_EXCLUDE_REGEX.test(candCity)) {
        city = candCity;
        state = candUf;
      }
    }

    // Ponto de Referência
    const refMatch = text.match(/(?:ponto de refer[eê]ncia|refer[eê]ncia|perto d[eao]|pr[oó]ximo [aà]|em frente [aà])\s+([^\n,.;]+)/i);
    if (refMatch && refMatch[1]) {
      const candRef = refMatch[1].trim();
      if (!PRODUCT_EXCLUDE_REGEX.test(candRef) && candRef.length > 3) {
        reference = candRef;
      }
    }

    // Endereço (Rua, Av, etc)
    const addrMatch = text.match(/(?:rua|av\.|avenida|estrada|travessa|rodovia|alameda)\s+[^,\n]+(?:,\s*(?:n[ºo°]?\s*)?\d+[a-zA-Z]?)?/i);
    if (addrMatch) {
      const candAddr = addrMatch[0].trim();
      if (!PRODUCT_EXCLUDE_REGEX.test(candAddr)) {
        fullAddress = candAddr;
      }
    }
  }

  // Se tem bairro e cidade, monta endereço de entrega sugerido (limpo sem valores repetidos ou poluídos)
  let deliveryAddress = fullAddress ? sanitizeDeliveryField(fullAddress) : '';
  if (!deliveryAddress) {
    const parts = Array.from(new Set([neighborhood, city, state, cep].filter(Boolean)));
    deliveryAddress = parts.length > 0 ? parts.join(', ') : '';
  }

  // Helper para extrair quantidades dinâmicas (dígitos ou por extenso)
  const parseItemQuantity = (text = '', keywords = []) => {
    const wordNums = { 'uma': 1, 'um': 1, 'duas': 2, 'dois': 2, 'tres': 3, 'três': 3, 'quatro': 4, 'cinco': 5, 'seis': 6, 'dez': 10 };
    for (const [w, n] of Object.entries(wordNums)) {
      for (const kw of keywords) {
        if (new RegExp(`\\b${w}\\s+${kw}`, 'i').test(text)) return n;
      }
      if (new RegExp(`(?:quero|preciso de|manda|leva|seriam?)\\s+${w}\\b`, 'i').test(text)) return n;
    }
    for (const kw of keywords) {
      const m = text.match(new RegExp(`(\\d+)\\s*(?:unidades?|un|pe[çc]as?)?\\s*${kw}`, 'i'));
      if (m && Number(m[1]) > 0 && Number(m[1]) < 1000) return Number(m[1]);
    }
    const general = text.match(/(?:quero|comprar|preciso de|seriam?|manda)\s+(\d+)\b/i);
    if (general && Number(general[1]) > 0 && Number(general[1]) < 1000) return Number(general[1]);
    return 1;
  };

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
    const qty = parseItemQuantity(normalizedAll, ['caixas?', 'reservat[oó]rios?']);
    items.push({
      item: def.name,
      specification: `Capacidade ${capacity}`,
      quantity: qty,
      unitPrice: def.defaultPrice,
      totalPrice: def.defaultPrice * qty,
    });
  }

  // 2. Churrasqueira
  if (normalizedAll.includes('churrasqueira') || normalizedAll.includes('trio') || memoryCommercial.activeProduct?.toLowerCase().includes('churrasqueira')) {
    const def = DEFAULT_CATALOG_PRICES.churrasqueira;
    const qty = parseItemQuantity(normalizedAll, ['churrasqueiras?', 'trios?']);
    items.push({
      item: def.name,
      specification: 'Modelo Tijolinho 3 em 1 (Churrasqueira + Forno + Fogão)',
      quantity: qty,
      unitPrice: def.defaultPrice,
      totalPrice: def.defaultPrice * qty,
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

  // Resumo financeiro estruturado
  const productTotal = items.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
  let freight = Number(memoryCommercial.freightPrice) || 0;
  if (!freight && (deliveryAddress !== 'A combinar com o atendente' || neighborhood || city || cep)) {
    freight = 65.12;
  }
  const orderTotal = productTotal + freight;
  const deliveryTime = memoryCommercial.deliveryTime || '3 a 5 dias úteis';
  const pixDiscountRate = 0.05; // 5% de desconto à vista no valor dos produtos
  const pixTotal = (productTotal * (1 - pixDiscountRate)) + freight;
  const installment10x = orderTotal > 0 ? orderTotal / 10 : 0;

  // Forma de pagamento
  let paymentMethod = 'pix';
  if (normalizedAll.includes('cartao') || normalizedAll.includes('cartão') || normalizedAll.includes('parcel')) {
    paymentMethod = 'cartao';
  }

  return {
    conversationId: conv.id,
    leadId: conv.lead_id,
    phone: customerPhone,
    rawPhone: conv.phone,
    customerName,
    cpf: cpf || null,
    email: email || null,
    deliveryAddress,
    deliveryNeighborhood: neighborhood || '',
    deliveryCity: city || '',
    deliveryState: state || '',
    deliveryCep: cep || '',
    reference: reference || null,
    items,
    productTotal,
    freight,
    orderTotal,
    totalPrice: orderTotal,
    deliveryTime,
    pixTotal,
    installment10x,
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
    cpf,
    email,
    deliveryAddress,
    deliveryNeighborhood,
    deliveryCity,
    deliveryState,
    deliveryCep,
    reference,
    items,
    productTotal,
    freight,
    orderTotal,
    totalPrice,
    deliveryTime,
    pixTotal,
    installment10x,
    paymentMethod,
    observations,
    status = 'generated',
  } = sheetData;

  const summaryText = buildSheetText({
    customerName,
    cpf,
    phone,
    email,
    deliveryAddress,
    deliveryNeighborhood,
    deliveryCity,
    deliveryState,
    deliveryCep,
    reference,
    items,
    productTotal: productTotal ?? totalPrice,
    freight,
    orderTotal: orderTotal ?? totalPrice,
    totalPrice: orderTotal ?? totalPrice,
    deliveryTime,
    pixTotal,
    installment10x,
    paymentMethod,
    observations,
    status,
  });

  // Procura se já existe uma ficha aberta/gerada para esta conversa
  const existingRes = await query(
    `SELECT id FROM conversation_sheets
     WHERE conversation_id = $1 AND company_id = $2 AND status IN ('generated', 'draft')
     ORDER BY created_at DESC LIMIT 1`,
    [conversationId, cleanCompany]
  );

  let sheetRow;
  if (existingRes.rows.length > 0) {
    const existingId = existingRes.rows[0].id;
    const updRes = await query(
      `UPDATE conversation_sheets SET
        lead_id = COALESCE($3, lead_id),
        phone = $4,
        customer_name = $5,
        delivery_address = $6,
        delivery_neighborhood = $7,
        delivery_city = $8,
        delivery_cep = $9,
        items = $10::jsonb,
        total_price = $11,
        payment_method = $12,
        status = $13,
        summary_text = $14,
        sheet_data = $15::jsonb,
        updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [
        existingId,
        cleanCompany,
        leadId || null,
        phone,
        customerName,
        deliveryAddress,
        deliveryNeighborhood,
        deliveryCity,
        deliveryCep,
        JSON.stringify(items || []),
        totalPrice || orderTotal || 0,
        paymentMethod || 'pix',
        status,
        summaryText,
        JSON.stringify(sheetData),
      ]
    );
    sheetRow = updRes.rows[0];
  } else {
    const insRes = await query(
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
        totalPrice || orderTotal || 0,
        paymentMethod || 'pix',
        status,
        summaryText,
        JSON.stringify(sheetData),
      ]
    );
    sheetRow = insRes.rows[0];
  }

  // Tag conversa com 'ficha_gerada'
  try {
    const conv = await conversationRepository.getConversationById(conversationId, cleanCompany);
    if (conv) {
      const currentTags = Array.isArray(conv.tags) ? conv.tags : [];
      if (!currentTags.includes('ficha_gerada')) {
        await conversationRepository.updateConversationState(conversationId, {
          tags: Array.from(new Set([...currentTags, 'ficha_gerada'])),
        }, cleanCompany);
      }
    }
  } catch (_) {}

  // Dispara evento no Webhook Service do ZAI
  try {
    const webhookService = require('./webhookService');
    webhookService.dispatchEvent({
      tenantId: cleanCompany,
      event: 'sheet.created',
      payload: {
        conversationId,
        sheetId: sheetRow.id,
        sheet: sheetRow,
      },
    }).catch(() => {});
  } catch (_) {}

  return sheetRow;
}

/**
 * Monta o texto oficial e humanizado da ficha de pedido para WhatsApp
 * Omitindo dinamicamente campos não enviados pelo cliente (CPF, e-mail, referência)
 */
function buildSheetText(sheet) {
  const customerLines = [];
  const cleanName = cleanText(sheet.customerName);
  if (cleanName && cleanName !== 'Cliente' && cleanName !== 'Contato' && cleanName !== '-' && !cleanName.includes('@')) {
    customerLines.push(`Nome: ${cleanName}`);
  }
  const cleanPhone = cleanText(sheet.phone);
  if (cleanPhone && cleanPhone !== '-' && !cleanPhone.includes('@lid')) {
    customerLines.push(`Telefone: ${cleanPhone}`);
  }
  const cleanCpf = cleanText(sheet.cpf);
  if (cleanCpf && cleanCpf !== '-') customerLines.push(`CPF: ${cleanCpf}`);
  const cleanEmail = cleanText(sheet.email);
  if (cleanEmail && cleanEmail !== '-') customerLines.push(`E-mail: ${cleanEmail}`);

  // Se nenhum dado do cliente sobrou além do genérico
  if (customerLines.length === 0 && cleanName) {
    customerLines.push(`Cliente: ${cleanName}`);
  }

  const cleanAddr = sanitizeDeliveryField(sheet.deliveryAddress);
  const cleanNeigh = sanitizeDeliveryField(sheet.deliveryNeighborhood);
  const cleanCity = sanitizeDeliveryField(sheet.deliveryCity);
  const cleanState = cleanText(sheet.deliveryState);
  const cleanCep = cleanText(sheet.deliveryCep);
  const cleanRef = sanitizeDeliveryField(sheet.reference);

  const deliveryLines = [];
  if (cleanAddr && cleanAddr !== '-' && cleanAddr !== 'A combinar com o atendente') {
    deliveryLines.push(`Endereço: ${cleanAddr}`);
  }
  if (cleanNeigh && cleanNeigh !== '-') {
    deliveryLines.push(`Bairro: ${cleanNeigh}`);
  }
  if (cleanCity && cleanCity !== '-') {
    deliveryLines.push(`Cidade: ${cleanCity}`);
  }
  if (cleanState && cleanState !== '-') {
    deliveryLines.push(`Estado: ${cleanState}`);
  }
  if (cleanCep && cleanCep !== '-' && !cleanCep.includes('qual')) {
    deliveryLines.push(`CEP: ${cleanCep}`);
  }
  if (cleanRef && cleanRef !== '-') {
    deliveryLines.push(`Referência: ${cleanRef}`);
  }

  const itemsText = (sheet.items || [])
    .map(i => `• ${i.item} × ${i.quantity || 1}`)
    .join('\n');

  const productTotal = Number(sheet.productTotal ?? sheet.totalPrice) || 0;
  const freight = Number(sheet.freight) || 0;
  const orderTotal = Number(sheet.orderTotal ?? (productTotal + freight)) || productTotal;
  const deliveryTime = sheet.deliveryTime || '3 a 5 dias úteis';
  const pixTotal = Number(sheet.pixTotal ?? (productTotal * 0.95 + freight));
  const installment10x = Number(sheet.installment10x ?? (orderTotal > 0 ? orderTotal / 10 : 0));

  const textBlocks = [
    '📋 *FICHA DE PEDIDO & ORÇAMENTO*',
    '──────────────────────────────',
  ];

  if (customerLines.length > 0) {
    textBlocks.push('👤 *Dados do Cliente*', ...customerLines, '');
  }

  // Se não tem dados de entrega confirmados, não polui o envio da ficha
  if (deliveryLines.length > 0) {
    textBlocks.push('📍 *Entrega*', ...deliveryLines, '');
  }

  textBlocks.push(
    '📦 *Itens*',
    itemsText || '• Materiais conforme negociação',
    '',
    `💰 *Valor dos Produtos:* ${formatMoneyBRL(productTotal)}`,
    freight > 0 ? `🚚 *Frete:* ${formatMoneyBRL(freight)}` : null,
    `💵 *Total do Pedido:* ${formatMoneyBRL(orderTotal)}`,
    deliveryLines.length > 0 ? `⏱️ *Prazo de Entrega:* ${deliveryTime}` : null,
    '',
    '💳 *Condições de Pagamento*',
    `• PIX à Vista: ${formatMoneyBRL(pixTotal)} (com 5% de desconto nos produtos)`,
    `• Cartão: 10x sem juros de ${formatMoneyBRL(installment10x)}`,
  );

  if (sheet.observations) {
    textBlocks.push('', '📝 *Observações*', sheet.observations);
  }

  textBlocks.push(
    '──────────────────────────────',
    'Por favor confirme se os dados e o endereço acima estão corretos para agendarmos sua entrega e gerarmos a chave PIX!'
  );

  return textBlocks.filter(line => line !== null && line !== undefined).join('\n');
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

/**
 * Dispara dados da ficha estruturada para ERP / DANFE / Orçamento externo
 */
async function dispatchSheetToErp({
  conversationId,
  sheetId = null,
  companyId = 'default',
  webhookUrl = null,
  apiKey = null,
}) {
  const cleanCompany = String(companyId || 'default').trim();
  let sheet = null;
  if (sheetId) {
    const res = await query(
      `SELECT * FROM conversation_sheets WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [sheetId, cleanCompany]
    );
    sheet = res.rows[0];
  } else {
    sheet = await getLatestSheetForConversation(conversationId, cleanCompany);
  }

  if (!sheet) {
    try {
      const sheetData = await extractSheetDataFromConversation(conversationId, cleanCompany);
      sheet = await saveConversationSheet(sheetData, cleanCompany);
    } catch (_) {}
  }

  if (!sheet) {
    throw Object.assign(new Error('Ficha não encontrada para integração ERP.'), { status: 404 });
  }

  const payload = {
    event: 'erp.order_sheet.sync',
    source: 'ZAI CRM',
    timestamp: new Date().toISOString(),
    companyId: cleanCompany,
    conversationId,
    sheet: {
      id: sheet.id,
      customerName: sheet.customer_name,
      phone: sheet.phone,
      deliveryAddress: sheet.delivery_address,
      deliveryNeighborhood: sheet.delivery_neighborhood,
      deliveryCity: sheet.delivery_city,
      deliveryCep: sheet.delivery_cep,
      items: sheet.items,
      totalPrice: sheet.total_price,
      paymentMethod: sheet.payment_method,
      status: sheet.status,
      summaryText: sheet.summary_text,
      details: sheet.sheet_data,
    },
  };

  let delivered = false;
  let responseData = null;

  if (webhookUrl) {
    const axios = require('axios');
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'ZAI-CRM-ERP-Sync/1.0',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-API-Key'] = apiKey;
    }
    const resp = await axios.post(webhookUrl, payload, { headers, timeout: 8000 });
    delivered = true;
    responseData = resp.data;
  } else {
    // Dispara via WebhookService registrado no sistema
    const webhookService = require('./webhookService');
    const dispatchRes = await webhookService.dispatchEvent({
      tenantId: cleanCompany,
      event: 'sheet.erp_sync',
      payload,
    });
    delivered = (dispatchRes?.delivered || 0) > 0;
  }

  return {
    success: true,
    delivered,
    payload,
    responseData,
  };
}

module.exports = {
  extractSheetDataFromConversation,
  saveConversationSheet,
  buildSheetText,
  listConversationSheets,
  getLatestSheetForConversation,
  finalizeAttendanceWithSheet,
  dispatchSheetToErp,
  formatMoneyBRL,
};

