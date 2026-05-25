const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leadsController');

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
    const pool = req.app.get('pool');
    if (pool) {
      await pool.query(
        `UPDATE conversations SET lead_temperature = $1, lead_intent = $2, lead_confidence = $3 WHERE id = $4`,
        [temperature || 'cold', intent || 'unknown', confidence || 0, conversationId]
      );
    }
    res.json({ success: true, data: { conversationId, temperature, intent, confidence } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/leads/temperature/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const pool = req.app.get('pool');
    let row = null;
    if (pool) {
      const result = await pool.query(
        `SELECT lead_temperature, lead_intent, lead_confidence FROM conversations WHERE id = $1`,
        [conversationId]
      );
      row = result.rows[0] || null;
    }
    res.json({
      success: true,
      data: row
        ? { temperature: row.lead_temperature, intent: row.lead_intent, confidence: row.lead_confidence }
        : { temperature: 'cold', intent: 'unknown', confidence: 0 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
