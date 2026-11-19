'use strict';

/**
 * CommerceQuoteEngine — ZAPFLOW Native Commercial Workflow
 * Gerencia o ciclo completo de orçamentos (Quotes):
 * - Seleção de produtos do catálogo real
 * - Cálculo automático de subtotal, descontos, frete e total
 * - Envio estruturado ao cliente via WhatsApp (Baileys)
 * - Aceite / Recusa manual ou automatizada por resposta textual ("APROVAR" / "CANCELAR")
 * - Conversão automática de orçamentos aceitos em pedidos oficiais no CRM (`customer_orders`)
 */

const { query: dbQuery } = require('../../src/infrastructure/config/database');
const messageRepository = require('../../src/data/repositories/messageRepository');
const sessionManager = require('../sessionManager');

class CommerceQuoteEngine {
  /**
   * Gera o próximo número de orçamento legível para a empresa (ex: ORC-1001)
   */
  async _getNextQuoteNumber(companyId = 'default') {
    try {
      const res = await dbQuery(
        `SELECT quote_number FROM quotes WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [companyId]
      );
      if (res.rows.length > 0) {
        const lastNum = res.rows[0].quote_number;
        const match = String(lastNum).match(/(\d+)/);
        if (match) {
          const next = parseInt(match[1], 10) + 1;
          return `ORC-${next}`;
        }
      }
    } catch (_) {}
    return `ORC-1001`;
  }

  /**
   * Cria um novo orçamento no sistema
   */
  async createQuote({
    companyId = 'default',
    conversationId,
    clientPhone,
    clientName = '',
    items = [],
    discountType = 'fixed',
    discountValue = 0,
    shippingAmount = 0,
    notes = '',
    validDays = 7,
  }) {
    if (!clientPhone) {
      throw new Error('O telefone do cliente é obrigatório para gerar o orçamento.');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('O orçamento deve conter pelo menos um produto do catálogo.');
    }

    // Normaliza itens e calcula subtotais
    const normalizedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const unitPrice = Number(item.unitPrice || item.price || 0);
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const itemSubtotal = Math.round(unitPrice * quantity * 100) / 100;
      subtotal += itemSubtotal;

      normalizedItems.push({
        productId: item.productId || item.id || '',
        code: item.code || '',
        name: item.name || item.title || 'Produto sem nome',
        unitPrice,
        quantity,
        subtotal: itemSubtotal,
        imageUrl: item.imageUrl || (Array.isArray(item.images) ? item.images[0] : null) || null,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;

    // Calcula desconto
    const numDiscVal = Math.max(0, Number(discountValue) || 0);
    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = Math.round(subtotal * (numDiscVal / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(subtotal, numDiscVal);
    }

    const numShipping = Math.max(0, Number(shippingAmount) || 0);
    const totalAmount = Math.max(0, Math.round((subtotal - discountAmount + numShipping) * 100) / 100);

    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const quoteNumber = await this._getNextQuoteNumber(companyId);

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (parseInt(validDays, 10) || 7));

    const insertSql = `
      INSERT INTO quotes (
        id, company_id, quote_number, conversation_id, client_phone, client_name,
        items, subtotal, discount_type, discount_value, discount_amount,
        shipping_amount, total_amount, currency, status, notes, valid_until,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7::jsonb, $8, $9, $10, $11,
        $12, $13, 'BRL', 'draft', $14, $15,
        NOW(), NOW()
      ) RETURNING *;
    `;

    const res = await dbQuery(insertSql, [
      quoteId,
      companyId,
      quoteNumber,
      conversationId || null,
      String(clientPhone).replace(/\D/g, ''),
      clientName,
      JSON.stringify(normalizedItems),
      subtotal,
      discountType,
      numDiscVal,
      discountAmount,
      numShipping,
      totalAmount,
      notes,
      validUntil.toISOString(),
    ]);

    const created = res.rows[0];
    console.log(`[COMMERCE-QUOTE] Orçamento ${quoteNumber} (${quoteId}) criado com sucesso para ${clientPhone}. Total: R$ ${totalAmount}`);

    if (global.io) {
      global.io.emit('quote:created', created);
    }

    return created;
  }

  /**
   * Busca orçamento por ID
   */
  async getQuote(quoteId, companyId = 'default') {
    const res = await dbQuery(
      `SELECT * FROM quotes WHERE id = $1 AND company_id = $2`,
      [quoteId, companyId]
    );
    return res.rows[0] || null;
  }

  /**
   * Lista orçamentos com filtros
   */
  async listQuotes({ companyId = 'default', clientPhone, conversationId, status, limit = 50 }) {
    const conditions = ['company_id = $1'];
    const params = [companyId];
    let idx = 2;

    if (clientPhone) {
      conditions.push(`client_phone = $${idx++}`);
      params.push(String(clientPhone).replace(/\D/g, ''));
    }
    if (conversationId) {
      conditions.push(`conversation_id = $${idx++}`);
      params.push(conversationId);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }

    params.push(parseInt(limit, 10) || 50);

    const sql = `
      SELECT * FROM quotes 
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC 
      LIMIT $${idx};
    `;

    const res = await dbQuery(sql, params);
    return res.rows;
  }

  /**
   * Formata a apresentação textual oficial do orçamento para o WhatsApp
   */
  formatQuoteMessage(quote) {
    const items = Array.isArray(quote.items) ? quote.items : JSON.parse(quote.items || '[]');
    const itemLines = items.map((it, i) => {
      const sub = Number(it.subtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const unit = Number(it.unitPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return `• *${it.quantity}x ${it.name}*\n  (Un: ${unit} | Subtotal: ${sub})`;
    }).join('\n\n');

    const subtotalFmt = Number(quote.subtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const totalFmt = Number(quote.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const shippingFmt = Number(quote.shipping_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let discountLine = '';
    if (Number(quote.discount_amount) > 0) {
      const discFmt = Number(quote.discount_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      discountLine = `🏷️ Desconto: -${discFmt}\n`;
    }

    let notesLine = '';
    if (quote.notes && quote.notes.trim()) {
      notesLine = `📝 *Observações:* ${quote.notes.trim()}\n--------------------------------\n`;
    }

    const validUntilDate = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('pt-BR') : '7 dias';

    return `📋 *ORÇAMENTO ${quote.quote_number}*\n` +
      `--------------------------------\n` +
      `🏢 *Depósito Material*\n` +
      `📅 *Validade até:* ${validUntilDate}\n` +
      `--------------------------------\n` +
      `🏗️ *ITENS DO PEDIDO:*\n\n` +
      `${itemLines}\n` +
      `--------------------------------\n` +
      `📦 Subtotal: ${subtotalFmt}\n` +
      `${discountLine}` +
      `🚚 Frete: ${shippingFmt}\n` +
      `💰 *VALOR TOTAL: ${totalFmt}*\n` +
      `--------------------------------\n` +
      `${notesLine}` +
      `Para aprovar este orçamento, responda *APROVAR*.\n` +
      `Para alterar ou recusar, responda *CANCELAR*.`;
  }

  /**
   * Envia o orçamento ao cliente via WhatsApp (Baileys)
   */
  async sendQuote(quoteId, { sessionId = 'main', companyId = 'default' } = {}) {
    const quote = await this.getQuote(quoteId, companyId);
    if (!quote) throw new Error(`Orçamento com ID "${quoteId}" não foi encontrado.`);

    const session = sessionManager.getSession(sessionId)
      || (sessionManager.getConnectedSessionOrNull ? sessionManager.getConnectedSessionOrNull() : null)
      || sessionManager.getSession('main')
      || sessionManager.getSession('default');

    if (!session || !session.sock) {
      throw new Error('Sessão principal do WhatsApp (Baileys) não está conectada para envio.');
    }

    const cleanPhone = String(quote.client_phone).replace(/\D/g, '');
    const targetJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
    const messageText = this.formatQuoteMessage(quote);

    console.log(`[COMMERCE-QUOTE] Enviando orçamento ${quote.quote_number} para ${targetJid}`);
    const sendResult = await session.sock.sendMessage(targetJid, { text: messageText });
    const whatsappMessageId = sendResult?.key?.id || `wamid_${Date.now()}`;

    // Atualiza status do orçamento para 'sent'
    await dbQuery(
      `UPDATE quotes SET status = 'sent', updated_at = NOW() WHERE id = $1`,
      [quoteId]
    );

    // Registra na timeline de mensagens do CRM se houver conversationId
    let persistedMessage = null;
    try {
      if (quote.conversation_id) {
        persistedMessage = await messageRepository.createMessage({
          companyId,
          conversationId: quote.conversation_id,
          phone: cleanPhone,
          text: messageText,
          mediaType: 'quote',
          fromMe: true,
          status: 'sent',
          sessionId,
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          sender: 'human',
          direction: 'outgoing',
          whatsappMessageId,
          remoteJid: targetJid,
          type: 'quote',
        });
      }
    } catch (saveErr) {
      console.warn('[COMMERCE-QUOTE] Erro ao persistir mensagem de orçamento no CRM:', saveErr.message);
    }

    quote.status = 'sent';

    if (global.io) {
      global.io.emit('quote:sent', { quote, persistedMessage });
    }

    return {
      success: true,
      whatsappMessageId,
      quote,
      persistedMessage,
    };
  }

  /**
   * Aprova o orçamento e o converte automaticamente em pedido no CRM (`customer_orders`)
   */
  async acceptQuote(quoteId, { companyId = 'default', acceptedBy = 'client' } = {}) {
    const quote = await this.getQuote(quoteId, companyId);
    if (!quote) throw new Error(`Orçamento com ID "${quoteId}" não foi encontrado.`);

    if (quote.status === 'accepted' || quote.status === 'converted') {
      return { success: true, message: 'Orçamento já foi aceito anteriormente.', quote };
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const items = Array.isArray(quote.items) ? quote.items : JSON.parse(quote.items || '[]');
    const totalAmount1000 = Math.round(Number(quote.total_amount || 0) * 1000);

    // Cria registro na tabela oficial de pedidos customer_orders
    const insertOrderSql = `
      INSERT INTO customer_orders (
        id, company_id, order_id, conversation_id, phone,
        seller_jid, order_title, item_count, total_amount_1000,
        total_amount, currency, status, items, customer_notes,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, 'BRL', 'confirmed', $11::jsonb, $12,
        NOW(), NOW()
      ) RETURNING *;
    `;

    const orderRes = await dbQuery(insertOrderSql, [
      orderId,
      companyId,
      quote.quote_number,
      quote.conversation_id || null,
      quote.client_phone,
      '553193672075@s.whatsapp.net',
      `Pedido aprovado via Orçamento ${quote.quote_number}`,
      items.length,
      totalAmount1000,
      quote.total_amount,
      JSON.stringify(items),
      `Aprovado por: ${acceptedBy}. ${quote.notes || ''}`.trim(),
    ]);

    const createdOrder = orderRes.rows[0];

    // Atualiza status do orçamento
    await dbQuery(
      `UPDATE quotes SET status = 'accepted', order_id = $1, updated_at = NOW() WHERE id = $2`,
      [orderId, quoteId]
    );

    quote.status = 'accepted';
    quote.order_id = orderId;

    console.log(`[COMMERCE-QUOTE] Orçamento ${quote.quote_number} APROVADO! Convertido no pedido "${orderId}".`);

    // Envia mensagem de confirmação ao cliente no WhatsApp se tiver sessão conectada
    try {
      const session = sessionManager.getSession('main') || (sessionManager.getConnectedSessionOrNull ? sessionManager.getConnectedSessionOrNull() : null);
      if (session && session.sock) {
        const cleanPhone = String(quote.client_phone).replace(/\D/g, '');
        const targetJid = `${cleanPhone}@s.whatsapp.net`;
        const totalFmt = Number(quote.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const confirmMsg = `✅ *PEDIDO CONFIRMADO!*\n` +
          `Seu orçamento *${quote.quote_number}* foi aprovado com sucesso.\n` +
          `Valor Total: *${totalFmt}*\n\n` +
          `Nossa equipe já iniciou a separação dos seus materiais. Em breve enviaremos a previsão exata de entrega! 🚛💨`;

        await session.sock.sendMessage(targetJid, { text: confirmMsg });
      }
    } catch (msgErr) {
      console.warn('[COMMERCE-QUOTE] Aviso ao enviar confirmação de pedido para cliente:', msgErr.message);
    }

    if (global.io) {
      global.io.emit('quote:accepted', { quote, order: createdOrder });
      global.io.emit('order:created', createdOrder);
    }

    return {
      success: true,
      quote,
      order: createdOrder,
    };
  }

  /**
   * Recusa / cancela o orçamento
   */
  async rejectQuote(quoteId, { companyId = 'default', reason = '' } = {}) {
    const quote = await this.getQuote(quoteId, companyId);
    if (!quote) throw new Error(`Orçamento com ID "${quoteId}" não foi encontrado.`);

    await dbQuery(
      `UPDATE quotes SET status = 'rejected', notes = CONCAT(notes, ' [Recusado: ', $1::text, ']'), updated_at = NOW() WHERE id = $2`,
      [reason || 'Recusado pelo cliente', quoteId]
    );

    quote.status = 'rejected';

    if (global.io) {
      global.io.emit('quote:rejected', { quote, reason });
    }

    return { success: true, quote };
  }

  /**
   * Intercepta mensagens recebidas do cliente para detectar aprovação ou recusa automática de orçamento
   */
  async handleInboundClientResponse({ phone, text, companyId = 'default', conversationId }) {
    if (!phone || !text) return { handled: false };
    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanText = String(text).trim().toUpperCase();

    const approvalKeywords = ['APROVAR', 'ACEITAR', 'CONFIRMAR', 'SIM, PODE FECHAR', 'FECHAR PEDIDO', 'PODE MANDAR', 'APROVADO'];
    const rejectKeywords = ['CANCELAR', 'RECUSAR', 'NÃO QUERO', 'CANCELADO', 'DESISTIR'];

    const isApproval = approvalKeywords.some(kw => cleanText.includes(kw));
    const isReject = rejectKeywords.some(kw => cleanText.includes(kw));

    if (!isApproval && !isReject) return { handled: false };

    // Busca o orçamento em aberto mais recente para este cliente
    const res = await dbQuery(
      `SELECT * FROM quotes 
       WHERE company_id = $1 AND client_phone = $2 AND status IN ('sent', 'draft')
       ORDER BY created_at DESC LIMIT 1`,
      [companyId, cleanPhone]
    );

    if (res.rows.length === 0) return { handled: false };

    const targetQuote = res.rows[0];

    if (isApproval) {
      console.log(`[COMMERCE-QUOTE] Cliente ${cleanPhone} enviou "${cleanText}". Aprovando orçamento ${targetQuote.quote_number} automaticamente!`);
      const acceptRes = await this.acceptQuote(targetQuote.id, { companyId, acceptedBy: 'cliente via WhatsApp' });
      return { handled: true, action: 'accepted', quote: acceptRes.quote, order: acceptRes.order };
    }

    if (isReject) {
      console.log(`[COMMERCE-QUOTE] Cliente ${cleanPhone} enviou "${cleanText}". Cancelando orçamento ${targetQuote.quote_number}.`);
      const rejectRes = await this.rejectQuote(targetQuote.id, { companyId, reason: text });
      return { handled: true, action: 'rejected', quote: rejectRes.quote };
    }

    return { handled: false };
  }
}

module.exports = new CommerceQuoteEngine();
