const express = require('express');

const controller = require('../controllers/aiIntelligenceController');
const aiMemoryEvolutionService = require('../../../services/aiMemoryEvolutionService');

const router = express.Router();

function requireTenant(req, res) {
  const companyId = req.authTenantId;
  if (!companyId) {
    res.status(401).json({ success: false, error: 'Autenticação obrigatória.' });
    return null;
  }
  return companyId;
}

router.get('/ai/intelligence/panel', controller.getPanel);
router.post('/ai/intelligence/analyze', controller.analyze);
router.get('/ai/intelligence/memory', controller.listMemory);
router.get('/ai/intelligence/memory/:contactId', controller.getMemory);
router.get('/ai/intelligence/improvements', controller.listImprovements);
router.post('/ai/intelligence/improvements/:id/approve', controller.approveImprovement);
router.post('/ai/intelligence/improvements/:id/applied', controller.markImprovementApplied);
router.post('/ai/intelligence/improvements/:id/ignore', controller.ignoreImprovement);
router.post('/ai/intelligence/docs/refresh', controller.refreshDocs);

// Reorganized Memory & Controlled Evolution Enterprise API
router.get('/ai/memory-evolution/overview', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const data = await aiMemoryEvolutionService.getOverview({
      companyId,
      agentKey: req.query.agentKey || null,
      sessionId: req.query.sessionId || null,
      period: req.query.period || '30d',
      start: req.query.start || null,
      end: req.query.end || null,
    });
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ai/memory-evolution/memories', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const data = await aiMemoryEvolutionService.listMemories({
      companyId,
      agentKey: req.query.agentKey || null,
      sessionId: req.query.sessionId || null,
      category: req.query.category || null,
      search: req.query.search || '',
      status: req.query.status || 'all',
      scope: req.query.scope || 'all',
      limit: Number(req.query.limit) || 80,
      offset: Number(req.query.offset) || 0,
    });
    return res.status(200).json({ success: true, categories: aiMemoryEvolutionService.MEMORY_CATEGORY_LABELS, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/ai/memory-evolution/memories', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const memory = await aiMemoryEvolutionService.createMemory({
      companyId,
      ...(req.body || {}),
      actor: req.auth || {},
    });
    return res.status(201).json({ success: true, memory });
  } catch (error) {
    return res.status(error.status || 400).json({ success: false, error: error.message });
  }
});

router.patch('/ai/memory-evolution/memories/:id', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const memory = await aiMemoryEvolutionService.updateMemory({
      companyId,
      id: req.params.id,
      ...(req.body || {}),
      actor: req.auth || {},
    });
    if (!memory) return res.status(404).json({ success: false, error: 'Memória não encontrada nesta empresa.' });
    return res.status(200).json({ success: true, memory });
  } catch (error) {
    return res.status(error.status || 400).json({ success: false, error: error.message });
  }
});

router.delete('/ai/memory-evolution/memories/:id', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const removed = await aiMemoryEvolutionService.deleteMemory({ companyId, id: req.params.id });
    if (!removed) return res.status(404).json({ success: false, error: 'Memória não encontrada nesta empresa.' });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ai/memory-evolution/cognitive', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const data = await aiMemoryEvolutionService.listEvolutionPipeline({
      companyId,
      agentKey: req.query.agentKey || null,
      limit: Number(req.query.limit) || 60,
    });
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/ai/memory-evolution/proposals/:id/approve', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const proposal = await aiMemoryEvolutionService.approveProposal({ companyId, proposalId: req.params.id, actor: req.auth || {} });
    return res.status(200).json({ success: true, proposal });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/ai/memory-evolution/proposals/:id/reject', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const proposal = await aiMemoryEvolutionService.rejectProposal({ companyId, proposalId: req.params.id, actor: req.auth || {} });
    if (!proposal) return res.status(404).json({ success: false, error: 'Proposta não encontrada nesta empresa.' });
    return res.status(200).json({ success: true, proposal });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/ai/memory-evolution/proposals/:id/rollback', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const proposal = await aiMemoryEvolutionService.rollbackProposal({ companyId, proposalId: req.params.id, actor: req.auth || {} });
    return res.status(200).json({ success: true, proposal });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/ai/memory-evolution/results', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const data = await aiMemoryEvolutionService.getResultsAndConversations({
      companyId,
      agentKey: req.query.agentKey || null,
      sessionId: req.query.sessionId || null,
      period: req.query.period || '30d',
      start: req.query.start || null,
      end: req.query.end || null,
      search: req.query.search || '',
      limit: Number(req.query.limit) || 40,
    });
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ai/memory-evolution/conversations/:conversationId/explain', async (req, res) => {
  const companyId = requireTenant(req, res);
  if (!companyId) return;
  try {
    const explanation = await aiMemoryEvolutionService.explainConversation({
      companyId,
      conversationId: req.params.conversationId,
    });
    if (!explanation) return res.status(404).json({ success: false, error: 'Conversa não encontrada nesta empresa.' });
    return res.status(200).json({ success: true, ...explanation });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
