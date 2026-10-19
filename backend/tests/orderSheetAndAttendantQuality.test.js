'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { query, pool } = require('../src/infrastructure/config/database');
const orderSheetService = require('../services/orderSheetService');
const attendantQualityDaemon = require('../services/attendantQualityDaemon');
const conversationRepository = require('../src/data/repositories/conversationRepository');

const TEST_TENANT = 'test-tenant-sheet-01';
const TEST_PHONE = '5511999998888';

async function cleanup() {
  try {
    await query(`DELETE FROM conversation_sheets WHERE company_id = $1`, [TEST_TENANT]);
    await query(`DELETE FROM messages WHERE company_id = $1`, [TEST_TENANT]);
    await query(`DELETE FROM conversations WHERE company_id = $1`, [TEST_TENANT]);
    await query(`DELETE FROM leads WHERE company_id = $1`, [TEST_TENANT]);
  } catch (_) {}
}

test.before(async () => {
  await cleanup();
});

test.after(async () => {
  await cleanup();
  try {
    await pool.end();
  } catch (_) {}
});

test('1. Extract sheet data and calculate pricing from customer messages', async () => {
  // Cria lead e conversa
  const leadRes = await query(
    `INSERT INTO leads (company_id, phone, name) VALUES ($1, $2, $3) RETURNING id`,
    [TEST_TENANT, TEST_PHONE, 'Carlos Eduardo']
  );
  const leadId = leadRes.rows[0].id;

  const convRes = await query(
    `INSERT INTO conversations (company_id, lead_id, remote_jid, status, lead_temperature, funnel_stage, ai_enabled)
     VALUES ($1, $2, $3, 'open', 'hot', 'negociacao', TRUE) RETURNING id`,
    [TEST_TENANT, leadId, `${TEST_PHONE}@s.whatsapp.net`]
  );
  const convId = convRes.rows[0].id;

  // Insere mensagens simulando o diálogo de compra do anúncio
  await query(
    `INSERT INTO messages (company_id, conversation_id, phone, text, from_me) VALUES
     ($1, $2, $3, 'Olá, vi o anúncio da caixa dagua de 5000 litros. Qual o valor?', FALSE),
     ($1, $2, $3, 'Olá Carlos! A caixa d''água de 5.000L sai por R$ 2.490 no PIX com entrega rápida. Para qual bairro seria?', TRUE),
     ($1, $2, $3, 'Sou do bairro Vila Hortência em Sorocaba, CEP 18020-000. Vou querer pagar no PIX à vista.', FALSE)`,
    [TEST_TENANT, convId, TEST_PHONE]
  );

  // Extrai dados da conversa
  const sheetData = await orderSheetService.extractSheetDataFromConversation(convId, TEST_TENANT);

  assert.ok(sheetData);
  assert.equal(sheetData.customerName, 'Carlos Eduardo');
  assert.ok(sheetData.deliveryAddress.includes('Vila Hortência'));
  assert.ok(sheetData.items.length >= 1);
  assert.equal(sheetData.paymentMethod, 'pix');
  assert.ok(sheetData.totalPrice >= 2000);

  // 2. Salva a ficha de pedido gerada
  const savedSheet = await orderSheetService.saveConversationSheet(sheetData, TEST_TENANT);
  assert.ok(savedSheet.id);
  assert.equal(savedSheet.status, 'generated');
  assert.ok(savedSheet.summary_text.includes('FICHA DE PEDIDO'));
  assert.ok(savedSheet.summary_text.includes('Carlos Eduardo'));
  assert.ok(savedSheet.summary_text.includes('PIX à Vista'));

  // 3. Consulta ficha por conversationId
  const fetchedSheet = await orderSheetService.getLatestSheetForConversation(convId, TEST_TENANT);
  assert.ok(fetchedSheet);
  assert.equal(fetchedSheet.id, savedSheet.id);

  // 4. Lista todas as fichas geradas da empresa
  const allSheets = await orderSheetService.listConversationSheets({ companyId: TEST_TENANT });
  assert.equal(allSheets.length, 1);
  assert.equal(allSheets[0].customer_name, 'Carlos Eduardo');
});

test('2. Finalize attendance with sheet: transitions tags, funnel, and pauses AI for human PIX operator', async () => {
  const convRes = await query(
    `SELECT id FROM conversations WHERE company_id = $1 LIMIT 1`,
    [TEST_TENANT]
  );
  const convId = convRes.rows[0].id;

  const finalizationResult = await orderSheetService.finalizeAttendanceWithSheet({
    conversationId: convId,
    companyId: TEST_TENANT,
  });

  assert.ok(finalizationResult.success);
  assert.equal(finalizationResult.sheet.status, 'aguarda_pix');

  // Verifica estado da conversa atualizada no PostgreSQL
  const updatedConv = await conversationRepository.getConversationById(convId);
  assert.ok(updatedConv);
  assert.equal(updatedConv.aiEnabled, false);
  assert.equal(updatedConv.funnel_stage, 'fechamento');
  assert.equal(updatedConv.status, 'aguarda_pix');

  const tags = updatedConv.tags || [];
  assert.ok(tags.includes('ficha_gerada'), 'Tags must include ficha_gerada');
  assert.ok(tags.includes('aguarda_pix'), 'Tags must include aguarda_pix');
  assert.ok(tags.includes('atendimento_finalizado'), 'Tags must include atendimento_finalizado');
});

test('3. Evaluate conversation quality and run analysis sweep', async () => {
  const convRes = await query(
    `SELECT * FROM conversations WHERE company_id = $1 LIMIT 1`,
    [TEST_TENANT]
  );
  const conv = convRes.rows[0];

  const messages = [
    { from_me: false, text: 'Meu nome é Roberto, quero a churrasqueira trio para o bairro Campolim em Sorocaba, pago no pix' }
  ];

  const evaluation = attendantQualityDaemon.evaluateConversationQuality(messages, conv);
  assert.ok(evaluation.score >= 80);
  assert.equal(evaluation.completeness, 100);
  assert.equal(evaluation.readyForOrderSheet, true);

  // Executa sweep completo
  const metrics = await attendantQualityDaemon.runAnalysisSweep({ companyId: TEST_TENANT });
  assert.ok(metrics.running);
  assert.ok(metrics.adTrafficActive);
  assert.ok(metrics.attendantQualityScore > 0);
  assert.ok(metrics.sheetsGeneratedCount >= 1);
  assert.equal(metrics.leadsBreakdown.finalizado >= 1, true);
});

test('4. Conversational revision: handles dynamic quantities and updated address in later messages', async () => {
  const leadRes = await query(
    `INSERT INTO leads (company_id, phone, name) VALUES ($1, $2, $3) RETURNING id`,
    [TEST_TENANT, '5511988887777', 'Mariana Silva']
  );
  const leadId = leadRes.rows[0].id;

  const convRes = await query(
    `INSERT INTO conversations (company_id, lead_id, remote_jid, status, lead_temperature, funnel_stage, ai_enabled)
     VALUES ($1, $2, $3, 'open', 'hot', 'negociacao', TRUE) RETURNING id`,
    [TEST_TENANT, leadId, '5511988887777@s.whatsapp.net']
  );
  const convId = convRes.rows[0].id;

  // Dialogo inicial com 1 caixa no Campolim
  await query(
    `INSERT INTO messages (company_id, conversation_id, phone, text, from_me, created_at) VALUES
     ($1, $2, $3, 'Oi, quero a caixa dagua 5000 litros no bairro Campolim', FALSE, NOW() - INTERVAL '5 minutes'),
     ($1, $2, $3, 'Olá Mariana! A caixa de 5.000L sai R$ 2.490 no PIX.', TRUE, NOW() - INTERVAL '4 minutes'),
     ($1, $2, $3, 'Mudei de ideia, quero duas caixas ao invés de uma e a entrega agora é no bairro Trujillo', FALSE, NOW() - INTERVAL '2 minutes')`,
    [TEST_TENANT, convId, '5511988887777']
  );

  const sheetData = await orderSheetService.extractSheetDataFromConversation(convId, TEST_TENANT);
  assert.ok(sheetData);
  assert.equal(sheetData.customerName, 'Mariana Silva');
  assert.ok(sheetData.deliveryAddress.includes('Trujillo'), 'Must adopt revised neighborhood Trujillo');
  assert.equal(sheetData.items[0].quantity, 2, 'Must detect 2 units from "duas caixas"');
  assert.equal(sheetData.items[0].totalPrice, 4980.00, 'Total price must be 2x unit price');

  // Salva ficha e verifica idempotência
  const sheet1 = await orderSheetService.saveConversationSheet(sheetData, TEST_TENANT);
  assert.ok(sheet1.id);
  const sheet2 = await orderSheetService.saveConversationSheet(sheetData, TEST_TENANT);
  assert.equal(sheet1.id, sheet2.id, 'Idempotent save must update existing open sheet without duplicate records');
});

test('5. Customer confirmation auto-finalization in attendantQualityDaemon sweep', async () => {
  const convRes = await query(
    `SELECT id FROM conversations WHERE company_id = $1 AND remote_jid = '5511988887777@s.whatsapp.net' LIMIT 1`,
    [TEST_TENANT]
  );
  const convId = convRes.rows[0].id;

  // Cliente envia mensagem confirmando o fechamento
  await query(
    `INSERT INTO messages (company_id, conversation_id, phone, text, from_me, created_at) VALUES
     ($1, $2, $3, 'Sim, confirmo! Pode agendar e mandar o pix para pagamento', FALSE, NOW())`,
    [TEST_TENANT, convId, '5511988887777']
  );

  // Executa o sweep do daemon
  await attendantQualityDaemon.runAnalysisSweep({ companyId: TEST_TENANT });

  // A conversa agora deve estar finalizada e AI pausada para atendente humano com PIX
  const updatedConv = await conversationRepository.getConversationById(convId);
  assert.ok(updatedConv);
  assert.equal(updatedConv.aiEnabled, false, 'AI must be disabled for human takeover');
  assert.equal(updatedConv.status, 'aguarda_pix');
  const tags = updatedConv.tags || [];
  assert.ok(tags.includes('aguarda_pix'));
  assert.ok(tags.includes('atendimento_finalizado'));
});

test('6. Dynamic order sheet: omits CPF, E-mail, and Reference when not provided by customer', async () => {
  const sheetWithoutOptionals = orderSheetService.buildSheetText({
    customerName: 'Tassio',
    phone: '+55 81 8190-4666',
    deliveryAddress: 'Rua Ruropoliz, nº 20',
    deliveryNeighborhood: 'Bela Vista 1',
    deliveryCity: 'Ipojuca',
    deliveryState: 'PE',
    deliveryCep: '55590-000',
    items: [{ item: "Caixa d'Água Fortlev 2000L", quantity: 1 }],
    productTotal: 499.00,
    freight: 65.12,
    orderTotal: 564.12,
    deliveryTime: '3 a 5 dias úteis',
    pixTotal: 539.17,
    installment10x: 56.41,
  });

  // Must contain base fields
  assert.ok(sheetWithoutOptionals.includes('Nome: Tassio'));
  assert.ok(sheetWithoutOptionals.includes('Telefone: +55 81 8190-4666'));
  assert.ok(sheetWithoutOptionals.includes('Endereço: Rua Ruropoliz, nº 20'));
  assert.ok(sheetWithoutOptionals.includes('Bairro: Bela Vista 1'));
  assert.ok(sheetWithoutOptionals.includes('Cidade: Ipojuca'));
  assert.ok(sheetWithoutOptionals.includes('Estado: PE'));
  assert.ok(sheetWithoutOptionals.includes('CEP: 55590-000'));
  assert.ok(sheetWithoutOptionals.includes("• Caixa d'Água Fortlev 2000L × 1"));
  assert.ok(sheetWithoutOptionals.includes('Valor dos Produtos:'));
  assert.ok(sheetWithoutOptionals.includes('Frete:'));
  assert.ok(sheetWithoutOptionals.includes('Total do Pedido:'));
  assert.ok(sheetWithoutOptionals.includes('Prazo de Entrega:'));
  assert.ok(sheetWithoutOptionals.includes('3 a 5 dias úteis'));
  assert.ok(sheetWithoutOptionals.includes('PIX à Vista:'));
  assert.ok(sheetWithoutOptionals.includes('Cartão: 10x sem juros de'));

  // Must NOT contain empty CPF, E-mail or Reference lines
  assert.ok(!sheetWithoutOptionals.includes('CPF:'));
  assert.ok(!sheetWithoutOptionals.includes('E-mail:'));
  assert.ok(!sheetWithoutOptionals.includes('Referência:'));

  // When provided, they MUST appear
  const sheetWithOptionals = orderSheetService.buildSheetText({
    customerName: 'Tassio',
    cpf: '123.456.789-00',
    phone: '+55 81 8190-4666',
    email: 'tassio@example.com',
    deliveryAddress: 'Rua Ruropoliz, nº 20',
    deliveryNeighborhood: 'Bela Vista 1',
    deliveryCity: 'Ipojuca',
    deliveryState: 'PE',
    deliveryCep: '55590-000',
    reference: 'Próximo ao mercado central',
    items: [{ item: "Caixa d'Água Fortlev 2000L", quantity: 1 }],
    productTotal: 499.00,
    freight: 65.12,
    orderTotal: 564.12,
  });

  assert.ok(sheetWithOptionals.includes('CPF: 123.456.789-00'));
  assert.ok(sheetWithOptionals.includes('E-mail: tassio@example.com'));
  assert.ok(sheetWithOptionals.includes('Referência: Próximo ao mercado central'));
});

test('7. Product keyword blacklist: prevents product mentions from polluting neighborhood or address', async () => {
  const convRes = await query(
    `INSERT INTO conversations (company_id, remote_jid, status, lead_temperature, funnel_stage, ai_enabled)
     VALUES ($1, '5511977776666@s.whatsapp.net', 'open', 'warm', 'negociacao', TRUE) RETURNING id`,
    [TEST_TENANT]
  );
  const convId = convRes.rows[0].id;

  // Cliente diz "entrega da churrasqueira trio" e depois passa o endereço real
  await query(
    `INSERT INTO messages (company_id, conversation_id, phone, text, from_me, created_at) VALUES
     ($1, $2, '5511977776666', 'Olá, quanto fica a entrega da churrasqueira trio para o bairro Boa Vista em Sorocaba/SP?', FALSE, NOW())`,
    [TEST_TENANT, convId]
  );

  const sheetData = await orderSheetService.extractSheetDataFromConversation(convId, TEST_TENANT);
  assert.ok(sheetData);
  assert.equal(sheetData.deliveryNeighborhood, 'Boa Vista', 'Neighborhood must be Boa Vista, not Churrasqueira Trio');
  assert.ok(!sheetData.deliveryAddress.toLowerCase().includes('churrasqueira'), 'Address must not contain product keyword');
});

test('8. ERP webhook integration: dispatchSheetToErp prepares payload and sends sync event', async () => {
  const convRes = await query(
    `SELECT id FROM conversations WHERE company_id = $1 LIMIT 1`,
    [TEST_TENANT]
  );
  const convId = convRes.rows[0].id;

  const result = await orderSheetService.dispatchSheetToErp({
    conversationId: convId,
    companyId: TEST_TENANT,
  });

  assert.ok(result.success);
  assert.equal(result.payload.event, 'erp.order_sheet.sync');
  assert.equal(result.payload.source, 'ZAI CRM');
  assert.ok(result.payload.sheet);
});

test('9. Empty/bugged delivery sanitization: omits delivery block completely from dispatch text while generating sheet with PIX and Cartão', async () => {
  const convRes = await query(
    `INSERT INTO conversations (company_id, remote_jid, status, lead_temperature, funnel_stage, ai_enabled)
     VALUES ($1, '5511966665555@s.whatsapp.net', 'open', 'warm', 'negociacao', TRUE)
     RETURNING id`,
    [TEST_TENANT]
  );
  const convId = convRes.rows[0].id;

  // Cliente apenas pergunta o valor da churrasqueira sem informar endereço
  await query(
    `INSERT INTO messages (company_id, conversation_id, phone, text, from_me, created_at) VALUES
     ($1, $2, '5511966665555', 'Boa tarde! Qual o valor da entrega da churrasqueira?', FALSE, NOW())`,
    [TEST_TENANT, convId]
  );

  const sheetData = await orderSheetService.extractSheetDataFromConversation(convId, TEST_TENANT);
  assert.ok(sheetData);
  assert.equal(sheetData.deliveryNeighborhood, '', 'Neighborhood must be empty, not product name');
  assert.equal(sheetData.deliveryCity, '', 'City must be empty, not product name');
  assert.equal(sheetData.deliveryAddress, '', 'Address must be empty, not product name');

  // Ficha é gerada normalmente com os itens
  const savedSheet = await orderSheetService.saveConversationSheet(sheetData, TEST_TENANT);
  assert.ok(savedSheet);
  assert.ok(savedSheet.summary_text);

  // O texto NÃO deve conter bloco de entrega nem 'A combinar'
  assert.ok(!savedSheet.summary_text.includes('📍 *Entrega*'));
  assert.ok(!savedSheet.summary_text.includes('A combinar com o atendente'));

  // O texto DEVE conter itens, totais, PIX e Cartão
  assert.ok(savedSheet.summary_text.includes('Churrasqueira Pré-Moldada Trio Completa'));
  assert.ok(savedSheet.summary_text.includes('PIX à Vista:'));
  assert.ok(savedSheet.summary_text.includes('Cartão: 10x sem juros de'));
});

