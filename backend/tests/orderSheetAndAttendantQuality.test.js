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
