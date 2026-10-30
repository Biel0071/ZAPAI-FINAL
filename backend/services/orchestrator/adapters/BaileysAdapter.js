'use strict';

/**
 * BaileysAdapter — ZAPFLOW Unified WhatsApp Orchestrator
 * Motor Principal Leve para Mensagens, Mídias, Histórico e Comércio Protobuf.
 */

const sessionManager = require('../../sessionManager');
const baileysCommerceAdapter = require('../../commerce/BaileysCommerceAdapter');
const nativeProductSender = require('../../commerce/NativeProductSender');
const { ensureWhatsAppJid } = require('../../whatsapp/shared/identifiers');

class BaileysAdapter {
  constructor() {
    this.name = 'BAILEYS';
  }

  /**
   * Resolves socket from context or session manager
   */
  resolveSocket(context = {}) {
    if (context.sock) return context.sock;
    const requestedId = context.sessionId || 'main';

    const session =
      sessionManager.getSession(requestedId) ||
      (sessionManager.getConnectedSessionOrNull ? sessionManager.getConnectedSessionOrNull() : null) ||
      sessionManager.getSession('main') ||
      sessionManager.getSession('default');

    if (!session || !session.sock) {
      throw new Error(`Baileys session "${requestedId}" is not connected.`);
    }

    return session.sock;
  }

  /**
   * Send plain text message
   */
  async sendText(payload, context = {}) {
    const sock = this.resolveSocket(context);
    const targetJid = ensureWhatsAppJid(payload.phone || payload.remoteJid || payload.to);
    if (!targetJid) throw new Error('Target JID or phone number is required.');

    const text = String(payload.text || payload.message || '').trim();
    if (!text) throw new Error('Message text cannot be empty.');

    const sendResult = await sock.sendMessage(targetJid, { text });
    return {
      success: true,
      whatsappMessageId: sendResult?.key?.id,
      key: sendResult?.key,
      raw: sendResult,
    };
  }

  /**
   * Send media (image, audio, video, document)
   */
  async sendMedia(payload, context = {}) {
    const sock = this.resolveSocket(context);
    const targetJid = ensureWhatsAppJid(payload.phone || payload.remoteJid || payload.to);
    if (!targetJid) throw new Error('Target JID or phone number is required.');

    const { mediaBuffer, mediaUrl, mediaType = 'image', caption, fileName, mimetype, ptt } = payload;
    let messageContent = {};

    const mediaSource = mediaBuffer ? mediaBuffer : (mediaUrl ? { url: mediaUrl } : null);
    if (!mediaSource) throw new Error('Media source (buffer or URL) is required.');

    if (mediaType === 'image') {
      messageContent = { image: mediaSource, caption };
    } else if (mediaType === 'audio') {
      messageContent = { audio: mediaSource, mimetype: mimetype || 'audio/mp4', ptt: Boolean(ptt) };
    } else if (mediaType === 'video') {
      messageContent = { video: mediaSource, caption };
    } else {
      messageContent = { document: mediaSource, fileName: fileName || 'document', mimetype: mimetype || 'application/octet-stream', caption };
    }

    const sendResult = await sock.sendMessage(targetJid, messageContent);
    return {
      success: true,
      whatsappMessageId: sendResult?.key?.id,
      key: sendResult?.key,
      raw: sendResult,
    };
  }

  /**
   * Send authentic native WhatsApp product message
   */
  async sendProduct(payload, context = {}) {
    const sock = this.resolveSocket(context);
    return await nativeProductSender.send(sock, {
      phone: payload.phone,
      remoteJid: payload.remoteJid,
      productId: payload.productId,
      product: payload.product,
      companyId: context.companyId || payload.companyId || 'default',
      conversationId: context.conversationId || payload.conversationId,
      caption: payload.caption,
      options: { sessionId: context.sessionId || 'main' },
    });
  }

  /**
   * Send authentic native WhatsApp order message with receipt
   */
  async sendOrder(payload, context = {}) {
    const sock = this.resolveSocket(context);
    const targetJid = ensureWhatsAppJid(payload.phone || payload.remoteJid || payload.to);
    return await baileysCommerceAdapter.sendOrder(sock, targetJid, payload.orderData || payload, {
      sessionId: context.sessionId || 'main',
      businessOwnerPhone: payload.businessOwnerPhone,
    });
  }

  /**
   * Send catalog link message
   */
  async sendCatalog(payload, context = {}) {
    const sock = this.resolveSocket(context);
    const targetJid = ensureWhatsAppJid(payload.phone || payload.remoteJid || payload.to);
    const storeUrl = payload.url || 'https://wa.me/c/553193672075';
    const text = payload.text || `🏪 *[CATÁLOGO OFICIAL]*\nAcesse nossa loja completa no WhatsApp:\n👉 ${storeUrl}`;
    const sendResult = await sock.sendMessage(targetJid, { text });
    return {
      success: true,
      whatsappMessageId: sendResult?.key?.id,
      key: sendResult?.key,
    };
  }

  /**
   * Health status of Baileys socket
   */
  getHealth(context = {}) {
    try {
      const sock = this.resolveSocket(context);
      const isConnected = Boolean(sock?.user && sock?.ws && sock.ws.readyState === 1);
      return {
        online: isConnected,
        engine: this.name,
        user: sock?.user?.id || null,
        status: isConnected ? 'connected' : 'disconnected',
      };
    } catch (e) {
      return {
        online: false,
        engine: this.name,
        error: e.message,
        status: 'disconnected',
      };
    }
  }
}

module.exports = new BaileysAdapter();
