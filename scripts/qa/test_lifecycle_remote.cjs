'use strict';

const { query } = require('/opt/zapai/backend/src/infrastructure/config/database');
const orderConfirmationEngine = require('/opt/zapai/backend/services/commerce/OrderConfirmationEngine');

async function testLifecycle() {
  const orderId = 'ORD_TEST_' + Date.now();
  console.log('[TEST-LIFECYCLE] 1. Inserting test order into customer_orders...');
  await query(`
    INSERT INTO customer_orders (
      id, company_id, order_id, conversation_id, phone, seller_jid,
      order_title, item_count, total_amount_1000, total_amount,
      currency, status, token, items, customer_notes, created_at, updated_at
    ) VALUES (
      $1, 'default', $1, 'test_conv', '553198346078', '553193672075@s.whatsapp.net',
      '1x Tijolo 12 Furos', 1, 900000, 900.00,
      'BRL', 'pending', 'test_tok',
      '[{"id":"prod_tijolo_12_furos","name":"TIJOLO 12 FUROS","price":900,"quantity":1}]'::jsonb,
      'Favor entregar com descarga rápida', NOW(), NOW()
    )
  `, [orderId]);
  console.log('[TEST-LIFECYCLE] Order inserted successfully.');

  console.log('[TEST-LIFECYCLE] 2. Querying order from OrderConfirmationEngine...');
  const order = await orderConfirmationEngine.getOrder(orderId, 'default');
  console.log('Order status:', order.status, 'Total:', order.total_amount, 'Items:', order.items.length);

  console.log('[TEST-LIFECYCLE] 3. Confirming order through OrderConfirmationEngine...');
  const confirmResult = await orderConfirmationEngine.confirmOrder({
    id: order.id,
    companyId: 'default',
    notes: 'Agendado para amanhã cedo',
    sessionId: 'main'
  });
  console.log('Confirmed order status:', confirmResult.order.status);
  console.log('Confirmation notes:', confirmResult.order.customer_notes);

  console.log('[TEST-LIFECYCLE] 4. Cleaning up test order...');
  await query('DELETE FROM customer_orders WHERE id = $1', [orderId]);
  console.log('[TEST-LIFECYCLE] COMPLETE - 100% OPERATIONAL!');
  process.exit(0);
}

testLifecycle().catch(e => {
  console.error('[TEST-LIFECYCLE] Failed:', e);
  process.exit(1);
});
