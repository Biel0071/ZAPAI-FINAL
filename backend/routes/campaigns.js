/**
 * Campaigns Route
 * Handles all /api/campaigns endpoints.
 * Safe empty state when DB table doesn't exist yet.
 */

const express = require('express');
const router = express.Router();
const campaignsController = require('../controllers/campaignsController');

// GET /api/campaigns — list campaigns
router.get('/campaigns', campaignsController.listCampaigns);

// POST /api/campaigns — create campaign
router.post('/campaigns', campaignsController.createCampaign);

// PATCH /api/campaigns/:id — update campaign
router.patch('/campaigns/:id', campaignsController.updateCampaign);

// DELETE /api/campaigns/:id — delete campaign
router.delete('/campaigns/:id', campaignsController.deleteCampaign);

// POST /api/campaigns/:id/launch — launch campaign
router.post('/campaigns/:id/launch', campaignsController.launchCampaign);

// POST /api/campaigns/:id/pause — pause campaign
router.post('/campaigns/:id/pause', campaignsController.pauseCampaign);

module.exports = router;
