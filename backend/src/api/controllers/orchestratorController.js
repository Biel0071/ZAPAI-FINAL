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
    .qr-container { background-color: #ffffff; border-radius: 16px; padding: 16px; display: inline-flex; align-items: center; justify-content: center; min-height: 288px; min-width: 288px; margin-bottom: 20px; position: relative; box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
    .qr-wrapper { position: relative; width: 256px; height: 256px; display: none; }
    .qr-img { width: 256px; height: 256px; object-fit: contain; border-radius: 8px; }
    .qr-logo-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 54px; height: 54px; background: #ffffff; border-radius: 14px; border: 2px solid #000000; box-shadow: 0 4px 14px rgba(0,0,0,0.18); display: flex; align-items: center; justify-content: center; pointer-events: none; }
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
      <div class="qr-wrapper" id="qrWrapper">
        <img id="qrImage" class="qr-img" alt="QR Code WhatsApp Web" />
        <div class="qr-logo-badge">
          <svg viewBox="135 180 945 855" width="38" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 317 450 C 365 305, 500 212, 660 212 C 878 212, 1055 388, 1055 606.5 C 1055 824.5, 878 1001, 660 1001 C 586 1001, 517 980, 458 944 L 282 1004 C 268 1009, 259 997, 265 983 L 352 752 C 356 741, 369 737, 376 743 C 382 749, 382 759, 378 769 L 304 962 L 455 910 C 464 907, 472 909, 480 915 C 533 952, 595 973, 660 973 C 863 973, 1027 809, 1027 606.5 C 1027 404, 863 240, 660 240 C 507 240, 377 325, 317 450 Z" fill="#000000"/>
            <g>
              <circle cx="245" cy="500" r="20" stroke="#000000" stroke-width="14" fill="none" />
              <path d="M 268 492 H 442 L 479 530 H 457 L 434 507 H 268 Z" fill="#000000" />
              <circle cx="184" cy="590" r="19.5" stroke="#000000" stroke-width="13.5" fill="none" />
              <path d="M 207 583 H 395 L 411 600 L 592 609 L 402 613 L 386 597 H 207 Z" fill="#000000" />
              <circle cx="256" cy="680" r="19.5" stroke="#000000" stroke-width="13.5" fill="none" />
              <path d="M 279 673 L 532 681 L 279 689 Z" fill="#000000" />
            </g>
            <path d="M 530 424 H 852 C 884 424, 901 456, 880 482 L 559 852 H 485 C 461 852, 452 824, 469 804 L 720 515 H 526 C 499 515, 484 494, 484 470 C 484 443, 503 424, 530 424 Z" fill="#000000"/>
            <path d="M 671 758 H 870 C 871 798, 842 852, 795 852 H 588 L 671 758 Z" fill="#000000"/>
          </svg>
        </div>
      </div>
    </div>

    <div class="instructions">
      <ol>
        <li>Abra o <strong>WhatsApp</strong> no seu celular.</li>
        <li>Toque em <strong>Mais opções</strong> (⋮ ou Configurações) e selecione <strong>Aparelhos conectados</strong>.</li>
        <li>Toque em <strong>Conectar um aparelho</strong>.</li>
        <li>Aponte a câmera para este QR Code para conectar.</li>
      </ol>
    </div>

    <button class="btn" onclick="fetchQR()">Atualizar QR Code</button>
  </div>

  <script>
    const sessionId = "${sessionId}";
    let fetchAttempts = 0;

    async function fetchQR() {
      const container = document.getElementById('qrContainer');
      const spinner = document.getElementById('spinner');
      const wrapper = document.getElementById('qrWrapper');
      const img = document.getElementById('qrImage');
      const badge = document.getElementById('statusBadge');
      spinner.style.display = 'block';
      wrapper.style.display = 'none';
      fetchAttempts++;

      try {
        const res = await fetch('/api/orchestrator/bridge/qr/' + sessionId);
        const json = await res.json();
        const data = (json && json.data) ? json.data : json;

        if (data.authenticated === true || data.status === 'connected') {
          spinner.style.display = 'none';
          badge.className = 'badge badge-connected';
          badge.innerText = 'Conectado com Sucesso';
          container.innerHTML = '<div class="success-icon">✓</div><h3 style="color:#111b21;font-weight:700;">WhatsApp Web Conectado!</h3><p style="color:#667781;font-size:12px;margin-top:8px;">Ambos Baileys e Web Bridge estão operando em paralelo.</p><button class="btn" style="margin-top:16px;" onclick="syncCatalog()">Sincronizar Catálogo Real Agora</button><div id="syncResult" style="margin-top:12px;font-size:12px;color:#10b981;"></div>';
          return;
        }

        const qrSrc = data.qrImage || (data.data && data.data.qrImage);
        if (qrSrc) {
          img.src = qrSrc;
          spinner.style.display = 'none';
          wrapper.style.display = 'block';
          badge.className = 'badge badge-waiting';
          badge.innerText = 'Aguardando Leitura';
          fetchAttempts = 0;
        } else if (fetchAttempts < 10) {
          // Navegador ainda está inicializando na VPS, tenta novamente em 2 segundos
          badge.className = 'badge badge-waiting';
          badge.innerText = 'Iniciando WhatsApp Web...';
          setTimeout(fetchQR, 2000);
        } else {
          spinner.style.display = 'none';
          container.innerHTML = '<div style="color:#ef4444;font-size:13px;padding:20px;">Demorou para carregar o QR.<br><button class="btn" style="margin-top:12px;" onclick="fetchAttempts=0;fetchQR()">Tentar Novamente</button></div>';
        }
      } catch (err) {
        if (fetchAttempts < 5) {
          setTimeout(fetchQR, 2000);
        } else {
          spinner.style.display = 'none';
          console.error('Fetch QR error:', err);
          container.innerHTML = '<div style="color:#ef4444;font-size:13px;padding:20px;">Falha ao comunicar com o WebBridge.<br><button class="btn" style="margin-top:12px;" onclick="fetchAttempts=0;fetchQR()">Tentar Novamente</button></div>';
        }
      }
    }

    async function syncCatalog() {
      const resultDiv = document.getElementById('syncResult');
      if (resultDiv) resultDiv.innerText = 'Sincronizando produtos via interface do WhatsApp Web...';
      try {
        const res = await fetch('/api/webbridge/sync-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        const json = await res.json();
        const data = json.data || json;
        if (data.success) {
          if (resultDiv) resultDiv.innerHTML = '✓ ' + (data.total || data.upserted || 0) + ' produtos sincronizados no catálogo com sucesso!';
        } else {
          if (resultDiv) resultDiv.innerHTML = '<span style="color:#ef4444;">Falha: ' + (data.error || 'Erro') + '</span>';
        }
      } catch (e) {
        if (resultDiv) resultDiv.innerHTML = '<span style="color:#ef4444;">Erro de rede ao sincronizar.</span>';
      }
    }

    fetchQR();
    // Poll status every 3 seconds
    setInterval(async () => {
      try {
        const res = await fetch('/api/orchestrator/bridge/status/' + sessionId);
        const json = await res.json();
        const data = (json && json.data) ? json.data : json;
        if (data.authenticated === true || data.status === 'connected') {
          const badge = document.getElementById('statusBadge');
          if (badge) {
            badge.className = 'badge badge-connected';
            badge.innerText = 'Conectado com Sucesso';
          }
          const container = document.getElementById('qrContainer');
          if (container && !container.querySelector('.success-icon')) {
            container.innerHTML = '<div class="success-icon">✓</div><h3 style="color:#111b21;font-weight:700;">WhatsApp Web Conectado!</h3><p style="color:#667781;font-size:12px;margin-top:8px;">Ambos Baileys e Web Bridge estão operando em paralelo.</p><button class="btn" style="margin-top:16px;" onclick="syncCatalog()">Sincronizar Catálogo Real Agora</button><div id="syncResult" style="margin-top:12px;font-size:12px;color:#10b981;"></div>';
          }
        } else if (data.status === 'waiting_scan' || data.status === 'launching') {
          const badge = document.getElementById('statusBadge');
          if (badge && !badge.classList.contains('badge-waiting')) {
            badge.className = 'badge badge-waiting';
            badge.innerText = 'Aguardando Leitura';
          }
          if (data.qrImage) {
            const img = document.getElementById('qrImage');
            const wrapper = document.getElementById('qrWrapper');
            const spinner = document.getElementById('spinner');
            if (img && img.src !== data.qrImage) {
              img.src = data.qrImage;
            }
            if (wrapper) wrapper.style.display = 'block';
            if (spinner) spinner.style.display = 'none';
          }
        }
      } catch (_) {}
    }, 3000);
  </script>
</body>
</html>`;
    return res.status(200).send(html);
  }
}

module.exports = new OrchestratorController();
