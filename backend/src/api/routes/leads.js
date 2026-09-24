const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leadsController');
const { query } = require('../../infrastructure/config/database');

router.get('/api/leads', leadsController.list);
router.get('/api/leads/:id', leadsController.getById);
router.post('/api/leads', leadsController.create);
router.put('/api/leads/:id', leadsController.update);
router.delete('/api/leads/:id', leadsController.remove);

// Lead temperature / intelligence
router.post('/api/leads/temperature', async (req, res) => {
  try {
    const { conversationId, temperature, intent, confidence } = req.body;
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    if (!req.authTenantId) return res.status(401).json({ error: 'Authentication required' });
    const result = await query(
      `UPDATE conversations SET lead_temperature = $1, lead_intent = $2, lead_confidence = $3
       WHERE id = $4 AND company_id = $5 RETURNING id`,
      [temperature || 'cold', intent || 'unknown', confidence || 0, conversationId, req.authTenantId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ success: true, data: { conversationId, temperature, intent, confidence } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/leads/temperature/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!req.authTenantId) return res.status(401).json({ error: 'Authentication required' });
    const result = await query(
      `SELECT lead_temperature, lead_intent, lead_confidence FROM conversations
       WHERE id = $1 AND company_id = $2`,
      [conversationId, req.authTenantId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Conversation not found' });
    res.json({
      success: true,
      data: { temperature: row.lead_temperature, intent: row.lead_intent, confidence: row.lead_confidence },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
