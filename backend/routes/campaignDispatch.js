/**
 * Campaign Dispatch API Routes
 *
 * POST /api/campaigns/:id/start   — Start campaign dispatch
 * POST /api/campaigns/:id/pause   — Pause running campaign
 * POST /api/campaigns/:id/resume  — Resume paused campaign
 * POST /api/campaigns/:id/cancel  — Cancel campaign
 * GET  /api/campaigns/:id/status  — Get campaign dispatch status
 * GET  /api/campaigns/active       — List all active campaigns
 */

const express = require('express');
const router = express.Router();
const campaignDispatchEngine = require('../services/campaignDispatchEngine');

function safeJson(res, data, status = 200) {
  try {
    return res.status(status).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Response serialization failed' });
  }
}

// Start campaign dispatch
router.post('/campaigns/:id/start', async (req, res) => {
  try {
    const companyId = req.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
    const io = req.app?.locals?.io || global.io;
    const result = await campaignDispatchEngine.startCampaign(req.params.id, companyId, io);
    return safeJson(res, { success: true, data: result });
  } catch (error) {
    const status = error?.message?.includes('not found') ? 404 : 400;
    return safeJson(res, { success: false, error: error?.message || 'Start failed' }, status);
  }
});

// Pause campaign
router.post('/campaigns/:id/pause', (req, res) => {
  try {
    const result = campaignDispatchEngine.pauseCampaign(req.params.id);
    if (!result) {
      return safeJson(res, { success: false, error: 'Campaign not active' }, 404);
    }
    return safeJson(res, { success: true, data: result });
  } catch (error) {
    return safeJson(res, { success: false, error: error?.message || 'Pause failed' }, 500);
  }
});

// Resume campaign
router.post('/campaigns/:id/resume', (req, res) => {
  try {
    const io = req.app?.locals?.io || global.io;
    const result = campaignDispatchEngine.resumeCampaign(req.params.id, io);
    if (!result) {
      return safeJson(res, { success: false, error: 'Campaign not paused' }, 404);
    }
    return safeJson(res, { success: true, data: result });
  } catch (error) {
    return safeJson(res, { success: false, error: error?.message || 'Resume failed' }, 500);
  }
});

// Cancel campaign
router.post('/campaigns/:id/cancel', (req, res) => {
  try {
    const result = campaignDispatchEngine.cancelCampaign(req.params.id);
    if (!result) {
      return safeJson(res, { success: false, error: 'Campaign not active' }, 404);
    }
    return safeJson(res, { success: true, data: result });
  } catch (error) {
    return safeJson(res, { success: false, error: error?.message || 'Cancel failed' }, 500);
  }
});

// Get campaign dispatch status
router.get('/campaigns/:id/status', (req, res) => {
  try {
    const result = campaignDispatchEngine.getStatus(req.params.id);
    if (!result) {
      return safeJson(res, { success: false, error: 'Campaign not active' }, 404);
    }
    return safeJson(res, { success: true, data: result });
  } catch (error) {
    return safeJson(res, { success: false, error: error?.message || 'Status failed' }, 500);
  }
});

// List all active campaigns
router.get('/campaigns/active', (_req, res) => {
  try {
    return safeJson(res, { success: true, data: campaignDispatchEngine.listActive() });
  } catch (error) {
    return safeJson(res, { success: false, error: error?.message || 'List failed' }, 500);
  }
});

module.exports = router;
