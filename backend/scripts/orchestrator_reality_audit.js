'use strict';

const crypto = require('crypto');
const http = require('http');

const secret = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';

function base64Url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const payload = base64Url(JSON.stringify({
  companyId: 'default',
  tenantId: 'default',
  email: 'zapadmin',
  role: 'admin',
  exp: Math.floor(Date.now() / 1000) + 3600
}));

const signature = crypto.createHmac('sha256', secret)
  .update(header + '.' + payload)
  .digest('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const token = header + '.' + payload + '.' + signature;

function request(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1',
      port: 4025,
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAudit() {
  console.log('=== REALITY AUDIT: UNIFIED WHATSAPP ORCHESTRATOR ON VPS ===\n');

  // 1. Health
  const health = await request('/api/health');
  console.log('1. /api/health: STATUS', health.status);
  console.log('   WhatsApp session:', JSON.stringify(health.data?.data?.system?.whatsapp || health.data?.whatsapp));

  // 2. Orchestrator Capabilities
  const orchCaps = await request('/api/orchestrator/capabilities');
  console.log('\n2. /api/orchestrator/capabilities: STATUS', orchCaps.status);
  console.log('   Capabilities data:', JSON.stringify(orchCaps.data?.data || orchCaps.data));

  // 3. Orchestrator Telemetry & Health
  const orchHealth = await request('/api/orchestrator/health');
  console.log('\n3. /api/orchestrator/health: STATUS', orchHealth.status);
  console.log('   Health data:', JSON.stringify(orchHealth.data?.data || orchHealth.data));

  // 4. Orchestrator Session State
  const orchState = await request('/api/orchestrator/state/main');
  console.log('\n4. /api/orchestrator/state/main: STATUS', orchState.status);
  console.log('   State data:', JSON.stringify(orchState.data?.data || orchState.data));

  // 5. Commerce Capabilities
  const commCaps = await request('/api/commerce/capabilities');
  console.log('\n5. /api/commerce/capabilities: STATUS', commCaps.status);
  console.log('   Commerce data:', JSON.stringify(commCaps.data));

  // 6. Products List Query
  const products = await request('/api/products');
  console.log('\n6. /api/products: STATUS', products.status);
  console.log('   Products count:', products.data?.data?.length || (Array.isArray(products.data) ? products.data.length : 'N/A'));
  if (Array.isArray(products.data?.data) && products.data.data.length > 0) {
    console.log('   Sample Product [0]:', products.data.data[0].id, '-', products.data.data[0].name, '- R$', products.data.data[0].price);
    console.log('   Sample Product [1]:', products.data.data[1].id, '-', products.data.data[1].name, '- R$', products.data.data[1].price);
  }

  // 7. Commerce Catalog Query
  const catalog = await request('/api/commerce/catalog');
  console.log('\n7. /api/commerce/catalog: STATUS', catalog.status);
  console.log('   Catalog products:', catalog.data?.data?.length || catalog.data?.products?.length || 'N/A');

  // 8. PaymentEngine Pix creation test
  const payment = await request('/api/orchestrator/payments/create', 'POST', {
    amount: 150.00,
    customerName: 'Cliente Teste Auditoria',
    customerPhone: '553198346078',
    description: '1 Milheiro Tijolo 8 Furos'
  });
  console.log('\n8. /api/orchestrator/payments/create: STATUS', payment.status);
  const createdPayment = payment.data?.payment;
  console.log('   Pix Payment ID:', createdPayment?.paymentId);
  console.log('   Pix Amount: R$', createdPayment?.amount);
  console.log('   Pix Status:', createdPayment?.status);
  console.log('   Pix Code generated:', createdPayment?.pixCode?.slice(0, 75) + '...');

  // 9. PaymentEngine Webhook confirmation test
  if (createdPayment?.paymentId) {
    const webhook = await request('/api/orchestrator/payments/webhook', 'POST', {
      paymentId: createdPayment.paymentId,
      status: 'paid',
      amount: 150.00
    });
    console.log('\n9. /api/orchestrator/payments/webhook: STATUS', webhook.status);
    console.log('   Webhook confirmation:', JSON.stringify(webhook.data));
  }

  // 10. Direct Orchestrator Execution of SEND_CATALOG
  const execCatalog = await request('/api/orchestrator/execute', 'POST', {
    operation: 'SEND_CATALOG',
    payload: { phone: '553198346078', url: 'https://wa.me/c/553193672075' },
    sessionId: 'main'
  });
  console.log('\n10. /api/orchestrator/execute (SEND_CATALOG): STATUS', execCatalog.status);
  console.log('    Engine selected:', execCatalog.data?.engine);
  console.log('    Operation:', execCatalog.data?.operation);
  console.log('    WhatsApp Message ID:', execCatalog.data?.whatsappMessageId);
  console.log('    Duration:', execCatalog.data?.durationMs, 'ms');

  // 11. Idempotency test (repeat exact request)
  const execDuplicate = await request('/api/orchestrator/execute', 'POST', {
    operation: 'SEND_CATALOG',
    payload: { phone: '553198346078', url: 'https://wa.me/c/553193672075', requestId: 'audit_idem_key_001' },
    sessionId: 'main',
    idempotencyKey: 'audit_idem_key_001'
  });
  const execDuplicateHit = await request('/api/orchestrator/execute', 'POST', {
    operation: 'SEND_CATALOG',
    payload: { phone: '553198346078', url: 'https://wa.me/c/553193672075', requestId: 'audit_idem_key_001' },
    sessionId: 'main',
    idempotencyKey: 'audit_idem_key_001'
  });
  console.log('\n11. Idempotency Protection:');
  console.log('    First run ID:', execDuplicate.data?.whatsappMessageId);
  console.log('    Duplicate run ID:', execDuplicateHit.data?.whatsappMessageId);
  console.log('    Matched exact cached result:', execDuplicate.data?.whatsappMessageId === execDuplicateHit.data?.whatsappMessageId);

  // 12. Direct Orchestrator Execution of SEND_PRODUCT (native product card)
  const execProduct = await request('/api/orchestrator/execute', 'POST', {
    operation: 'SEND_PRODUCT',
    payload: {
      phone: '553198346078',
      productId: 'prod_tijolo_12_furos',
    },
    sessionId: 'main'
  });
  console.log('\n12. /api/orchestrator/execute (SEND_PRODUCT): STATUS', execProduct.status);
  console.log('    Engine selected:', execProduct.data?.engine);
  console.log('    Operation:', execProduct.data?.operation);
  console.log('    WhatsApp Message ID:', execProduct.data?.whatsappMessageId || execProduct.data?.data?.whatsappMessageId);
  console.log('    Product sent:', execProduct.data?.product?.name || execProduct.data?.data?.product?.name);
  console.log('    Duration:', execProduct.data?.durationMs, 'ms');

  console.log('\n=== AUDIT COMPLETED ===');
}

runAudit().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
