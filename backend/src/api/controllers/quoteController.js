'use strict';

const commerceQuoteEngine = require('../../../services/commerce/CommerceQuoteEngine');

class QuoteController {
  async createQuote(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const quote = await commerceQuoteEngine.createQuote({
        ...req.body,
        companyId,
      });
      return res.status(201).json({ success: true, quote });
    } catch (err) {
      console.error('[QUOTE-CONTROLLER] Erro ao criar orçamento:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async listQuotes(req, res) {
    try {
      const companyId = req.user?.companyId || req.query?.companyId || 'default';
      const { clientPhone, conversationId, status, limit } = req.query;
      const quotes = await commerceQuoteEngine.listQuotes({
        companyId,
        clientPhone,
        conversationId,
        status,
        limit,
      });
      return res.status(200).json({ success: true, quotes });
    } catch (err) {
      console.error('[QUOTE-CONTROLLER] Erro ao listar orçamentos:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async getQuote(req, res) {
    try {
      const companyId = req.user?.companyId || req.query?.companyId || 'default';
      const quote = await commerceQuoteEngine.getQuote(req.params.id, companyId);
      if (!quote) {
        return res.status(404).json({ success: false, error: 'Orçamento não encontrado.' });
      }
      return res.status(200).json({ success: true, quote });
    } catch (err) {
      console.error('[QUOTE-CONTROLLER] Erro ao buscar orçamento:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async sendQuote(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const sessionId = req.body?.sessionId || 'main';
      const result = await commerceQuoteEngine.sendQuote(req.params.id, { sessionId, companyId });
      return res.status(200).json(result);
    } catch (err) {
      console.error('[QUOTE-CONTROLLER] Erro ao enviar orçamento:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async acceptQuote(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const acceptedBy = req.user?.name || req.body?.acceptedBy || 'atendente';
      const result = await commerceQuoteEngine.acceptQuote(req.params.id, { companyId, acceptedBy });
      return res.status(200).json(result);
    } catch (err) {
      console.error('[QUOTE-CONTROLLER] Erro ao aprovar orçamento:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async rejectQuote(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const reason = req.body?.reason || '';
      const result = await commerceQuoteEngine.rejectQuote(req.params.id, { companyId, reason });
      return res.status(200).json(result);
    } catch (err) {
      console.error('[QUOTE-CONTROLLER] Erro ao recusar orçamento:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = new QuoteController();
