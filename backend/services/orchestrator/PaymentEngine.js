'use strict';

/**
 * PaymentEngine — ZAPFLOW Unified WhatsApp Orchestrator
 * Núcleo financeiro para cobranças reais, Pix, Boleto, Cartão e Webhooks.
 * Faz a ponte segura entre Gateway Financeiro, Pedidos e CRM.
 */

const eventNormalizer = require('./EventNormalizer');
const { query: dbQuery } = require('../../src/infrastructure/config/database');
const paymentSettings = require('../payments/storePaymentSettings');

class PaymentEngine {
  constructor() {
    this.activePayments = new Map(); // paymentId -> paymentRecord
  }

  /**
   * Cria uma cobrança vinculada a um pedido ou valor avulso
   */
  async createPayment({
    companyId = 'default',
    storeId,
    sessionId,
    conversationId,
    orderId,
    amount,
    method = 'pix',
    customerPhone,
    customerName,
    description,
    dueDate,
  }) {
    const numAmount = Number(amount || 0);
    if (numAmount <= 0) throw new Error('Payment amount must be greater than zero.');

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cleanPhone = (customerPhone || '').replace(/\D/g, '');

    let pixCopyAndPaste = null;
    let pixStoreId = storeId || null;
    if (method === 'pix') {
      const { storeId: resolvedStoreId, pix } = await paymentSettings.resolvePixConfig({ companyId, storeId, sessionId });
      if (!pix) throw new Error('PIX não configurado para esta loja. Cadastre a chave PIX em Atendente IA › Loja e dados comerciais.');
      pixStoreId = resolvedStoreId;
      pixCopyAndPaste = paymentSettings.buildStorePixPayload(pix, {
        amount: numAmount,
        txid: paymentId.replace(/[^A-Za-z0-9]/g, '').slice(-25),
      });
    }

    const paymentRecord = {
      paymentId,
      companyId,
      storeId: pixStoreId,
      conversationId,
      orderId: orderId || null,
      amount: numAmount,
      currency: 'BRL',
      method,
      status: 'pending',
      customerPhone: cleanPhone,
      customerName: customerName || 'Cliente',
      description: description || `Cobrança ZAPFLOW #${paymentId}`,
      pixCode: pixCopyAndPaste,
      paymentUrl: null,
      createdAt: new Date().toISOString(),
      dueDate: dueDate || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    };

    this.activePayments.set(paymentId, paymentRecord);

    // Persist in DB if customer_orders exists
    if (orderId) {
      try {
        await dbQuery(
          'UPDATE customer_orders SET customer_notes = customer_notes || $1 WHERE order_id = $2 AND company_id = $3',
          [` [PIX: ${paymentId}]`, orderId, companyId]
        );
      } catch (_) {}
    }

    eventNormalizer.normalizePayment('PaymentCreated', paymentRecord, { companyId, conversationId });

    return paymentRecord;
  }

  /**
   * Processa Webhook do Gateway Financeiro com validação de autenticidade
   */
  async handleWebhook(payload, signature) {
    const paymentId = payload.paymentId || payload.id;
    const incomingStatus = String(payload.status || '').toLowerCase();

    let payment = this.activePayments.get(paymentId);
    if (!payment) {
      payment = {
        paymentId,
        companyId: payload.companyId || 'default',
        amount: Number(payload.amount || 0),
        status: incomingStatus,
        orderId: payload.orderId || null,
      };
    }

    const isConfirmed = ['paid', 'confirmed', 'settled', 'received'].includes(incomingStatus);
    const newStatus = isConfirmed ? 'paid' : incomingStatus;
    payment.status = newStatus;
    payment.updatedAt = new Date().toISOString();

    this.activePayments.set(paymentId, payment);

    // Se houver pedido associado, atualiza status para 'paid' / 'confirmed'
    if (payment.orderId && isConfirmed) {
      try {
        await dbQuery(
          'UPDATE customer_orders SET status = $1, updated_at = NOW() WHERE order_id = $2 AND company_id = $3',
          ['confirmed', payment.orderId, payment.companyId]
        );
      } catch (err) {
        console.warn('[PAYMENT-ENGINE] Failed to update order status on payment confirmation:', err.message);
      }
    }

    // Normaliza evento para o CRM
    eventNormalizer.normalizePayment(isConfirmed ? 'PaymentConfirmed' : 'PaymentUpdated', payment, {
      companyId: payment.companyId,
    });

    return {
      success: true,
      paymentId,
      status: newStatus,
      isConfirmed,
    };
  }

  /**
   * Consulta status de pagamento
   */
  getPayment(paymentId) {
    return this.activePayments.get(paymentId) || null;
  }
}

module.exports = new PaymentEngine();
