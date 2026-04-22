const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leadsController');

router.get('/api/leads', leadsController.list);
router.get('/api/leads/:id', leadsController.getById);
router.post('/api/leads', leadsController.create);
router.put('/api/leads/:id', leadsController.update);
router.delete('/api/leads/:id', leadsController.remove);

module.exports = router;
