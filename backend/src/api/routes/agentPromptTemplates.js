'use strict';

const express = require('express');
const templates = require('../../data/repositories/agentPromptTemplateRepository');

const router = express.Router();
const roles = (req) => String(req.auth?.role || '').trim().toLowerCase();
const companyId = (req) => String(req.authTenantId || req.auth?.tenantId || '').trim();
const isCompanyAdmin = (req) => roles(req) === 'admin' || (['master', 'master_admin'].includes(roles(req)) && Boolean(req.adminCompanyContext));

function requireCompanyAdmin(req, res, next) {
  if (!companyId(req)) return res.status(401).json({ success: false, error: 'Autenticação da empresa obrigatória.' });
  if (!isCompanyAdmin(req)) return res.status(403).json({ success: false, error: 'Somente administradores da empresa podem alterar templates.' });
  return next();
}

router.get('/ai/prompt-templates', async (req, res) => {
  const tenantId = companyId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Autenticação da empresa obrigatória.' });
  const includeDrafts = String(req.query.includeDrafts || '') === 'true';
  if (includeDrafts && !isCompanyAdmin(req)) return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
  try {
    const data = await templates.listAvailable(tenantId, { includeDrafts, niche: req.query.niche });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Não foi possível listar os templates.' });
  }
});

router.post('/ai/prompt-templates', requireCompanyAdmin, async (req, res) => {
  try {
    const data = await templates.createTemplate({
      scope: templates.COMPANY_SCOPE,
      companyId: companyId(req),
      templateKey: req.body?.templateKey,
      niche: req.body?.niche,
      title: req.body?.title,
      description: req.body?.description,
      promptText: req.body?.promptText,
      requiredFields: req.body?.requiredFields,
      unresolvedFacts: req.body?.unresolvedFacts,
      guardrails: req.body?.guardrails,
      createdBy: req.auth?.username || req.auth?.sub,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    const status = /obrigat|inválid|deve ter|limite|não podem|pendentes/i.test(error.message) ? 400 : 500;
    return res.status(status).json({ success: false, error: error.message });
  }
});

router.post('/ai/prompt-templates/:templateId/clone-platform', requireCompanyAdmin, async (req, res) => {
  try {
    const data = await templates.clonePublishedPlatformTemplate(companyId(req), req.params.templateId, req.auth?.username || req.auth?.sub);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(error.message.includes('não encontrada') ? 404 : 500).json({ success: false, error: error.message });
  }
});

router.post('/ai/prompt-templates/:templateId/versions', requireCompanyAdmin, async (req, res) => {
  try {
    const data = await templates.createDraftVersion({ scope: templates.COMPANY_SCOPE, companyId: companyId(req), templateId: req.params.templateId, createdBy: req.auth?.username || req.auth?.sub });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(error.message.includes('não encontrado') ? 404 : 500).json({ success: false, error: error.message });
  }
});

router.put('/ai/prompt-templates/:templateId/versions/:versionId', requireCompanyAdmin, async (req, res) => {
  try {
    const data = await templates.updateDraftVersion({ scope: templates.COMPANY_SCOPE, companyId: companyId(req), templateId: req.params.templateId, versionId: req.params.versionId, input: req.body || {} });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.message.includes('não encontrado') ? 404 : 400).json({ success: false, error: error.message });
  }
});

router.post('/ai/prompt-templates/:templateId/versions/:versionId/publish', requireCompanyAdmin, async (req, res) => {
  try {
    const data = await templates.publishVersion({ scope: templates.COMPANY_SCOPE, companyId: companyId(req), templateId: req.params.templateId, versionId: req.params.versionId });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.message.includes('não encontrado') ? 404 : 400).json({ success: false, error: error.message });
  }
});

router.put('/ai/stores/:storeId/prompt-template', requireCompanyAdmin, async (req, res) => {
  try {
    const data = await templates.setStoreTemplate(companyId(req), req.params.storeId, req.body?.templateId, req.auth?.username || req.auth?.sub);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.message.includes('não pertence') ? 404 : 400).json({ success: false, error: error.message });
  }
});

router.get('/ai/stores/:storeId/prompt-template', async (req, res) => {
  const tenantId = companyId(req);
  if (!tenantId) return res.status(401).json({ success: false, error: 'Autenticação da empresa obrigatória.' });
  try {
    const data = await templates.getStoreTemplate(tenantId, req.params.storeId);
    return res.json({ success: true, data });
  } catch (_) {
    return res.status(500).json({ success: false, error: 'Não foi possível carregar o template da loja.' });
  }
});

router.delete('/ai/prompt-templates/:templateId', requireCompanyAdmin, async (req, res) => {
  try {
    const archived = await templates.archiveTemplate({ scope: templates.COMPANY_SCOPE, companyId: companyId(req), templateId: req.params.templateId });
    return archived ? res.json({ success: true }) : res.status(404).json({ success: false, error: 'Template não encontrado.' });
  } catch (_) {
    return res.status(500).json({ success: false, error: 'Não foi possível arquivar o template.' });
  }
});

module.exports = router;
