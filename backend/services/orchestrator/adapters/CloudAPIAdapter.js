'use strict';

/**
 * CloudAPIAdapter — ZAPFLOW Unified WhatsApp Orchestrator
 * Adaptador para WhatsApp Business Cloud API oficial da Meta.
 */

const axios = require('axios');

class CloudAPIAdapter {
  constructor() {
    this.name = 'CLOUD_API';
    this.apiVersion = 'v19.0';
    this.graphBaseUrl = 'https://graph.facebook.com';
  }

  isConfigured(context = {}) {
    const creds = context.cloudCredentials || {};
    return Boolean(creds.phoneNumberId && creds.accessToken);
  }

  async sendText(payload, context = {}) {
    const creds = context.cloudCredentials || {};
    if (!this.isConfigured(context)) {
      throw new Error('Meta Cloud API credentials are not configured for this account.');
    }

    const cleanPhone = (payload.phone || payload.to || '').replace(/\D/g, '');
    const url = `${this.graphBaseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: { body: payload.text || payload.message },
    };

    const resp = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      whatsappMessageId: resp.data?.messages?.[0]?.id,
      engine: this.name,
      raw: resp.data,
    };
  }

  async sendProduct(payload, context = {}) {
    const creds = context.cloudCredentials || {};
    if (!this.isConfigured(context)) {
      throw new Error('Meta Cloud API credentials are not configured for this account.');
    }

    const cleanPhone = (payload.phone || payload.to || '').replace(/\D/g, '');
    const url = `${this.graphBaseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    // Interactive product message structure
    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'interactive',
      interactive: {
        type: 'product',
        action: {
          catalog_id: creds.catalogId || payload.catalogId,
          product_retailer_id: payload.productId || payload.product?.code,
        },
        body: { text: payload.caption || payload.product?.name || 'Confira nosso produto' },
      },
    };

    const resp = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      whatsappMessageId: resp.data?.messages?.[0]?.id,
      engine: this.name,
      raw: resp.data,
    };
  }

  async sendOrder(payload, context = {}) {
    const creds = context.cloudCredentials || {};
    if (!this.isConfigured(context)) {
      throw new Error('Meta Cloud API credentials are not configured for this account.');
    }

    const cleanPhone = (payload.phone || payload.to || '').replace(/\D/g, '');
    const url = `${this.graphBaseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'interactive',
      interactive: {
        type: 'order_details',
        action: {
          name: 'review_and_pay',
          parameters: payload.parameters || {},
        },
      },
    };

    const resp = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      whatsappMessageId: resp.data?.messages?.[0]?.id,
      engine: this.name,
      raw: resp.data,
    };
  }

  getHealth(context = {}) {
    return {
      online: this.isConfigured(context),
      engine: this.name,
      configured: this.isConfigured(context),
      status: this.isConfigured(context) ? 'configured' : 'unconfigured',
    };
  }
}

module.exports = new CloudAPIAdapter();
