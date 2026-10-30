'use strict';

/**
 * OrchestratorController — ZAPFLOW Unified WhatsApp Orchestrator
 * Endpoints REST para inspeção de capacidades, telemetria, execução e pagamentos.
 */

const { orchestrator } = require('../../../services/orchestrator');

class OrchestratorController {
  /**
   * GET /api/orchestrator/capabilities
   */
  async getCapabilities(req, res) {
    try {
      const data = orchestrator.capabilityRegistry.getFullMatrix();
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/orchestrator/state/:sessionId?
   */
  async getConnectionState(req, res) {
    try {
      const sessionId = req.params.sessionId || req.query.sessionId || 'main';
      const data = orchestrator.getConnectionState(sessionId);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/orchestrator/health
   */
  async getHealth(req, res) {
    try {
      const data = orchestrator.getHealth();
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/orchestrator/execute
   */
  async executeOperation(req, res) {
    try {
      const { operation, payload = {}, sessionId = 'main', idempotencyKey } = req.body;
      const companyId = req.user?.companyId || req.body.companyId || 'default';

      if (!operation) {
        return res.status(400).json({ success: false, error: 'operation name is required.' });
      }

      const result = await orchestrator.execute(operation, payload, {
        companyId,
        sessionId,
        idempotencyKey,
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error('[ORCHESTRATOR-CONTROLLER] Operation execution failed:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/orchestrator/payments/create
   */
  async createPayment(req, res) {
    try {
      const companyId = req.user?.companyId || req.body.companyId || 'default';
      const payment = await orchestrator.paymentEngine.createPayment({
        ...req.body,
        companyId,
      });
      return res.status(201).json({ success: true, payment });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/orchestrator/payments/webhook
   */
  async handlePaymentWebhook(req, res) {
    try {
      const signature = req.headers['x-webhook-signature'] || req.headers['x-hub-signature'];
      const result = await orchestrator.paymentEngine.handleWebhook(req.body, signature);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/orchestrator/payments/:id
   */
  async getPayment(req, res) {
    try {
      const payment = orchestrator.paymentEngine.getPayment(req.params.id);
      if (!payment) return res.status(404).json({ success: false, error: 'Payment not found.' });
      return res.status(200).json({ success: true, payment });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new OrchestratorController();
