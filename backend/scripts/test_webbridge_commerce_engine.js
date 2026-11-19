'use strict';

/**
 * Test Suite: WebBridge Commerce Engine & Native WhatsApp Quotes
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const webBridgeSessionManager = require('../services/webbridge/WebBridgeSessionManager');
const webCatalogExtractor = require('../services/webbridge/WebCatalogExtractor');
const commerceQuoteEngine = require('../services/commerce/CommerceQuoteEngine');
const zaiCommerceTools = require('../services/commerce/ZaiCommerceTools');
const productRepository = require('../src/data/repositories/productRepository');
const { query: dbQuery } = require('../src/infrastructure/config/database');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO TESTES DO WEBBRIDGE COMMERCE ENGINE');
  console.log('====================================================\n');

  // ── TESTE 1: WebBridgeSessionManager ───────────────────────────
  console.log('[TEST 1] Verificando WebBridgeSessionManager...');
  assert.strictEqual(webBridgeSessionManager.isPlaywrightAvailable, true, 'Playwright deve estar disponível');
  const chromiumPath = webBridgeSessionManager._resolveChromiumPath();
  console.log('  ✓ Playwright disponível: SIM');
  console.log('  ✓ Caminho do Chromium:', chromiumPath || '(detectado automaticamente pelo sistema)');

  const state = webBridgeSessionManager.getSessionState('test_session', 'test_company');
  assert.strictEqual(state.sessionId, 'test_session');
  assert.strictEqual(state.companyId, 'test_company');
  assert.strictEqual(typeof state.status, 'string');
  console.log('  ✓ getSessionState operacional e isolado por empresa.');

  const storageDir = webBridgeSessionManager.getStorageDir('test_company', 'test_session');
  assert(storageDir.includes('test_company'), 'Storage deve ser isolado por companyId');
  console.log('  ✓ Diretório de sessão persistente:', storageDir);
  console.log('  ✅ TESTE 1 PASSOU!\n');

  // ── TESTE 2: WebCatalogExtractor ───────────────────────────────
  console.log('[TEST 2] Verificando WebCatalogExtractor...');
  const catBloco = webCatalogExtractor._categorizeProduct('BLOCO 10 - 100 UN');
  assert.strictEqual(catBloco, 'Tijolos & Blocos');
  const catArg = webCatalogExtractor._categorizeProduct('ARGAMASSA - AC3');
  assert.strictEqual(catArg, 'Cimento & Argamassa');
  const catAreia = webCatalogExtractor._categorizeProduct('CAMINHÃO DE AREIA - 9M³');
  assert.strictEqual(catAreia, 'Agregados & Areia');
  console.log('  ✓ Categorização automática de materiais comprovada.');
  console.log('  ✅ TESTE 2 PASSOU!\n');

  // ── TESTE 3: CommerceQuoteEngine (Criação, Cálculos, Aprovação e Pedido) ──
  console.log('[TEST 3] Verificando CommerceQuoteEngine...');
  const testPhone = '5531999990001';
  const testItems = [
    {
      productId: 'prod_bloco_10_100un',
      code: 'BLOC-10-100',
      name: 'BLOCO 10 - 100 UN',
      unitPrice: 134.99,
      quantity: 2, // subtotal = 269.98
    },
    {
      productId: 'prod_argamassa_ac3',
      code: 'ARG-AC3-20',
      name: 'ARGAMASSA - AC3',
      unitPrice: 19.90,
      quantity: 5, // subtotal = 99.50
    },
  ];

  // Subtotal esperado: 269.98 + 99.50 = 369.48
  // Desconto: R$ 20.00
  // Frete: R$ 50.00
  // Total: 369.48 - 20.00 + 50.00 = 399.48
  const quote = await commerceQuoteEngine.createQuote({
    companyId: 'default',
    clientPhone: testPhone,
    clientName: 'Cliente Teste Engenharia',
    items: testItems,
    discountType: 'fixed',
    discountValue: 20.00,
    shippingAmount: 50.00,
    notes: 'Entregar na obra até quinta-feira',
  });

  assert(quote.id, 'Orçamento deve possuir ID');
  assert(quote.quote_number, 'Orçamento deve possuir código legível');
  assert.strictEqual(Number(quote.subtotal), 369.48, 'Subtotal incorreto');
  assert.strictEqual(Number(quote.discount_amount), 20.00, 'Desconto incorreto');
  assert.strictEqual(Number(quote.shipping_amount), 50.00, 'Frete incorreto');
  assert.strictEqual(Number(quote.total_amount), 399.48, 'Total incorreto');
  assert.strictEqual(quote.status, 'draft');
  console.log(`  ✓ Orçamento ${quote.quote_number} criado com sucesso! Subtotal: R$ ${quote.subtotal} | Total: R$ ${quote.total_amount}`);

  // Formatação de mensagem para WhatsApp
  const formattedText = commerceQuoteEngine.formatQuoteMessage(quote);
  assert(formattedText.includes(quote.quote_number), 'Mensagem deve conter número do orçamento');
  assert(formattedText.includes('BLOCO 10 - 100 UN'), 'Mensagem deve conter os itens');
  assert(formattedText.includes('APROVAR'), 'Mensagem deve instruir resposta APROVAR');
  console.log('  ✓ Mensagem oficial formatada com sucesso para WhatsApp.');

  // Teste de Aceite e Conversão Automática em Pedido (`customer_orders`)
  console.log('  → Testando aprovação e conversão em pedido...');
  const inboundRes = await commerceQuoteEngine.handleInboundClientResponse({
    phone: testPhone,
    text: 'Olá, pode APROVAR o pedido!',
    companyId: 'default',
  });

  assert.strictEqual(inboundRes.handled, true, 'Mensagem deve ser interceptada');
  assert.strictEqual(inboundRes.action, 'accepted', 'Ação deve ser accepted');
  assert(inboundRes.order, 'Deve criar pedido oficial no CRM');
  assert.strictEqual(inboundRes.order.order_title, `Pedido aprovado via Orçamento ${quote.quote_number}`);
  assert.strictEqual(Number(inboundRes.order.total_amount), 399.48);
  console.log(`  ✓ Pedido "${inboundRes.order.id}" gerado automaticamente na tabela customer_orders! Total: R$ ${inboundRes.order.total_amount}`);

  // Limpeza do teste
  await dbQuery(`DELETE FROM customer_orders WHERE id = $1`, [inboundRes.order.id]);
  await dbQuery(`DELETE FROM quotes WHERE id = $1`, [quote.id]);
  console.log('  ✓ Dados de teste higienizados do banco.');
  console.log('  ✅ TESTE 3 PASSOU!\n');

  // ── TESTE 4: ZaiCommerceTools para IA ─────────────────────────
  console.log('[TEST 4] Verificando ZaiCommerceTools para IA...');
  const tools = zaiCommerceTools.getToolDefinitions();
  assert(tools.length >= 6, 'Deve disponibilizar ferramentas completas');
  assert(tools.some(t => t.function.name === 'search_catalog'));
  assert(tools.some(t => t.function.name === 'create_quote'));
  assert(tools.some(t => t.function.name === 'calculate_shipping'));
  console.log(`  ✓ ${tools.length} ferramentas de IA registradas.`);

  const searchRes = await zaiCommerceTools.executeTool('search_catalog', { query: 'bloco' }, { companyId: 'default' });
  assert(searchRes.count >= 1, 'Deve encontrar bloco no catálogo real');
  console.log(`  ✓ search_catalog retornou ${searchRes.count} produtos reais.`);

  const shippingRes = await zaiCommerceTools.executeTool('calculate_shipping', { destination: 'Contagem', hasHeavyCargo: false });
  assert(shippingRes.estimatedShippingCost > 0, 'Frete deve ser calculado');
  console.log(`  ✓ calculate_shipping para ${shippingRes.destination}: R$ ${shippingRes.estimatedShippingCost}`);
  console.log('  ✅ TESTE 4 PASSOU!\n');

  console.log('====================================================');
  console.log('🎉 TODOS OS 4 TESTES PASSARAM COM SUCESSO ABSOLUTO!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch((e) => {
  console.error('❌ Falha nos testes:', e);
  process.exit(1);
});
