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

  /**
   * GET /api/orchestrator/bridge/status/:sessionId?
   */
  async getBridgeStatus(req, res) {
    try {
      const sessionId = req.params.sessionId || req.query.sessionId || 'main';
      const webBridgeManager = require('../../../services/orchestrator/WebBridgeManager');
      const state = webBridgeManager.getSessionState(sessionId);
      return res.status(200).json({ success: true, ...state });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/orchestrator/bridge/qr/:sessionId?
   */
  async getBridgeQR(req, res) {
    try {
      const sessionId = req.params.sessionId || req.query.sessionId || 'main';
      const companyId = req.user?.companyId || req.query.companyId || 'default';
      const webBridgeManager = require('../../../services/orchestrator/WebBridgeManager');
      const qrData = await webBridgeManager.getOrCaptureQR(sessionId, companyId);
      return res.status(200).json({ success: true, ...qrData });
    } catch (err) {
      console.error('[ORCHESTRATOR-CONTROLLER] getBridgeQR failed:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/orchestrator/bridge/disconnect/:sessionId?
   */
  async disconnectBridge(req, res) {
    try {
      const sessionId = req.params.sessionId || req.body?.sessionId || 'main';
      const webBridgeManager = require('../../../services/orchestrator/WebBridgeManager');
      await webBridgeManager.closeSession(sessionId);
      const transportRegistry = require('../../../services/orchestrator/TransportRegistry');
      transportRegistry.deregisterTransport(sessionId, 'WHATSAPP_WEB_BRIDGE');
      return res.status(200).json({ success: true, message: `WebBridge session "${sessionId}" closed.` });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/orchestrator/bridge/view/:sessionId?
   * Serves an interactive dark-themed page to scan the WhatsApp Web QR Code
   */
  async renderBridgeView(req, res) {
    const sessionId = req.params.sessionId || req.query.sessionId || 'main';
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZAPFLOW — Conectar WhatsApp Web Bridge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #0b141a; color: #e9edef; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background-color: #111b21; border: 1px solid #202c33; border-radius: 16px; width: 100%; max-width: 480px; padding: 32px; text-align: center; box-shadow: 0 12px 36px rgba(0,0,0,0.6); }
    .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: #00a884; margin-bottom: 24px; }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #e9edef; }
    p.desc { font-size: 13px; color: #8696a0; margin-bottom: 24px; line-height: 1.5; }
    .qr-container { background-color: #ffffff; border-radius: 12px; padding: 16px; display: inline-flex; align-items: center; justify-content: center; min-height: 280px; min-width: 280px; margin-bottom: 20px; position: relative; }
    .qr-img { width: 256px; height: 256px; object-fit: contain; }
    .spinner { border: 4px solid #202c33; border-top: 4px solid #00a884; border-radius: 50%; width: 44px; height: 44px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .instructions { background-color: #182229; border: 1px solid #222e35; border-radius: 12px; padding: 16px; text-align: left; font-size: 12px; color: #8696a0; line-height: 1.6; margin-bottom: 24px; }
    .instructions ol { padding-left: 20px; }
    .instructions li { margin-bottom: 6px; }
    .instructions strong { color: #e9edef; }
    .btn { background-color: #00a884; color: #111b21; border: none; padding: 10px 20px; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
    .badge-waiting { background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-connected { background-color: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .success-icon { font-size: 56px; color: #00a884; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card" id="app">
    <div class="logo">⚡ ZAPFLOW UNIFIED ORCHESTRATOR</div>
    <span class="badge badge-waiting" id="statusBadge">Aguardando Leitura</span>
    <h1>Conectar WhatsApp Web Bridge</h1>
    <p class="desc">Aponte o WhatsApp do seu celular para este QR Code para ativar o navegador WhatsApp Web ao lado do Baileys.</p>

    <div class="qr-container" id="qrContainer">
      <div class="spinner" id="spinner"></div>
      <img id="qrImage" class="qr-img" style="display:none;" alt="QR Code WhatsApp Web" />
    </div>

    <div class="instructions">
      <ol>
        <li>Abra o <strong>WhatsApp</strong> no seu celular.</li>
        <li>Toque em <strong>Mais opções</strong> (⋮ ou Configurações) e selecione <strong>Aparelhos conectados</strong>.</li>
        <li>Toque em <strong>Conectar um aparelho</strong>.</li>
        <li>Aponte a câmera para esta tela para capturar o código.</li>
      </ol>
    </div>

    <button class="btn" onclick="fetchQR()">Atualizar QR Code</button>
  </div>

  <script>
    const sessionId = "${sessionId}";
    async function fetchQR() {
      const container = document.getElementById('qrContainer');
      const spinner = document.getElementById('spinner');
      const img = document.getElementById('qrImage');
      const badge = document.getElementById('statusBadge');
      spinner.style.display = 'block';
      img.style.display = 'none';

      try {
        const res = await fetch('/api/orchestrator/bridge/qr/' + sessionId);
        const data = await res.json();
        spinner.style.display = 'none';

        if (data.authenticated || data.status === 'connected') {
          badge.className = 'badge badge-connected';
          badge.innerText = 'Conectado com Sucesso';
          container.innerHTML = '<div class="success-icon">✓</div><h3 style="color:#111b21;font-weight:700;">WhatsApp Web Conectado!</h3><p style="color:#667781;font-size:12px;margin-top:8px;">Ambos Baileys e Web Bridge estão operando em paralelo.</p>';
          return;
        }

        if (data.qrImage) {
          img.src = data.qrImage;
          img.style.display = 'block';
        }
      } catch (err) {
        spinner.style.display = 'none';
        console.error('Fetch QR error:', err);
      }
    }

    fetchQR();
    // Poll status every 4 seconds
    setInterval(async () => {
      try {
        const res = await fetch('/api/orchestrator/bridge/status/' + sessionId);
        const data = await res.json();
        if (data.authenticated || data.status === 'ready' || data.status === 'connected') {
          const badge = document.getElementById('statusBadge');
          badge.className = 'badge badge-connected';
          badge.innerText = 'Conectado com Sucesso';
          const container = document.getElementById('qrContainer');
          container.innerHTML = '<div class="success-icon">✓</div><h3 style="color:#111b21;font-weight:700;">WhatsApp Web Conectado!</h3><p style="color:#667781;font-size:12px;margin-top:8px;">Ambos Baileys e Web Bridge estão operando em paralelo.</p>';
        }
      } catch (_) {}
    }, 4000);
  </script>
</body>
</html>`;
    return res.status(200).send(html);
  }
}

module.exports = new OrchestratorController();
