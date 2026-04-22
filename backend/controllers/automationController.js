const automationService = require('../services/automationService');

function getStore(req) {
  return req.app.locals.store;
}

async function getCampaigns(req, res) {
  try {
    const campaigns = await automationService.listCampaigns(getStore(req));
    return res.status(200).json(campaigns);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch campaigns.' });
  }
}

async function getCampaignById(req, res) {
  try {
    const campaign = await automationService.getCampaign(getStore(req), String(req.params.id || ''));

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    return res.status(200).json(campaign);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch campaign.' });
  }
}

async function createCampaign(req, res) {
  try {
    const created = await automationService.createCampaign(getStore(req), req.body || {});
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create campaign.' });
  }
}

async function startCampaign(req, res) {
  try {
    const updated = await automationService.startCampaign(getStore(req), String(req.params.id || ''));
    if (!updated) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to start campaign.' });
  }
}

async function updateCampaign(req, res) {
  try {
    const updated = await automationService.updateCampaign(
      getStore(req),
      String(req.params.id || ''),
      req.body || {}
    );

    if (!updated) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to update campaign.' });
  }
}

async function deleteCampaign(req, res) {
  try {
    const removed = await automationService.deleteCampaign(getStore(req), String(req.params.id || ''));

    if (!removed) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to delete campaign.' });
  }
}

async function getCampaignStatus(req, res) {
  try {
    const status = await automationService.getCampaignStatus(getStore(req), String(req.params.id || ''));

    if (!status) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch campaign status.' });
  }
}

async function getFlows(req, res) {
  try {
    const flows = await automationService.listFlows(getStore(req));
    return res.status(200).json(flows);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch flows.' });
  }
}

async function createFlow(req, res) {
  try {
    const created = await automationService.createFlow(getStore(req), req.body || {});
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create flow.' });
  }
}

async function updateFlow(req, res) {
  try {
    const updated = await automationService.updateFlow(getStore(req), String(req.params.id || ''), req.body || {});

    if (!updated) {
      return res.status(404).json({ error: 'Flow not found.' });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to update flow.' });
  }
}

async function deleteFlow(req, res) {
  try {
    const removed = await automationService.deleteFlow(getStore(req), String(req.params.id || ''));

    if (!removed) {
      return res.status(404).json({ error: 'Flow not found.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to delete flow.' });
  }
}

module.exports = {
  createCampaign,
  createFlow,
  deleteCampaign,
  deleteFlow,
  getCampaignById,
  getCampaigns,
  getCampaignStatus,
  getFlows,
  startCampaign,
  updateCampaign,
  updateFlow,
};
