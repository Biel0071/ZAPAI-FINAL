'use strict';

const { query: dbQuery } = require('../../src/infrastructure/config/database');
const baileysCommerceAdapter = require('./BaileysCommerceAdapter');
const conversationRepository = require('../../src/data/repositories/conversationRepository');
const messageRepository = require('../../src/data/repositories/messageRepository');

class CartOrderListener {
  /**
   * Handle incoming Baileys orderMessage
   */
  async handleIncomingOrder(sock, messageData = {}, options = {}) {
    const rawMsg = messageData.message || {};
    const orderMsg =
      rawMsg.orderMessage ||
      rawMsg.ephemeralMessage?.message?.orderMessage ||
      rawMsg.viewOnceMessage?.message?.orderMessage ||
      rawMsg.viewOnceMessageV2?.message?.orderMessage;

    if (!orderMsg) return null;

    const companyId = options.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
    const remoteJid = messageData.key?.remoteJid || '';
    const phone = remoteJid.split('@')[0].replace(/\D/g, '');
    const orderId = String(orderMsg.orderId || `order_${Date.now()}`);
    const token = orderMsg.token ? Buffer.from(orderMsg.token).toString('base64') : (typeof orderMsg.token === 'string' ? orderMsg.token : null);
    const itemCount = Number(orderMsg.itemCount) || 1;
    const totalAmount1000 = Number(orderMsg.totalAmount1000) || 0;
    let totalAmount = totalAmount1000 > 0 ? (totalAmount1000 / 1000) : 0;
    const currency = orderMsg.totalCurrencyCode || 'BRL';
    const orderTitle = orderMsg.orderTitle || 'Pedido do Catálogo';
    const sellerJid = orderMsg.sellerJid || null;
    const customerNotes = orderMsg.message || '';

    console.log(`[CART-ORDER-LISTENER] Incoming order detected: orderId=${orderId}, items=${itemCount}, total=${currency} ${totalAmount}, phone=${phone}`);

    // Attempt to retrieve full itemized details from WhatsApp IQ
    let items = [];
    if (sock && orderId && token) {
      try {
        const details = await baileysCommerceAdapter.getOrderDetails(sock, orderId, token);
        if (details?.products && Array.isArray(details.products)) {
          items = details.products;
          if (details.price?.total) {
            totalAmount = Number(details.price.total);
          }
        }
      } catch (iqErr) {
        console.warn(`[CART-ORDER-LISTENER] getOrderDetails IQ query failed for order #${orderId}:`, iqErr.message);
      }
    }

    // Fallback item if IQ didn't return item list
    if (items.length === 0) {
      items = [
        {
          id: orderId,
          name: orderTitle,
          quantity: itemCount,
          price: totalAmount,
          currency,
        }
      ];
    }

    // Resolve or create conversation
    let conversationId = null;
    try {
      let conv = await conversationRepository.findByPhone(companyId, phone);
      if (!conv) {
        conv = await conversationRepository.createConversation({
          companyId,
          phone,
          status: 'open',
          source: 'whatsapp',
        });
      }
      conversationId = conv?.id || `conv_${phone}`;
    } catch (convErr) {
      console.warn('[CART-ORDER-LISTENER] Conversation resolve error:', convErr.message);
      conversationId = `conv_${phone}`;
    }

    // Persist into customer_orders table
    const orderRecordId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await dbQuery(
        `INSERT INTO customer_orders (
          id, company_id, order_id, conversation_id, phone, seller_jid,
          order_title, item_count, total_amount_1000, total_amount,
          currency, status, token, items, customer_notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          total_amount = EXCLUDED.total_amount,
          items = EXCLUDED.items,
          updated_at = NOW()`,
        [
          orderRecordId,
          companyId,
          orderId,
          conversationId,
          phone,
          sellerJid,
          orderTitle,
          itemCount,
          totalAmount1000,
          totalAmount,
          currency,
          'pending',
          token,
          JSON.stringify(items),
          customerNotes,
        ]
      );
    } catch (dbErr) {
      console.error('[CART-ORDER-LISTENER] Failed to insert customer_orders record:', dbErr.message);
    }

    // Persist message in conversation history
    const orderSummaryText = [
      `🛒 *NOVO PEDIDO RECEBIDO (#${orderId})*`,
      `Título: ${orderTitle}`,
      `Itens (${itemCount}):`,
      ...items.map(i => `• ${i.name || i.title} (${i.quantity || 1}x) - R$ ${(Number(i.price) || 0).toFixed(2)}`),
      `Total: ${currency} ${totalAmount.toFixed(2)}`,
      customerNotes ? `Observação: ${customerNotes}` : null,
    ].filter(Boolean).join('\n');

    let createdMessage = null;
    try {
      createdMessage = await messageRepository.createMessage({
        companyId,
        conversationId,
        phone,
        text: orderSummaryText,
        mediaType: 'order',
        mediaPath: null,
        fromMe: false,
        status: 'received',
        sessionId: options.sessionId || 'main',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        sender: phone,
        direction: 'inbound',
        whatsappMessageId: messageData.key?.id || `wamid_order_${orderId}`,
      });
    } catch (msgErr) {
      console.warn('[CART-ORDER-LISTENER] Failed to create message record for order:', msgErr.message);
    }

    const orderPayload = {
      id: orderRecordId,
      orderId,
      conversationId,
      phone,
      orderTitle,
      itemCount,
      totalAmount,
      currency,
      status: 'pending',
      items,
      customerNotes,
      createdAt: new Date().toISOString(),
      message: createdMessage,
    };

    // Broadcast to CRM via socket.io
    if (global.io) {
      global.io.to(`tenant:${companyId}`).emit('commerce:order_received', orderPayload);
      global.io.emit('new_message', createdMessage);
    }

    return orderPayload;
  }
}

module.exports = new CartOrderListener();
