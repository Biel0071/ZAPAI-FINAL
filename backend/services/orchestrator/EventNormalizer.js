'use strict';

/**
 * EventNormalizer — ZAPFLOW Unified WhatsApp Orchestrator
 * Unifica eventos de todos os motores (Baileys, WebBridge, CloudAPI, Payment)
 * com deduplicação rigorosa e envio uniforme ao CRM e Socket.IO.
 */

const EventEmitter = require('events');

class EventNormalizer extends EventEmitter {
  constructor() {
    super();
    this.seenEventIds = new Map(); // id -> timestamp
    this.dedupeTtlMs = 60 * 1000;  // 60 segundos de janela de deduplicação
    this._startDedupeCleaner();
  }

  _startDedupeCleaner() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, ts] of this.seenEventIds.entries()) {
        if (now - ts > this.dedupeTtlMs) {
          this.seenEventIds.delete(id);
        }
      }
    }, 30 * 1000).unref?.();
  }

  isDuplicate(eventId) {
    if (!eventId) return false;
    const now = Date.now();
    if (this.seenEventIds.has(eventId)) {
      return true;
    }
    this.seenEventIds.set(eventId, now);
    if (this.seenEventIds.size > 10000) {
      const first = this.seenEventIds.keys().next().value;
      this.seenEventIds.delete(first);
    }
    return false;
  }

  /**
   * Normaliza e emite evento MessageReceived
   */
  normalizeMessageReceived(engine, rawEvent, context = {}) {
    const messageId = String(rawEvent.id || rawEvent.key?.id || `msg_${Date.now()}`);
    if (this.isDuplicate(`in_${messageId}`)) {
      return null;
    }

    const normalized = {
      type: 'MessageReceived',
      engine,
      messageId,
      companyId: context.companyId || rawEvent.companyId || 'default',
      conversationId: context.conversationId || rawEvent.conversationId || null,
      phone: rawEvent.phone || rawEvent.from || rawEvent.remoteJid?.split('@')[0],
      remoteJid: rawEvent.remoteJid || rawEvent.from,
      sender: rawEvent.sender || 'client',
      text: rawEvent.text || rawEvent.body || '',
      mediaType: rawEvent.mediaType || 'text',
      mediaUrl: rawEvent.mediaUrl || null,
      timestamp: rawEvent.timestamp || new Date().toISOString(),
      rawPayload: rawEvent,
    };

    this.emit('event', normalized);
    this.emit('MessageReceived', normalized);
    return normalized;
  }

  /**
   * Normaliza e emite evento MessageSent
   */
  normalizeMessageSent(engine, rawEvent, context = {}) {
    const messageId = String(rawEvent.id || rawEvent.whatsappMessageId || rawEvent.key?.id || `out_${Date.now()}`);
    if (this.isDuplicate(`out_${messageId}`)) {
      return null;
    }

    const normalized = {
      type: 'MessageSent',
      engine,
      messageId,
      companyId: context.companyId || rawEvent.companyId || 'default',
      conversationId: context.conversationId || rawEvent.conversationId || null,
      phone: rawEvent.phone || rawEvent.to || rawEvent.remoteJid?.split('@')[0],
      remoteJid: rawEvent.remoteJid || rawEvent.to,
      sender: rawEvent.sender || 'human',
      text: rawEvent.text || rawEvent.caption || '',
      mediaType: rawEvent.mediaType || 'text',
      mediaUrl: rawEvent.mediaUrl || null,
      status: 'sent',
      timestamp: new Date().toISOString(),
      rawPayload: rawEvent,
    };

    this.emit('event', normalized);
    this.emit('MessageSent', normalized);
    return normalized;
  }

  /**
   * Normaliza e emite evento MessageDelivered / MessageRead
   */
  normalizeMessageAck(engine, messageId, status, rawEvent = {}) {
    const dedupeKey = `ack_${messageId}_${status}`;
    if (this.isDuplicate(dedupeKey)) return null;

    const normalized = {
      type: status === 'read' ? 'MessageRead' : 'MessageDelivered',
      engine,
      messageId,
      status,
      timestamp: new Date().toISOString(),
      rawPayload: rawEvent,
    };

    this.emit('event', normalized);
    this.emit(normalized.type, normalized);
    return normalized;
  }

  /**
   * Normaliza e emite evento ConnectionConnected / Disconnected
   */
  normalizeConnection(engine, sessionId, status, rawEvent = {}) {
    const dedupeKey = `conn_${engine}_${sessionId}_${status}`;
    if (this.isDuplicate(dedupeKey)) return null;

    const normalized = {
      type: status === 'connected' ? 'ConnectionConnected' : 'ConnectionDisconnected',
      engine,
      sessionId,
      status,
      timestamp: new Date().toISOString(),
      rawPayload: rawEvent,
    };

    this.emit('event', normalized);
    this.emit(normalized.type, normalized);
    return normalized;
  }

  /**
   * Normaliza e emite evento OrderCreated
   */
  normalizeOrderCreated(engine, order, context = {}) {
    const orderId = order.orderId || order.order_id || `ord_${Date.now()}`;
    const dedupeKey = `ord_${orderId}`;
    if (this.isDuplicate(dedupeKey)) return null;

    const normalized = {
      type: 'OrderCreated',
      engine,
      orderId,
      companyId: context.companyId || order.companyId || 'default',
      conversationId: context.conversationId || order.conversationId,
      phone: order.phone,
      totalAmount: order.totalAmount || order.total_amount,
      items: order.items || [],
      status: order.status || 'pending',
      timestamp: new Date().toISOString(),
      rawPayload: order,
    };

    this.emit('event', normalized);
    this.emit('OrderCreated', normalized);
    return normalized;
  }

  /**
   * Normaliza e emite eventos de Pagamento
   */
  normalizePayment(type, paymentData, context = {}) {
    const paymentId = paymentData.paymentId || paymentData.id || `pay_${Date.now()}`;
    const dedupeKey = `pay_${type}_${paymentId}`;
    if (this.isDuplicate(dedupeKey)) return null;

    const normalized = {
      type, // 'PaymentCreated', 'PaymentConfirmed', 'PaymentFailed', 'PaymentExpired'
      paymentId,
      orderId: paymentData.orderId,
      companyId: context.companyId || paymentData.companyId || 'default',
      amount: paymentData.amount,
      method: paymentData.method || 'pix',
      status: paymentData.status,
      timestamp: new Date().toISOString(),
      rawPayload: paymentData,
    };

    this.emit('event', normalized);
    this.emit(type, normalized);
    return normalized;
  }
}

module.exports = new EventNormalizer();
