const leadsService = require('../services/leadsService');

function getCompanyId(req) {
  return req?.headers?.['x-company-id'] || req?.query?.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

async function list(req, res) {
  try {
    const leads = await leadsService.listLeads(getCompanyId(req));
    return res.status(200).json(leads);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to list leads.' });
  }
}

async function getById(req, res) {
  try {
    const item = await leadsService.getLeadsById(req.params.id, getCompanyId(req));
    if (!item) return res.status(404).json({ error: 'Leads not found.' });
    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load lead.' });
  }
}

async function create(req, res) {
  try {
    const created = await leadsService.createLeads({
      ...(req.body || {}),
      companyId: getCompanyId(req),
    });
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create lead.' });
  }
}

async function update(req, res) {
  try {
    const updated = await leadsService.updateLeads(req.params.id, {
      ...(req.body || {}),
      companyId: getCompanyId(req),
    });
    if (!updated) return res.status(404).json({ error: 'Leads not found.' });
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update lead.' });
  }
}

async function remove(req, res) {
  try {
    const removed = await leadsService.removeLeads(req.params.id, getCompanyId(req));
    if (!removed) return res.status(404).json({ error: 'Leads not found.' });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to remove lead.' });
  }
}

module.exports = {
  create,
  getById,
  list,
  remove,
  update,
};
