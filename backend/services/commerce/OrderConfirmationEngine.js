'use strict';

const { query: dbQuery } = require('../../src/infrastructure/config/database');
const baileysCommerceAdapter = require('./BaileysCommerceAdapter');
const sessionManager = require('../sessionManager');
const messageRepository = require('../../src/data/repositories/messageRepository');

class OrderConfirmationEngine {
  /**
   * List customer orders with filters
   */
  async listOrders(companyId = 'default', query = {}) {
    const params = [companyId];
    let sql = 'SELECT * FROM customer_orders WHERE company_id = $1';

    if (query.conversationId) {
      params.push(query.conversationId);
      sql += ` AND conversation_id = $${params.length}`;
    }

    if (query.phone) {
      params.push(query.phone.replace(/\D/g, ''));
      sql += ` AND phone LIKE '%' || $${params.length} || '%'`;
    }

    if (query.status && query.status !== 'all') {
      params.push(query.status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    const res = await dbQuery(sql, params);
    return {
      orders: res.rows || [],
      total: res.rows?.length || 0,
    };
  }

  /**
   * Get single order by primary ID or Meta order_id
   */
  async getOrder(idOrOrderId, companyId = 'default') {
    const res = await dbQuery(
      'SELECT * FROM customer_orders WHERE (id = $1 OR order_id = $1) AND company_id = $2 LIMIT 1',
      [idOrOrderId, companyId]
    );
    return res.rows?.[0] || null;
  }

  /**
   * Create an order directly from catalog items and dispatch to WhatsApp
   */
  async createOrder({
    companyId = 'default',
    conversationId,
    phone,
    customerName,
    items = [],
    freight = 0,
    discount = 0,
    notes = '',
    sessionId = 'main',
  }) {
    if (!phone) throw new Error('Customer phone is required.');
    if (!Array.isArray(items) || items.length === 0) throw new Error('At least one order item is required.');

    const cleanPhone = phone.replace(/\D/g, '');
    const targetJid = `${cleanPhone}@s.whatsapp.net`;
    const orderId = `ORD_${Date.now().toString().slice(-6)}`;
    const recordId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const subtotal = items.reduce((sum, it) => sum + (Number(it.price || 0) * (Number(it.quantity) || 1)), 0);
    const totalAmount = Math.max(0, subtotal + Number(freight || 0) - Number(discount || 0));
    const totalAmount1000 = Math.round(totalAmount * 1000);

    // 1. Insert into customer_orders
    const insertSql = `
      INSERT INTO customer_orders (
        id, company_id, conversation_id, phone, order_id, order_title,
        items, item_count, total_amount_1000, total_amount, currency, status, customer_notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *
    `;

    const orderTitle = `Pedido #${orderId} - Depósito Vista Alegre`;

    const insertRes = await dbQuery(insertSql, [
      recordId,
      companyId,
      conversationId || null,
      cleanPhone,
      orderId,
      orderTitle,
      JSON.stringify(items),
      items.length,
      totalAmount1000,
      totalAmount,
      'BRL',
      'pending',
      notes || null,
    ]);

    const createdOrder = insertRes.rows[0];

    // 2. Dispatch to WhatsApp via Baileys
    const session = sessionManager.getSession(sessionId);
    const sock = session?.sock;
    let whatsappResult = null;
    let persistedMsg = null;

    if (sock) {
      try {
        whatsappResult = await baileysCommerceAdapter.sendOrder(sock, targetJid, {
          orderId,
          orderTitle,
          items,
          subtotal,
          freight,
          discount,
          totalAmount,
          notes,
          customerName,
        }, { sessionId });

        // Save order message in CRM conversation
        if (conversationId) {
          const itemsSummary = items.map(it => `• ${it.name} (${it.quantity || 1}x) - R$ ${(Number(it.price || 0) * (Number(it.quantity) || 1)).toFixed(2)}`).join('\n');
          const messageText = `🛒 *PEDIDO GERADO #${orderId}*\n━━━━━━━━━━━━━━━━━━━━━━\n${itemsSummary}\n━━━━━━━━━━━━━━━━━━━━━━\n💰 Subtotal: R$ ${subtotal.toFixed(2)}\n🚚 Frete: R$ ${Number(freight || 0).toFixed(2)}\n💵 *Total: R$ ${totalAmount.toFixed(2)}*${notes ? `\n📝 Obs: ${notes}` : ''}`;

          persistedMsg = await messageRepository.createMessage({
            companyId,
            conversationId,
            phone: cleanPhone,
            text: messageText,
            mediaType: 'order',
            mediaPath: null,
            fromMe: true,
            status: 'sent',
            sessionId,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            sender: 'human',
            direction: 'outbound',
            whatsappMessageId: whatsappResult?.key?.id || `wamid_order_${orderId}`,
          });

          if (global.io) {
            global.io.to(`tenant:${companyId}`).emit('new_message', {
              ...persistedMsg,
              order: createdOrder,
            });
            global.io.to(`tenant:${companyId}`).emit('commerce:order_created', {
              order: createdOrder,
              conversationId,
            });
          }
        }
      } catch (err) {
        console.warn('[ORDER-ENGINE] WhatsApp order dispatch warning:', err.message);
      }
    }

    return {
      success: true,
      order: createdOrder,
      whatsappResult,
      persistedMsg,
    };
  }

  /**
   * Confirm order and dispatch official message to customer
   */
  async confirmOrder({ id, orderId, companyId = 'default', notes = '', sessionId = 'main' }) {
    const order = await this.getOrder(id || orderId, companyId);
    if (!order) {
      throw new Error(`Order not found: ${id || orderId}`);
    }

    const session = sessionManager.getSession(sessionId);
    const sock = session?.sock;

    // Update status in DB
    await dbQuery(
      `UPDATE customer_orders 
       SET status = 'confirmed', customer_notes = COALESCE(customer_notes, '') || ' ' || $1, updated_at = NOW() 
       WHERE id = $2 AND company_id = $3`,
      [notes ? `[Atendente: ${notes}]` : '', order.id, companyId]
    );
    order.status = 'confirmed';

    let confirmationMsg = null;
    if (sock && order.phone) {
      try {
        const targetJid = `${order.phone.replace(/\D/g, '')}@s.whatsapp.net`;
        const result = await baileysCommerceAdapter.confirmOrder(sock, targetJid, order, { notes });

        if (order.conversation_id) {
          confirmationMsg = await messageRepository.createMessage({
            companyId,
            conversationId: order.conversation_id,
            phone: order.phone,
            text: `✅ Pedido #${order.order_id || order.id} CONFIRMADO com sucesso!`,
            mediaType: 'order_status',
            mediaPath: null,
            fromMe: true,
            status: 'sent',
            sessionId,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            sender: 'human',
            direction: 'outbound',
            whatsappMessageId: result?.key?.id || `wamid_conf_${order.id}`,
          });
        }
      } catch (err) {
        console.warn('[ORDER-CONFIRMATION-ENGINE] Failed to send WhatsApp confirmation:', err.message);
      }
    }

    const updatedOrder = await this.getOrder(order.id, companyId);

    // Notify CRM
    if (global.io) {
      global.io.to(`tenant:${companyId}`).emit('commerce:order_updated', updatedOrder);
      if (confirmationMsg) {
        global.io.emit('new_message', confirmationMsg);
      }
    }

    return {
      success: true,
      order: updatedOrder,
      message: confirmationMsg,
    };
  }

  /**
   * Reject order and dispatch notification to customer
   */
  async rejectOrder({ id, orderId, companyId = 'default', reason = '', sessionId = 'main' }) {
    const order = await this.getOrder(id || orderId, companyId);
    if (!order) {
      throw new Error(`Order not found: ${id || orderId}`);
    }

    const session = sessionManager.getSession(sessionId);
    const sock = session?.sock;

    // Update status in DB
    await dbQuery(
      `UPDATE customer_orders 
       SET status = 'rejected', customer_notes = COALESCE(customer_notes, '') || ' ' || $1, updated_at = NOW() 
       WHERE id = $2 AND company_id = $3`,
      [reason ? `[Recusado: ${reason}]` : '[Recusado]', order.id, companyId]
    );
    order.status = 'rejected';

    let rejectMsg = null;
    if (sock && order.phone) {
      try {
        const targetJid = `${order.phone.replace(/\D/g, '')}@s.whatsapp.net`;
        const result = await baileysCommerceAdapter.rejectOrder(sock, targetJid, order, reason);

        if (order.conversation_id) {
          rejectMsg = await messageRepository.createMessage({
            companyId,
            conversationId: order.conversation_id,
            phone: order.phone,
            text: `⚠️ Pedido #${order.order_id || order.id} RECUSADO. Motivo: ${reason || 'Indisponível no momento'}`,
            mediaType: 'order_status',
            mediaPath: null,
            fromMe: true,
            status: 'sent',
            sessionId,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            sender: 'human',
            direction: 'outbound',
            whatsappMessageId: result?.key?.id || `wamid_rej_${order.id}`,
          });
        }
      } catch (err) {
        console.warn('[ORDER-CONFIRMATION-ENGINE] Failed to send WhatsApp rejection:', err.message);
      }
    }

    const updatedOrder = await this.getOrder(order.id, companyId);

    // Notify CRM
    if (global.io) {
      global.io.to(`tenant:${companyId}`).emit('commerce:order_updated', updatedOrder);
      if (rejectMsg) {
        global.io.emit('new_message', rejectMsg);
      }
    }

    return {
      success: true,
      order: updatedOrder,
      message: rejectMsg,
    };
  }
}

module.exports = new OrderConfirmationEngine();
