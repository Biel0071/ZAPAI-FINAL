'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const QRCode = require('qrcode');

const JWT_SECRET = process.env.JWT_SECRET || '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';

function generateAdminToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId: 1,
    role: 'admin',
    tenantId: 'default',
    companyId: 'default',
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path,
      method,
      headers,
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout: ' + path));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const token = generateAdminToken();
  const sessionId = 'main';

  console.log('==================================================');
  console.log('🔄 INICIANDO DESCONEXÃO E REINICIALIZAÇÃO DO WHATSAPP');
  console.log('==================================================');

  // 1. Fechar Web Bridge se ativo
  console.log('[1/4] Desconectando Web Bridge...');
  try {
    const bridgeResp = await apiRequest('POST', `/api/orchestrator/bridge/disconnect/${sessionId}`, {}, token);
    console.log('Web Bridge disconnect:', bridgeResp.body);
  } catch (err) {
    console.warn('Web Bridge disconnect notice:', err.message);
  }

  // 2. Desconectar e fazer logout do Baileys
  console.log('[2/4] Desconectando e limpando sessão Baileys...');
  try {
    const logoutResp = await apiRequest('POST', '/sessions/logout', { sessionId }, token);
    console.log('Baileys logout:', logoutResp.body);
  } catch (err) {
    console.warn('Baileys logout notice:', err.message);
  }

  // Esperar limpeza de arquivos e garbage collection
  await sleep(2000);

  // Garantir que a pasta de sessão não tenha creds residuais
  const sessionDir = path.join(__dirname, '..', 'sessions', sessionId);
  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log('Pasta de sessão removida com sucesso:', sessionDir);
    } catch (e) {
      console.warn('Aviso ao remover pasta de sessão:', e.message);
    }
  }

  // 3. Reiniciar a sessão Baileys para gerar novo QR Code
  console.log('[3/4] Iniciando nova sessão limpa...');
  try {
    const restartResp = await apiRequest('POST', '/sessions/start', { sessionId }, token);
    console.log('Baileys start:', restartResp.body);
  } catch (err) {
    console.warn('Baileys start notice:', err.message);
  }

  // 4. Polling do QR Code gerado pelo Baileys
  console.log('[4/4] Aguardando geração do novo QR Code pelo Baileys...');
  let qrCodeStr = null;
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    try {
      const qrResp = await apiRequest('GET', `/sessions/qr?sessionId=${sessionId}`, null, token);
      if (qrResp.body?.qr) {
        qrCodeStr = qrResp.body.qr;
        console.log(`✅ QR Code Baileys obtido com sucesso na tentativa ${i + 1}!`);
        break;
      }
    } catch (err) {
      // aguardar próxima tentativa
    }
  }

  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  if (qrCodeStr) {
    const qrPngPath = path.join(assetsDir, 'live_baileys_qr.png');
    await QRCode.toFile(qrPngPath, qrCodeStr, {
      width: 450,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    console.log('✅ Imagem PNG do QR Code salva em:', qrPngPath);
    console.log('QR Code String:', qrCodeStr);
  } else {
    console.warn('⚠️ Não foi possível capturar o QR Code nos primeiros 30 segundos. Verifique o status da sessão.');
  }

  // Agora capturar o QR Code do WhatsApp Web Bridge também
  console.log('Iniciando captura do QR Code do Web Bridge...');
  try {
    const bridgeQrResp = await apiRequest('GET', `/api/orchestrator/bridge/qr/${sessionId}`, null, token);
    if (bridgeQrResp.body?.qr) {
      const b64Data = bridgeQrResp.body.qr.replace(/^data:image\/\w+;base64,/, '');
      const bridgePngPath = path.join(assetsDir, 'live_web_bridge_qr.png');
      fs.writeFileSync(bridgePngPath, Buffer.from(b64Data, 'base64'));
      console.log('✅ Imagem PNG do QR Code Web Bridge salva em:', bridgePngPath);
    }
  } catch (bridgeErr) {
    console.warn('Web Bridge QR capture notice:', bridgeErr.message);
  }

  console.log('==================================================');
  console.log('🎉 PROCESSO CONCLUÍDO COM SUCESSO');
  console.log('==================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
