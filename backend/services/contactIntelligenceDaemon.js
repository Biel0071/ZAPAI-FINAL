/**
 * Contact Intelligence Daemon ("Detect de Contato")
 *
 * Responsável por analisar diariamente e em tempo real as conversas dos clientes,
 * detectando automaticamente o estado atual do pedido, sentimento, intenção e pendências.
 * 
 * Atualiza dinamicamente:
 *  - Etiquetas (tags): adiciona novas etiquetas relevantes e remove etiquetas obsoletas/conflitantes
 *  - Estado do pedido (order_status): entregue, atrasado, não entregue, agendado, aguardando pix, pago
 *  - Funil (funnel_stage): suporte, agendado, negociacao, fechamento, pago, pos_venda, cancelado
 *  - Temperatura (lead_temperature): urgente, quente, morno, frio
 *  - Notas CRM (notes): resumo executivo da situação atual do cliente e do pedido
 *
 * Suporta dois modos:
 *  1. Análise em Tempo Real (acionada por mensagem recebida ou enviada)
 *  2. Varredura Diária / Periódica (cron diário que varre contatos recentes)
 */

const { query } = require('../src/infrastructure/config/database');
const conversationRepository = require('../src/data/repositories/conversationRepository');

function normalizeText(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Padrões de detecção semântica de pedidos e atendimento
 */
const PATTERNS = {
  DELIVERY_ISSUE: [
    'nao foi entregue', 'não foi entregue', 'nao recebi', 'não recebi', 'atrasou',
    'atraso na entrega', 'atrasada', 'nao chegou', 'não chegou', 'ainda nao chegou',
    'ainda não chegou', 'cade meu pedido', 'cadê meu pedido', 'cade a entrega',
    'cadê a entrega', 'nao veio', 'não veio', 'demorando muito', 'demora na entrega',
    'nao entregaram', 'não entregaram', 'estou esperando ate agora'
  ],
  SCHEDULED_ORDER: [
    'ja estava agendado', 'já estava agendado', 'ja agendado', 'já agendado',
    'agendado para', 'agendamento', 'marcado para', 'marcou para', 'data agendada',
    'entrega agendada', 'dia agendado', 'ficou agendado', 'ja tinha agendado'
  ],
  PAYMENT_CONFIRMED: [
    'ja paguei', 'já paguei', 'fiz o pix', 'mandei o pix', 'ta pago', 'tá pago',
    'segue o comprovante', 'comprovante do pix', 'comprovante anexado', 'pix realizado',
    'pagamento realizado', 'pagamento efetuado', 'ja transferi', 'já transferi'
  ],
  PAYMENT_PENDING: [
    'manda o pix', 'qual o pix', 'chave pix', 'qual a chave', 'passa o pix',
    'como pagar', 'forma de pagamento', 'dados bancarios', 'link do cartao',
    'link de pagamento', 'manda a conta'
  ],
  ORDER_DELIVERED: [
    'ja recebi', 'já recebi', 'chegou certinho', 'chegou tudo certo', 'obrigado chegou',
    'entregaram aqui', 'ja chegou aqui', 'já chegou aqui', 'recebi o material', 'tudo entregue'
  ],
  QUOTATION_PRICING: [
    'quanto custa', 'quanto fica', 'qual o valor', 'preco de', 'preço de',
    'orcamento', 'orçamento', 'cotacao', 'cotação', 'tabela de preco', 'tabela de preço',
    'consegue desconto', 'tem desconto'
  ],
  CANCELLATION: [
    'quero cancelar', 'cancela meu pedido', 'estorno', 'devolucao', 'devolução',
    'desisti da compra', 'desisti', 'nao vou querer mais', 'não vou querer mais'
  ]
};

function matchesAny(text, patternList) {
  const norm = normalizeText(text);
  return patternList.some(p => norm.includes(normalizeText(p)));
}

/**
 * Analisa o histórico de mensagens da conversa e extrai o diagnóstico completo.
 */
function analyzeConversationSignals(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      orderStatus: 'sem_mensagens',
      intents: [],
      deliveryIssue: false,
      scheduled: false,
      paymentConfirmed: false,
      paymentPending: false,
      delivered: false,
      quotation: false,
      cancellation: false,
      lastClientMessage: '',
    };
  }

  // Ordenar mensagens cronologicamente
  const sorted = [...messages].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const clientMessages = sorted.filter(m => !m.from_me && m.direction !== 'outgoing' && m.sender !== 'agent' && m.sender !== 'campaign');
  const lastClientMsg = clientMessages.length > 0 ? clientMessages[clientMessages.length - 1].text : '';

  let deliveryIssue = false;
  let scheduled = false;
  let paymentConfirmed = false;
  let paymentPending = false;
  let delivered = false;
  let quotation = false;
  let cancellation = false;

  // Analisa mensagens do cliente (com peso maior para as mensagens mais recentes)
  const recentClientMessages = clientMessages.slice(-8);
  for (const m of recentClientMessages) {
    const text = m.text || m.content || '';
    if (matchesAny(text, PATTERNS.DELIVERY_ISSUE)) deliveryIssue = true;
    if (matchesAny(text, PATTERNS.SCHEDULED_ORDER)) scheduled = true;
    if (matchesAny(text, PATTERNS.PAYMENT_CONFIRMED)) paymentConfirmed = true;
    if (matchesAny(text, PATTERNS.PAYMENT_PENDING)) paymentPending = true;
    if (matchesAny(text, PATTERNS.ORDER_DELIVERED)) delivered = true;
    if (matchesAny(text, PATTERNS.QUOTATION_PRICING)) quotation = true;
    if (matchesAny(text, PATTERNS.CANCELLATION)) cancellation = true;
  }

  // Se o cliente confirmou recebimento recente, anula o problema de entrega anterior
  if (delivered && clientMessages.length > 0 && matchesAny(lastClientMsg, PATTERNS.ORDER_DELIVERED)) {
    deliveryIssue = false;
  }

  // Determinar Estado Principal do Pedido
  let orderStatus = 'indefinido';
  if (deliveryIssue) {
    orderStatus = 'atraso_nao_entregue';
  } else if (cancellation) {
    orderStatus = 'cancelado';
  } else if (delivered) {
    orderStatus = 'entregue';
  } else if (paymentConfirmed) {
    orderStatus = 'pago';
  } else if (scheduled) {
    orderStatus = 'agendado';
  } else if (paymentPending) {
    orderStatus = 'aguardando_pagamento';
  } else if (quotation) {
    orderStatus = 'em_cotacao';
  }

  return {
    orderStatus,
    deliveryIssue,
    scheduled,
    paymentConfirmed,
    paymentPending,
    delivered,
    quotation,
    cancellation,
    lastClientMessage: lastClientMsg,
  };
}

/**
 * Reconcilia e atualiza etiquetas (tags) com base nos sinais detectados.
 */
function reconcileTags(currentTags = [], signals = {}) {
  const tagsSet = new Set(Array.isArray(currentTags) ? currentTags.map(t => String(t).trim().toLowerCase()) : []);

  // Regras de Remoção de Etiquetas Conflitantes
  if (signals.paymentConfirmed) {
    tagsSet.delete('aguardando_pagamento');
    tagsSet.delete('pix_pendente');
    tagsSet.delete('aguardando_resposta');
  }
  if (signals.delivered) {
    tagsSet.delete('pedido_nao_entregue');
    tagsSet.delete('suporte_urgente');
    tagsSet.delete('aguardando_entrega');
  }
  if (signals.deliveryIssue) {
    tagsSet.delete('pedido_entregue');
    tagsSet.delete('concluido');
    tagsSet.delete('aguardando_resposta');
  }
  if (signals.lastClientMessage) {
    tagsSet.delete('aguardando_resposta');
  }

  // Regras de Adição de Etiquetas
  if (signals.deliveryIssue) {
    tagsSet.add('pedido_nao_entregue');
    tagsSet.add('suporte_urgente');
  }
  if (signals.scheduled) {
    tagsSet.add('pedido_agendado');
    tagsSet.add('agendado');
  }
  if (signals.paymentConfirmed) {
    tagsSet.add('pago');
    tagsSet.add('comprovante_enviado');
  }
  if (signals.paymentPending && !signals.paymentConfirmed) {
    tagsSet.add('aguardando_pagamento');
    tagsSet.add('pix_pendente');
  }
  if (signals.delivered) {
    tagsSet.add('pedido_entregue');
    tagsSet.add('concluido');
  }
  if (signals.quotation && !signals.deliveryIssue) {
    tagsSet.add('orcamento');
    tagsSet.add('em_negociacao');
  }
  if (signals.cancellation) {
    tagsSet.add('cancelado');
    tagsSet.add('recuperacao');
  }

  return Array.from(tagsSet).filter(Boolean);
}

/**
 * Determina o Funil e Temperatura ideais para o cliente
 */
function determineFunnelAndTemperature(signals = {}, currentFunnel = 'new_lead', currentTemp = 'warm') {
  let funnel = currentFunnel;
  let temp = currentTemp;

  if (signals.deliveryIssue) {
    funnel = 'suporte';
    temp = 'urgente';
  } else if (signals.cancellation) {
    funnel = 'cancelado';
    temp = 'frio';
  } else if (signals.delivered) {
    funnel = 'pos_venda';
    temp = 'frio';
  } else if (signals.paymentConfirmed) {
    funnel = 'pago';
    temp = 'quente';
  } else if (signals.scheduled) {
    funnel = 'agendado';
    temp = 'quente';
  } else if (signals.paymentPending) {
    funnel = 'fechamento';
    temp = 'quente';
  } else if (signals.quotation) {
    funnel = 'negociacao';
    temp = 'quente';
  }

  return { funnel, temp };
}

/**
 * Gera nota executiva estruturada do CRM para o contato
 */
function buildExecutiveNotes(existingNotes = '', signals = {}, phone = '') {
  let noteParts = [];
  const cleanExisting = String(existingNotes || '').replace(/\[Detect Automático\]:.*$/gm, '').trim();
  if (cleanExisting) {
    noteParts.push(cleanExisting);
  }

  const dateStr = new Date().toLocaleDateString('pt-BR');
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (signals.deliveryIssue) {
    noteParts.push(`[Detect Automático]: ⚠️ Pedido não entregue / Atraso relatado pelo cliente em ${dateStr} às ${timeStr}. Mensagem: "${signals.lastClientMessage}". Requer acionamento urgente da logística/expedição.`);
  } else if (signals.scheduled && !signals.deliveryIssue) {
    noteParts.push(`[Detect Automático]: 📅 Pedido/Atendimento já agendado. Mensagem do cliente: "${signals.lastClientMessage}".`);
  } else if (signals.paymentConfirmed) {
    noteParts.push(`[Detect Automático]: 💰 Pagamento/PIX informado pelo cliente em ${dateStr} às ${timeStr}.`);
  } else if (signals.paymentPending) {
    noteParts.push(`[Detect Automático]: 💳 Cliente solicitou dados para pagamento/PIX em ${dateStr}.`);
  } else if (signals.delivered) {
    noteParts.push(`[Detect Automático]: ✅ Entrega confirmada com sucesso em ${dateStr}.`);
  } else if (signals.cancellation) {
    noteParts.push(`[Detect Automático]: ❌ Cliente solicitou cancelamento/desistência.`);
  }

  return noteParts.join('\n\n').trim();
}

/**
 * Executa o diagnóstico e atualização inteligente de um contato/conversa específico.
 */
async function detectConversationIntelligence(conversationId, options = {}) {
  if (!conversationId) return null;

  try {
    const convResult = await query(
      `SELECT c.*, l.name as lead_name, l.phone as lead_phone
       FROM conversations c
       LEFT JOIN leads l ON c.lead_id = l.id
       WHERE c.id = $1 LIMIT 1`,
      [conversationId]
    );

    if (convResult.rows.length === 0) return null;
    const conv = convResult.rows[0];

    // Carregar mensagens recentes da conversa (últimas 30 mensagens)
    const msgResult = await query(
      `SELECT id, text, content, direction, sender, from_me, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT 30`,
      [conversationId]
    );

    const messages = msgResult.rows.reverse();
    const signals = analyzeConversationSignals(messages);

    const newTags = reconcileTags(conv.tags, signals);
    const { funnel, temp } = determineFunnelAndTemperature(signals, conv.funnel_stage, conv.lead_temperature);
    const newNotes = buildExecutiveNotes(conv.notes, signals, conv.remote_jid || conv.lead_phone);

    const updates = {
      tags: newTags,
      funnel_stage: funnel,
      lead_temperature: temp,
      notes: newNotes,
      lead_intent: signals.orderStatus,
    };

    // Atualiza estado no banco
    const updatedConv = await conversationRepository.updateConversationState(conversationId, updates);

    // Também atualiza tabela leads se existir lead_id
    if (conv.lead_id) {
      await query(
        `UPDATE leads SET tags = $1, updated_at = NOW() WHERE id = $2`,
        [newTags, conv.lead_id]
      ).catch(() => {});
    }

    // Emissão via Socket.io para atualização instantânea na tela
    const io = global.io || options.io;
    if (io && updatedConv) {
      io.emit('conversation_updated', {
        ...updatedConv,
        tags: newTags,
        funnel_stage: funnel,
        lead_temperature: temp,
        notes: newNotes,
      });
      io.emit('conversation:update', {
        id: conversationId,
        tags: newTags,
        funnel_stage: funnel,
        lead_temperature: temp,
        notes: newNotes,
      });
    }

    console.log(`[CONTACT-INTELLIGENCE] Conv #${conversationId} updated: status=${signals.orderStatus}, funnel=${funnel}, temp=${temp}, tags=[${newTags.join(', ')}]`);

    return {
      success: true,
      conversationId,
      signals,
      tags: newTags,
      funnel,
      temp,
      notes: newNotes,
    };
  } catch (err) {
    console.error(`[CONTACT-INTELLIGENCE] Error analyzing conversation #${conversationId}:`, err);
    return null;
  }
}

/**
 * Varredura Diária / Periódica ("Detect de Contato Diário")
 * Analisa todas as conversas ativas ou com mensagens recentes nas últimas N horas.
 */
async function runDailyContactDetection(options = {}) {
  const hoursBack = options.hoursBack || 48;
  const companyId = options.companyId || 'default';
  const limit = options.limit || 500;

  console.log(`[CONTACT-INTELLIGENCE] Starting daily detection sweep for company=${companyId} (last ${hoursBack}h, limit=${limit})...`);

  try {
    const res = await query(
      `SELECT id FROM conversations
       WHERE (company_id = $1 OR $1 = 'default')
         AND (updated_at >= NOW() - INTERVAL '${hoursBack} hours' OR status = 'open')
       ORDER BY updated_at DESC
       LIMIT $2`,
      [companyId, limit]
    );

    const conversations = res.rows;
    console.log(`[CONTACT-INTELLIGENCE] Found ${conversations.length} conversations to evaluate.`);

    let processed = 0;
    let categoryCounts = {
      deliveryIssue: 0,
      scheduled: 0,
      paymentConfirmed: 0,
      paymentPending: 0,
      delivered: 0,
      quotation: 0,
      cancellation: 0,
    };

    for (const row of conversations) {
      const result = await detectConversationIntelligence(row.id, options);
      if (result?.signals) {
        processed += 1;
        if (result.signals.deliveryIssue) categoryCounts.deliveryIssue += 1;
        if (result.signals.scheduled) categoryCounts.scheduled += 1;
        if (result.signals.paymentConfirmed) categoryCounts.paymentConfirmed += 1;
        if (result.signals.paymentPending) categoryCounts.paymentPending += 1;
        if (result.signals.delivered) categoryCounts.delivered += 1;
        if (result.signals.quotation) categoryCounts.quotation += 1;
        if (result.signals.cancellation) categoryCounts.cancellation += 1;
      }
    }

    console.log(`[CONTACT-INTELLIGENCE] Sweep completed. Processed ${processed}/${conversations.length} conversations. Summary:`, categoryCounts);
    return {
      success: true,
      totalEvaluated: conversations.length,
      totalProcessed: processed,
      categoryCounts,
    };
  } catch (err) {
    console.error('[CONTACT-INTELLIGENCE] Daily detection sweep failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Inicializador do Daemon Periódico
 */
let daemonTimer = null;
function startContactIntelligenceDaemon(intervalMinutes = 60) {
  if (daemonTimer) clearInterval(daemonTimer);
  console.log(`[CONTACT-INTELLIGENCE] Contact Intelligence Daemon scheduled every ${intervalMinutes} minutes.`);

  // Executa uma varredura inicial 30 segundos após o boot
  setTimeout(() => {
    runDailyContactDetection().catch(err => {
      console.warn('[CONTACT-INTELLIGENCE] Initial sweep warning:', err.message);
    });
  }, 30000);

  daemonTimer = setInterval(() => {
    runDailyContactDetection().catch(err => {
      console.warn('[CONTACT-INTELLIGENCE] Scheduled sweep warning:', err.message);
    });
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  analyzeConversationSignals,
  reconcileTags,
  determineFunnelAndTemperature,
  buildExecutiveNotes,
  detectConversationIntelligence,
  runDailyContactDetection,
  startContactIntelligenceDaemon,
};
