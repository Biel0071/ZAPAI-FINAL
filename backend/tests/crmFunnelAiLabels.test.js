const test = require('node:test');
const assert = require('node:assert/strict');
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }

const updates = [];
stub('../src/data/repositories/conversationRepository', { async updateConversationState(id, payload) { updates.push({ id, payload }); return { id, ...payload }; } });
stub('../services/aiIntelligenceService', { getOpenAIContextForContact: () => null });

const funnelStage = require('../services/crm-intelligence/pipeline/funnelStage');
const tagStage = require('../services/crm-intelligence/pipeline/tagStage');
const persistStage = require('../services/crm-intelligence/pipeline/persistStage');

test('AI analysis moves funnel_stage and adds system tags without touching WhatsApp labels', async () => {
  const context = {
    conversationId: 'conv-1',
    message: 'Quanto custa?',
    analysis: { intent: 'price_request', lead_temperature: 'warm', confidence: 0.9, next_action: 'send_price' },
    conversation: { funnel_stage: 'new_lead', tags: ['vip'], whatsapp_labels: ['Pago (WA)'] },
    store: {},
    metrics: { record() {} },
  };
  await funnelStage.execute(context);
  await tagStage.execute(context);
  await persistStage.execute(context);

  assert.equal(updates.length, 1);
  const { payload } = updates[0];
  assert.equal(payload.funnel_stage, 'price_sent');
  assert.deepEqual(payload.tags.sort(), ['price_request', 'price_sent', 'send_price', 'vip', 'warm'].sort());
  // WhatsApp labels live in their own column and are never written by the AI pipeline.
  assert.ok(!('whatsapp_labels' in payload));
  assert.ok(!('whatsappLabels' in payload));
});
