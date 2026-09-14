const express = require('express');
const router = express.Router();
const aiConfigController = require('../controllers/aiConfigController');

router.post('/ai/improve', aiConfigController.improve);
router.get('/ai/memory', aiConfigController.getMemory);
router.post('/ai/memory', aiConfigController.saveMemory);
router.get('/ai/memory/analytics', aiConfigController.getMemoryAnalytics);
router.get('/ai/analytics', aiConfigController.getMemoryAnalytics); // alias used by Memory.tsx
router.get('/ai/memory/search', aiConfigController.searchMemory);
router.post('/ai/memory/flush', aiConfigController.flushMemory);

/**
 * POST /ai/compose
 * ZAI Inline Composer — generates a WhatsApp response from an attendant instruction.
 * Body: { conversationId, contactName, instruction, recentMessages?, sessionId? }
 * Response: { message: string, success: boolean }
 */
router.post('/ai/compose', async (req, res) => {
  try {
    const { contactName, instruction, recentMessages } = req.body || {};

    if (!instruction || !String(instruction).trim()) {
      return res.status(400).json({ success: false, error: 'instruction is required.' });
    }

    const COMPOSE_SYSTEM_PROMPT = `Você é um assistente de atendimento comercial brasileiro.
Sua função é ajudar o atendente humano a redigir mensagens para clientes no WhatsApp.
Responda APENAS com a mensagem que deve ser enviada ao cliente — sem aspas, sem explicações, sem prefixos como "Mensagem:" ou "Resposta:".
Escreva de forma natural, cordial, objetiva e humana.
Use português brasileiro informal mas profissional.
Não invente informações de preço, prazo, estoque ou condições que não foram fornecidas.
Limite a resposta a 1-3 parágrafos curtos.
Use emojis com moderação (máximo 1-2 por mensagem).
Nunca use linguagem robótica ou formalidade excessiva.`;

    const contactStr = contactName ? `Cliente: ${contactName}` : 'Cliente desconhecido';

    let historyBlock = '';
    if (Array.isArray(recentMessages) && recentMessages.length > 0) {
      historyBlock = '\n\nHistórico recente da conversa:\n' +
        recentMessages.map(m => `${m.role === 'assistant' ? 'Atendente' : 'Cliente'}: ${m.content}`).join('\n');
    }

    const userMessage = `${contactStr}${historyBlock}

Instrução do atendente: ${String(instruction).trim()}

Escreva a mensagem que o atendente deve enviar ao cliente:`;

    const store = req.app.locals.store;
    const { testProviderConnection } = require('../../../services/ai.service');

    // Resolve active provider (same logic as processAI / testAIConnection)
    let activeProvider = null;
    const companyId = store?.activeCompanyId || 'default';

    try {
      const { query } = require('../../../src/infrastructure/config/database');
      const crypto = require('crypto');
      const rawEncKey = process.env.ENCRYPTION_KEY || '';
      const encKey = crypto.createHash('sha256').update(rawEncKey).digest();

      function localDecrypt(text) {
        if (!text || !text.includes(':')) return text;
        try {
          const parts = text.split(':');
          const iv = Buffer.from(parts.shift(), 'hex');
          const enc = Buffer.from(parts.join(':'), 'hex');
          const decipher = crypto.createDecipheriv('aes-256-cbc', encKey, iv);
          let dec = decipher.update(enc);
          dec = Buffer.concat([dec, decipher.final()]);
          return dec.toString();
        } catch { return text; }
      }

      const { rows } = await query(
        `SELECT * FROM provider_keys WHERE tenant_id = $1 AND enabled = TRUE LIMIT 1`,
        [companyId]
      );
      if (rows.length > 0) {
        let pid = rows[0].provider.toLowerCase();
        if (pid === 'anthropic') pid = 'claude';
        if (pid === 'google') pid = 'gemini';
        activeProvider = { id: pid, apiKey: localDecrypt(rows[0].api_key), model: rows[0].model };
      }
    } catch (_) {}

    if (!activeProvider) {
      const providers = store?.aiConfig?.advancedAISettings?.providers || [];
      const found = providers.find(p => p.active) || providers[0];
      if (found) activeProvider = { id: found.id, apiKey: found.apiKey, model: found.model };
    }

    if (!activeProvider) {
      return res.status(503).json({ success: false, error: 'Nenhum provedor de IA configurado. Acesse as configurações para adicionar uma chave de API.' });
    }

    const result = await testProviderConnection(activeProvider, {
      model: activeProvider.model,
      message: userMessage,
      prompt: COMPOSE_SYSTEM_PROMPT,
      history: Array.isArray(recentMessages) ? recentMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      })) : [],
      maxTokens: 600,
      temperature: 0.7,
      timeoutMs: 40000,
    });

    const message = result?.response || '';

    if (!result?.ok || !message) {
      const errorMsg = result?.error || 'Erro ao gerar resposta.';
      return res.status(503).json({ success: false, error: errorMsg });
    }

    return res.status(200).json({ success: true, message: message.trim() });
  } catch (error) {
    console.error('[AI COMPOSE] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Erro ao gerar resposta.' });
  }
});

router.get('/config/business-hours', aiConfigController.getBusinessHours);
router.post('/config/business-hours', aiConfigController.saveBusinessHours);
router.get('/config/absence-message', aiConfigController.getAbsenceMessage);
router.post('/config/absence-message', aiConfigController.saveAbsenceMessage);
router.get('/config/advanced-ai', aiConfigController.getAdvancedAI);
router.post('/config/advanced-ai', aiConfigController.saveAdvancedAI);
router.get('/config/ai-agents', aiConfigController.getAIAgents);
router.post('/config/ai-agents', aiConfigController.createAIAgent);
router.put('/config/ai-agents/:key', aiConfigController.updateAIAgent);
router.patch('/config/ai-agents/:key/active', aiConfigController.toggleAIAgent);
router.delete('/config/ai-agents/:key', aiConfigController.deleteAIAgent);
router.post('/config/ai-agents/:key/clone', aiConfigController.cloneAIAgent);
router.get('/config/ai/evolution', aiConfigController.getAIEvolution);
router.get('/config/ai/pipeline-logs', aiConfigController.getPipelineLogs);

router.get('/config/user-providers', aiConfigController.getUserProviders);
router.post('/config/user-providers', aiConfigController.saveUserProvider);

router.post('/config/ai/restart', async (req, res) => {
  try {
    const aiService = require('../../../services/ai.service');
    const aiAgentService = require('../../ai/agents/services/aiAgentService');

    if (typeof aiService.clearResponseCache === 'function') {
      aiService.clearResponseCache();
    }

    if (typeof aiAgentService.resetCache === 'function') {
      aiAgentService.resetCache(req.tenantId || req.companyId || process.env.DEFAULT_COMPANY_ID || 'default');
    }

    return res.status(200).json({ success: true, message: 'AI restarted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/config/ai/deploy-vps', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const path = require('path');
    const rootDir = path.join(__dirname, '..', '..');

    console.log('[AI DEPLOY] Triggered self-deployment on server.');
    
    // Execute auto-deploy.sh locally on the server
    const deployScript = path.join(rootDir, 'deploy', 'auto-deploy.sh');
    
    // Run asynchronously to allow connection to return status first (PM2 restart kills the connection)
    exec(`bash "${deployScript}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[AI DEPLOY] Failed: ${error.message}`);
        return;
      }
      console.log('[AI DEPLOY] Completed successfully.');
    });

    return res.status(200).json({ success: true, message: 'Deployment triggered successfully on VPS.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/queue', aiConfigController.getQueue);
router.post('/queue/process', aiConfigController.processQueue);

module.exports = router;
