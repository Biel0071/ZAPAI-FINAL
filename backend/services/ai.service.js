const axios = require('axios');
const aiLogService = require('./aiLogService');
const { getActivePrompt } = require('../config/promptManager');
const { DEFAULT_SYSTEM_PROMPT } = require('../config/basePrompt');

const responseCache = new Map();
const RESPONSE_CACHE_TTL_MS = 60 * 1000;

function resolveProviderBaseUrl(providerId) {
  if (providerId === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta/openai';
  if (providerId === 'groq') return 'https://api.groq.com/openai/v1';
  if (providerId === 'deepseek') return 'https://api.deepseek.com/v1';
  if (providerId === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (providerId === 'ollama') return 'http://localhost:11434/v1';
  return 'https://api.openai.com/v1';
}

function normalizeProviderError(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    String(error)
  );
}

async function testProviderConnection(provider = {}, options = {}) {
  const providerId = String(provider.id || '').trim().toLowerCase();
  const apiKey = String(provider.apiKey || provider.api_key || '').trim();
  const model = String(options.model || provider.model || '').trim();
  const message = String(options.message || 'Responda apenas OK.').trim();
  const systemPrompt = String(options.prompt || 'Voce e um verificador tecnico.').trim();
  const maxTokens = Math.max(32, Number(options.maxTokens) || 32);
  const temperature = Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0;
  const timeoutMs = Number(options.timeoutMs) || 12000;
  const startedAt = Date.now();

  if (!providerId) {
    return { ok: false, provider: '', model, status: 'error', error: 'Provider sem identificador.' };
  }
  if (!model) {
    return { ok: false, provider: providerId, model, status: 'error', error: 'Modelo nao configurado.' };
  }
  if (!apiKey && providerId !== 'ollama') {
    return { ok: false, provider: providerId, model, status: 'error', error: 'API key ausente.' };
  }

  try {
    let reply = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    if (providerId === 'claude') {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: timeoutMs,
        }
      );
      reply = response.data?.content?.[0]?.text || '';
      promptTokens = response.data?.usage?.input_tokens || 0;
      completionTokens = response.data?.usage?.output_tokens || 0;
      totalTokens = promptTokens + completionTokens;
    } else {
      const baseURL = resolveProviderBaseUrl(providerId);
      const response = await axios.post(
        `${baseURL}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: timeoutMs,
        }
      );
      reply = response.data?.choices?.[0]?.message?.content || '';
      promptTokens = response.data?.usage?.prompt_tokens || 0;
      completionTokens = response.data?.usage?.completion_tokens || 0;
      totalTokens = response.data?.usage?.total_tokens || (promptTokens + completionTokens);
    }

    if (totalTokens === 0) {
      promptTokens = Math.ceil((systemPrompt.length + message.length) / 4);
      completionTokens = Math.ceil(reply.length / 4);
      totalTokens = promptTokens + completionTokens;
    }

    return {
      ok: true,
      provider: providerId,
      model,
      status: 'connected',
      response: reply,
      responseTimeMs: Date.now() - startedAt,
      promptTokens,
      completionTokens,
      totalTokens,
    };
  } catch (error) {
    return {
      ok: false,
      provider: providerId,
      model,
      status: 'error',
      error: normalizeProviderError(error),
      responseTimeMs: Date.now() - startedAt,
      httpStatus: error?.response?.status || null,
    };
  }
}

function adjustPromptIdentity(basePrompt, agent) {
  const agentName = agent?.name || 'Camila';
  if (agentName.toLowerCase() === 'camila') {
    return basePrompt;
  }

  // Determine gender of the agent
  const nameLower = agentName.toLowerCase();
  const isMasculine = ['rafael', 'pedro', 'lucas', 'joao', 'joão', 'mateus', 'gabriel', 'felipe', 'bruno', 'thiago', 'tiago', 'rodrigo', 'andre', 'andré', 'marcos', 'carlos', 'gustavo', 'daniel', 'marcelo'].includes(nameLower) || nameLower.endsWith('o');

  let prompt = basePrompt;

  if (isMasculine) {
    // Replace feminine articles and nouns to masculine equivalents
    prompt = prompt.replace(/\ba Camila\b/gi, `o ${agentName}`);
    prompt = prompt.replace(/\bcomo Camila\b/gi, `como ${agentName}`);
    prompt = prompt.replace(/\bsou a Camila\b/gi, `sou o ${agentName}`);
    prompt = prompt.replace(/\bcomo a Camila\b/gi, `como o ${agentName}`);
    prompt = prompt.replace(/\buma vendedora\b/gi, 'um vendedor');
    prompt = prompt.replace(/\bUma vendedora\b/gi, 'Um vendedor');
    prompt = prompt.replace(/\bvendedora\b/gi, 'vendedor');
    prompt = prompt.replace(/\bVendedora\b/gi, 'Vendedor');
    prompt = prompt.replace(/\bobrigada\b/gi, 'obrigado');
    prompt = prompt.replace(/\bObrigada\b/gi, 'Obrigado');
    prompt = prompt.replace(/\bsimpática\b/gi, 'simpático');
    prompt = prompt.replace(/\bsimpaticas\b/gi, 'simpáticos');
    prompt = prompt.replace(/\batenta\b/gi, 'atento');
    prompt = prompt.replace(/\batentamente\b/gi, 'atentamente'); // avoid breaking
    prompt = prompt.replace(/\buma assistente\b/gi, 'um assistente');
    prompt = prompt.replace(/\ba vendedora\b/gi, 'o vendedor');
    prompt = prompt.replace(/\bda Camila\b/gi, `do ${agentName}`);
    prompt = prompt.replace(/\bde Camila\b/gi, `de ${agentName}`);
  } else {
    // Feminine agent (e.g. Julia)
    prompt = prompt.replace(/\ba Camila\b/gi, `a ${agentName}`);
    prompt = prompt.replace(/\bcomo Camila\b/gi, `como ${agentName}`);
    prompt = prompt.replace(/\bsou a Camila\b/gi, `sou a ${agentName}`);
    prompt = prompt.replace(/\bda Camila\b/gi, `da ${agentName}`);
    prompt = prompt.replace(/\bde Camila\b/gi, `de ${agentName}`);
  }

  // Replace any leftover "Camila" occurrences with the agent's name
  prompt = prompt.replace(/Camila/g, agentName);

  return prompt;
}

function compileSystemPrompt(agent, store, contact = null) {
  const agentName = agent?.name || 'Camila';
  const sector = agent?.sector || 'Geral';
  const objective = agent?.objective || 'Atendimento comercial';
  const personality = agent?.personality || agent?.prompt || '';

  // 1. IDENTIDADE DO ATENDENTE
  let compiled = `[IDENTIDADE DO ATENDENTE]\n`;
  compiled += `- Nome: ${agentName}\n`;
  compiled += `- Cargo/Setor: ${sector}\n`;
  compiled += `- Objetivo: ${objective}\n`;
  compiled += `\n`;

  // 2. TOM/PERSONALIDADE
  compiled += `[TOM/PERSONALIDADE]\n`;
  if (personality) {
    compiled += `${personality}\n`;
  } else {
    compiled += `Atendimento amigável, direto, simpático e profissional.\n`;
  }
  compiled += `\n`;

  // 3. DADOS DO CLIENTE
  if (contact) {
    compiled += `[DADOS DO CLIENTE]\n`;
    compiled += `- Nome do Cliente: ${contact.name || 'Cliente'}\n`;
    compiled += `- Telefone/WhatsApp do Cliente: ${contact.phone || ''}\n`;
    if (contact.funnelStage) compiled += `- Estágio atual do funil: ${contact.funnelStage}\n`;
    if (contact.nextAction) compiled += `- Próxima ação recomendada: ${contact.nextAction}\n`;
    if (contact.leadAnalysis?.intent) compiled += `- Intenção atual: ${contact.leadAnalysis.intent}\n`;
    if (contact.leadAnalysis?.lead_temperature) compiled += `- Temperatura do lead: ${contact.leadAnalysis.lead_temperature}\n`;
    if (contact.salesStrategy?.goal) compiled += `- Objetivo comercial desta resposta: ${contact.salesStrategy.goal}\n`;
    compiled += `\n`;
  }

  // 4. CONTEXTO DA EMPRESA
  compiled += `[CONTEXTO DA EMPRESA]\n`;
  const companyName = agent?.company || 'Depósito Vista Alegre';
  const companyDesc = agent?.companyDescription || 'O Depósito Vista Alegre atua no mercado de materiais de construção.';
  const policies = agent?.policies || '';
  compiled += `- Nome da Empresa: ${companyName}\n`;
  compiled += `- Descrição da Empresa: ${companyDesc}\n`;
  if (policies) {
    compiled += `- Políticas: ${policies}\n`;
  }
  compiled += `\n`;

  // 5. PRODUTOS/SERVIÇOS
  compiled += `[PRODUTOS/SERVIÇOS]\n`;
  let hasProductsOrServices = false;
  if (agent?.products) {
    compiled += `Produtos/Tabela de Preços:\n${agent.products}\n`;
    hasProductsOrServices = true;
  }
  if (agent?.services) {
    compiled += `Serviços:\n${agent.services}\n`;
    hasProductsOrServices = true;
  }
  if (!hasProductsOrServices) {
    compiled += `Nenhum produto ou serviço específico configurado.\n`;
  }
  compiled += `\n`;

  // 6. FAQ & DÚVIDAS FREQUENTES
  compiled += `[FAQ & DÚVIDAS FREQUENTES]\n`;
  if (agent?.faq) {
    compiled += `${agent.faq}\n`;
  } else {
    compiled += `Nenhuma dúvida cadastrada no FAQ.\n`;
  }
  compiled += `\n`;

  // 7. REGRAS DE NEGÓCIO CUSTOMIZADAS
  compiled += `[REGRAS DE NEGÓCIO CUSTOMIZADAS]\n`;
  if (agent?.rules) {
    compiled += `- Regras Customizadas: ${agent.rules}\n`;
  }
  const businessHoursSettings = store?.aiConfig?.businessHours || {};
  compiled += `- Horário de Funcionamento: de ${businessHoursSettings.open || '07:00'} às ${businessHoursSettings.close || '18:00'}\n`;
  if (agent?.hours) {
    compiled += `- Instruções de Horários: ${agent.hours}\n`;
  }
  compiled += `\n`;

  // 8. MEMÓRIA
  compiled += `[MEMÓRIA DO ATENDENTE E CONTEXTO]\n`;
  const conversationSummary = store?.conversationSummary || null;
  if (conversationSummary) {
    compiled += `- Resumo Geral da Conversa (Contexto Histórico): ${conversationSummary}\n`;
  }
  const memorySettings = store?.aiConfig?.memorySettings || {};
  compiled += `- Memória Ativa: ${memorySettings.enabled !== false ? 'Sim' : 'Não'}\n`;
  const memoryContext = contact?.memoryContext;
  if (memorySettings.enabled !== false && memoryContext) {
    if (memoryContext.summary) compiled += `- Resumo acumulado do cliente: ${memoryContext.summary}\n`;
    if (memoryContext.intent) compiled += `- Intenção lembrada: ${memoryContext.intent}\n`;
    if (memoryContext.sentiment) compiled += `- Sentimento percebido: ${memoryContext.sentiment}\n`;
    if (memoryContext.tags?.length) compiled += `- Marcadores lembrados: ${memoryContext.tags.join(', ')}\n`;
    if (memoryContext.prefersAudio) compiled += '- Preferência: cliente demonstra preferência por áudio.\n';
    const rememberedHistory = Array.isArray(memoryContext.history) ? memoryContext.history.slice(-8) : [];
    if (rememberedHistory.length) {
      compiled += '- Contexto recente consolidado:\n';
      for (const entry of rememberedHistory) {
        compiled += `  - ${entry.role === 'assistant' ? 'Atendente' : 'Cliente'}: ${String(entry.content || '').slice(0, 260)}\n`;
      }
    }
  }
  if (agent?.memory) {
    compiled += `- Memória Fixa do Atendente: ${agent.memory}\n`;
  }
  compiled += `\n`;

  // 9. DIRETRIZES DE TRANSBORDO HUMANO
  compiled += `[DIRETRIZES DE TRANSBORDO HUMANO]\n`;
  if (agent?.escalationActive) {
    compiled += `- Transbordo Ativo: Sim\n`;
    compiled += `- Modo de Escalação: ${agent.escalationMode || 1}\n`;
    if (agent.escalationPhone) compiled += `- Telefone de Transbordo: ${agent.escalationPhone}\n`;
    if (agent.escalationWhatsapp) compiled += `- WhatsApp de Transbordo: ${agent.escalationWhatsapp}\n`;
    if (agent.escalationTriggers && agent.escalationTriggers.length > 0) {
      compiled += `- Gatilhos de Escalação: ${agent.escalationTriggers.join(', ')}\n`;
    }
    compiled += `- Regra: Se o cliente acionar algum gatilho de transbordo, solicitar atendimento humano ou se você não souber responder, solicite transbordo humano imediatamente.\n`;
  } else {
    compiled += `- Transbordo Ativo: Não\n`;
    compiled += `- Regra: Se o cliente insistir muito em falar com um humano, informe que no momento o canal é automatizado mas que a equipe analisará o caso.\n`;
  }
  compiled += `\n`;

  // 10. DIRETRIZES GLOBAIS DE ATENDIMENTO
  compiled += `[DIRETRIZES GLOBAIS DE ATENDIMENTO]\n`;
  compiled += `- Sempre responda em português brasileiro de forma natural, calorosa, empática, simpática e profissional.\n`;
  compiled += `- Use uma variedade de palavras e expressões para evitar respostas repetitivas ou mecânicas. Adapte o tom ao humor e estilo de escrita do cliente.\n`;
  compiled += `- Sinta-se livre para conversar sobre assuntos gerais ou saudações do dia a dia, mantendo um diálogo agradável e prestativo, mesmo que as respostas exatas não estejam descritas no prompt.\n`;
  compiled += `- Nunca mencione que você é um robô ou inteligência artificial, a menos que seja estritamente necessário para realizar o transbordo humano.\n`;
  compiled += `- Se o cliente solicitar atendimento humano ou se a IA não souber responder sobre preços ou condições críticas que você não tem acesso, acione o transbordo imediatamente.\n`;
  compiled += `- Continue o atendimento do ponto atual; não reinicie com saudações repetidas se já existe histórico.\n`;
  compiled += `- Não repita perguntas que o cliente já respondeu. Use as quantidades, produtos e preferências presentes no contexto.\n`;
  compiled += `- Seja flexível e criativo nas respostas gerais, mas evite inventar preços específicos, prazos de entrega ou condições financeiras que não estejam configurados no seu contexto.\n`;

  return compiled.trim();
}

const crypto = require('crypto');

const IV_LENGTH = 16;

function getEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY || '';
  if (!rawKey) {
    console.error('[CRYPTO] CRITICAL WARNING: ENCRYPTION_KEY is empty in process.env at evaluation time.');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
}

function decrypt(text) {
  if (!text) return '';
  if (!text.includes(':')) {
    return text;
  }
  const currentKey = getEncryptionKey();
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', currentKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    // If that fails, try legacy decryption fallback to avoid data loss on rotation
    try {
      const legacyKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'ZAPFLOW_SECURE_SALT_KEY_2026').digest();
      const parts = text.split(':');
      const iv = Buffer.from(parts.shift(), 'hex');
      const encryptedText = Buffer.from(parts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      console.warn('[CRYPTO] Decrypted using legacy fallback key. Please rotate credentials.');
      return decrypted.toString();
    } catch (legacyErr) {
      console.error('[CRYPTO-DECRYPT-FATAL] Decryption failed for both current and legacy keys! Env ENCRYPTION_KEY Length:', (process.env.ENCRYPTION_KEY || '').length, 'Error:', legacyErr.message);
      throw new Error('DECRYPTION_FAILED');
    }
  }
}

let lastConnectionStatus = {
  timestamp: 0,
  ok: false
};

async function getAIIntegrationStatus(store, companyId = 'default') {
  let providerConfigured = false;
  let providerEnabled = false;
  let apiKeyValid = false;
  let modelConfigured = false;
  let providerOnline = false;

  let activeProvider = null;
  try {
    const { query } = require('../config/database');
    const { rows } = await query(
      `SELECT * FROM provider_keys WHERE tenant_id = $1 AND enabled = TRUE LIMIT 1`,
      [companyId]
    );
    if (rows.length > 0) {
      const dbProvider = rows[0];
      providerConfigured = true;
      providerEnabled = dbProvider.enabled;
      
      let mappedProviderId = dbProvider.provider.toLowerCase();
      if (mappedProviderId === 'anthropic') mappedProviderId = 'claude';
      if (mappedProviderId === 'google') mappedProviderId = 'gemini';

      const decryptedKey = decrypt(dbProvider.api_key);
      apiKeyValid = !!(decryptedKey && decryptedKey.trim() !== '' && !decryptedKey.includes('*****'));
      modelConfigured = !!(dbProvider.model && dbProvider.model.trim() !== '');

      if (apiKeyValid && modelConfigured && providerEnabled) {
        if (Date.now() - lastConnectionStatus.timestamp < 300000) {
          providerOnline = lastConnectionStatus.ok;
        } else {
          const testRes = await testProviderConnection({
            id: mappedProviderId,
            apiKey: decryptedKey,
            model: dbProvider.model
          }, { model: dbProvider.model, message: 'ping' });
          providerOnline = !!testRes.ok;
          lastConnectionStatus = { timestamp: Date.now(), ok: providerOnline };
        }
      }
    }
  } catch (err) {
    console.error('[AI SERVICE] getAIIntegrationStatus failed:', err.message);
  }

  if (!providerConfigured) {
    const providers = store?.aiConfig?.advancedAISettings?.providers || [];
    const globalActive = providers.find((p) => p.active);
    if (globalActive) {
      providerConfigured = true;
      providerEnabled = !!globalActive.active;
      apiKeyValid = !!(globalActive.apiKey && globalActive.apiKey.trim() !== '');
      modelConfigured = !!(globalActive.model && globalActive.model.trim() !== '');

      if (apiKeyValid && modelConfigured && providerEnabled) {
        if (Date.now() - lastConnectionStatus.timestamp < 300000) {
          providerOnline = lastConnectionStatus.ok;
        } else {
          const testRes = await testProviderConnection(globalActive, { model: globalActive.model, message: 'ping' });
          providerOnline = !!testRes.ok;
          lastConnectionStatus = { timestamp: Date.now(), ok: providerOnline };
        }
      }
    }
  }

  const aiOn = providerConfigured && providerEnabled && apiKeyValid && modelConfigured && providerOnline;

  return {
    providerConfigured,
    providerEnabled,
    apiKeyValid,
    modelConfigured,
    providerOnline,
    aiOn
  };
}

async function testAIConnection({ store, providerId, model, message, prompt, agentKey, agentName, companyId }) {
  const resolvedCompanyId = companyId || store?.activeCompanyId || 'default';
  
  // Try to resolve user-scoped key first
  let resolvedProvider = null;
  if (providerId) {
    try {
      const { query } = require('../config/database');
      const { rows } = await query(
        `SELECT * FROM provider_keys WHERE tenant_id = $1 AND provider = $2 LIMIT 1`,
        [resolvedCompanyId, providerId.toLowerCase()]
      );
      if (rows.length > 0) {
        let mappedProviderId = rows[0].provider.toLowerCase();
        if (mappedProviderId === 'anthropic') mappedProviderId = 'claude';
        if (mappedProviderId === 'google') mappedProviderId = 'gemini';

        resolvedProvider = {
          id: mappedProviderId,
          apiKey: decrypt(rows[0].api_key),
          model: model || rows[0].model,
          active: true
        };
      }
    } catch {}
  }

  if (!resolvedProvider) {
    const providers = store?.aiConfig?.advancedAISettings?.providers || [];
    const providerObj =
      providers.find((item) => String(item.id).toLowerCase() === String(providerId || '').toLowerCase()) ||
      providers.find((item) => item.active) ||
      providers[0];

    if (providerObj) {
      resolvedProvider = {
        id: providerObj.id,
        apiKey: providerObj.apiKey,
        model: model || providerObj.model,
        active: providerObj.active
      };
    }
  }

  const aiAgentService = require('../ai-agents/services/aiAgentService');
  let matchedAgent = null;
  try {
    await aiAgentService.listAgents();
    const resolvedKey = String(agentKey || agentName || '').trim().toLowerCase();
    matchedAgent = aiAgentService.getAgentsSync().find(
      (a) =>
        (resolvedKey && String(a.key).toLowerCase() === resolvedKey) ||
        (resolvedKey && String(a.name).toLowerCase() === resolvedKey) ||
        (prompt && a.personality === prompt) ||
        (prompt && a.prompt === prompt) ||
        (prompt && a.name === prompt) ||
        (prompt && a.key === prompt)
    );
  } catch {}

  // Create temporary simulator agent if none matched
  if (!matchedAgent) {
    matchedAgent = {
      name: agentName || 'Simulador',
      personality: prompt || 'Prestativo',
      sector: 'Simulação',
      objective: 'Responder testes',
    };
  }

  const fullPrompt = compileSystemPrompt(matchedAgent, store);
  const memoriesUsed = matchedAgent?.memory || 'Padrão global (último pedido, preferências)';
  const rulesTriggered = matchedAgent?.rules || 'Padrão global (reativação automática)';

  if (!resolvedProvider) {
    return {
      ok: false,
      status: 'error',
      error: 'Nenhum provider configurado.',
      fullPrompt,
      memoriesUsed,
      rulesTriggered,
    };
  }

  const result = await testProviderConnection(resolvedProvider, {
    model,
    message,
    prompt: fullPrompt,
    maxTokens: Number(store?.aiConfig?.advancedAISettings?.maxTokens) || 500,
    temperature: typeof matchedAgent?.temperature === 'number'
      ? matchedAgent.temperature
      : (store?.aiConfig?.advancedAISettings && typeof store.aiConfig.advancedAISettings.temperature === 'number'
         ? store.aiConfig.advancedAISettings.temperature
         : 0.6),
    timeoutMs: 45000,
  });
  result.fullPrompt = fullPrompt;
  result.memoriesUsed = memoriesUsed;
  result.rulesTriggered = rulesTriggered;
  return result;
}

async function processAI({ contact, history, message, store, agentName, companyId }) {
  const startedAt = Date.now();
  if (!store || !store.aiConfig) {
    console.warn('[AI SERVICE] No store or aiConfig available');
    return null;
  }

  const resolvedCompanyId = companyId || store?.activeCompanyId || 'default';
  const integrationStatus = await getAIIntegrationStatus(store, resolvedCompanyId);
  if (!integrationStatus.aiOn) {
    console.warn('[AI SERVICE] AI is OFF due to failed configuration checks:', integrationStatus);
    return null;
  }

  // Load user-scoped key
  let activeProvider = null;
  try {
    const { query } = require('../config/database');
    const { rows } = await query(
      `SELECT * FROM provider_keys WHERE tenant_id = $1 AND enabled = TRUE LIMIT 1`,
      [resolvedCompanyId]
    );
    if (rows.length > 0) {
      const dbProvider = rows[0];
      let mappedProviderId = dbProvider.provider.toLowerCase();
      if (mappedProviderId === 'anthropic') mappedProviderId = 'claude';
      if (mappedProviderId === 'google') mappedProviderId = 'gemini';

      const decryptedKey = decrypt(dbProvider.api_key);
      activeProvider = {
        id: mappedProviderId,
        apiKey: decryptedKey,
        model: dbProvider.model,
        active: true
      };
    }
  } catch (err) {
    console.error('[AI SERVICE] failed to load active provider key from db:', err.message);
  }

  if (!activeProvider) {
    const providers = store.aiConfig?.advancedAISettings?.providers || [];
    const globalActive = providers.find((p) => p.active);
    if (globalActive) {
      activeProvider = {
        id: globalActive.id,
        apiKey: globalActive.apiKey,
        model: globalActive.model,
        active: true
      };
    }
  }

  if (!activeProvider) {
    console.warn('[AI SERVICE] No active AI provider resolved');
    return null;
  }

  const { id: providerId, apiKey, model } = activeProvider;
  if (!apiKey && providerId !== 'ollama') {
    console.warn(`[AI SERVICE] API Key is missing for active provider: ${providerId}`);
    return null;
  }

  const aiAgentService = require('../ai-agents/services/aiAgentService');
  let resolvedAgent = null;

  try {
    await aiAgentService.listAgents();
    resolvedAgent = aiAgentService.findByNameSync(agentName || 'Camila');
  } catch (err) {
    console.error('[AI SERVICE] Failed to resolve active agent configuration:', err);
  }

  if (!resolvedAgent) {
    resolvedAgent = {
      name: agentName || 'Camila',
      sector: 'Geral',
      objective: 'Atendimento comercial',
      personality: 'Assistente virtual simpática.',
    };
  }

  const systemPrompt = compileSystemPrompt(resolvedAgent, store, contact);
  console.log('[AI SERVICE] System Prompt Compiled:\n' + systemPrompt);
  const slicedHistory = Array.isArray(history) ? history.slice(-8) : [];

  // Response Caching (60s TTL)
  const historyHashString = slicedHistory.map(h => `${h.role}:${h.content}`).join('|');
  const cacheKeySource = `${contact.phone || 'unknown'}:${message || ''}:${historyHashString}:${systemPrompt}`;
  const cacheKey = crypto.createHash('md5').update(cacheKeySource).digest('hex');

  // Clean up expired cache items
  for (const [k, v] of responseCache.entries()) {
    if (Date.now() - v.timestamp > RESPONSE_CACHE_TTL_MS) {
      responseCache.delete(k);
    }
  }

  const cached = responseCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < RESPONSE_CACHE_TTL_MS)) {
    console.log(`[AI SERVICE] Cache hit for message: "${message.substring(0, 30)}..." from contact: ${contact.phone}`);
    const hitResult = { ...cached.result };
    hitResult.responseTimeMs = Date.now() - startedAt;
    return hitResult;
  }

  const agentTemperature = resolvedAgent?.temperature;
  try {
    let reply = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...slicedHistory.map((h) => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content || '',
      })),
      { role: 'user', content: message },
    ];

    const maxTokens = Number(store.aiConfig.advancedAISettings?.maxTokens) || 600;
    const temperature = typeof agentTemperature === 'number'
      ? agentTemperature
      : (store.aiConfig?.advancedAISettings && typeof store.aiConfig.advancedAISettings.temperature === 'number'
         ? store.aiConfig.advancedAISettings.temperature
         : 0.6);

    if (providerId === 'claude') {
      // Claude Anthropic API
      const userAndAssistantMessages = messages.filter(
        (m) => m.role === 'user' || m.role === 'assistant'
      );
      console.log('[AI PAYLOAD] Request sent to Claude:', JSON.stringify({
        url: 'https://api.anthropic.com/v1/messages',
        model: model || 'claude-3-5-sonnet-20241022',
        system: systemPrompt,
        messages: userAndAssistantMessages,
        temperature,
        max_tokens: maxTokens,
        apiKeySnippet: apiKey ? apiKey.substring(0, 10) + '...' : null
      }, null, 2));

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: maxTokens,
          temperature: temperature,
          system: systemPrompt,
          messages: userAndAssistantMessages,
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 15000,
        }
      );

      reply = response.data?.content?.[0]?.text || '';
      promptTokens = response.data?.usage?.input_tokens || 0;
      completionTokens = response.data?.usage?.output_tokens || 0;
      totalTokens = promptTokens + completionTokens;
    } else {
      // OpenAI, Gemini (compatibility), Groq, Deepseek, OpenRouter, Ollama
      let baseURL = 'https://api.openai.com/v1';
      if (providerId === 'gemini') {
        baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai';
      } else if (providerId === 'groq') {
        baseURL = 'https://api.groq.com/openai/v1';
      } else if (providerId === 'deepseek') {
        baseURL = 'https://api.deepseek.com/v1';
      } else if (providerId === 'openrouter') {
        baseURL = 'https://openrouter.ai/api/v1';
      } else if (providerId === 'ollama') {
        baseURL = 'http://localhost:11434/v1';
      }

      console.log('[AI PAYLOAD] Request sent to provider:', JSON.stringify({
        url: `${baseURL}/chat/completions`,
        model: model || 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: maxTokens,
        apiKeySnippet: apiKey ? apiKey.substring(0, 10) + '...' : null
      }, null, 2));

      const response = await axios.post(
        `${baseURL}/chat/completions`,
        {
          model: model || 'gpt-4o-mini',
          messages,
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      reply = response.data?.choices?.[0]?.message?.content || '';
      promptTokens = response.data?.usage?.prompt_tokens || 0;
      completionTokens = response.data?.usage?.completion_tokens || 0;
      totalTokens = response.data?.usage?.total_tokens || (promptTokens + completionTokens);
    }

    if (totalTokens === 0) {
      // Fallback token approximation
      promptTokens = Math.ceil((systemPrompt.length + message.length) / 4);
      completionTokens = Math.ceil(reply.length / 4);
      totalTokens = promptTokens + completionTokens;
    }

    // Save log entry asynchronously
    await aiLogService.saveLogEntry(
      {
        conversationId: contact.conversationId || contact.phone,
        contactName: contact.name,
        messageSent: message,
        messageReceived: reply,
        provider: providerId,
        model: model || 'default',
        promptTokens,
        completionTokens,
        totalTokens,
        sessionId: contact.sessionId || store?.sessionId || null,
      },
      store
    );

    const finalResult = {
      intent: 'information',
      leadScore: 0.5,
      reply,
      suggestion: null,
      provider: providerId,
      model: model || 'default',
      responseTimeMs: Date.now() - startedAt,
      promptTokens,
      completionTokens,
      totalTokens,
      agentName: resolvedAgent?.name || agentName || 'Camila',
    };

    responseCache.set(cacheKey, {
      timestamp: Date.now(),
      result: finalResult
    });

    return finalResult;
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error(`[AI SERVICE] API Error calling ${providerId}:`, errorMsg);

    // Save error log entry
    await aiLogService
      .saveLogEntry(
        {
          conversationId: contact.phone,
          contactName: contact.name,
          messageSent: message,
          messageReceived: `[Erro da IA: ${errorMsg}]`,
          provider: providerId,
          model: model || 'default',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          sessionId: contact.sessionId || store?.sessionId || null,
        },
        store
      )
      .catch(() => {});

    return null;
  }
}

function clearResponseCache() {
  responseCache.clear();
  console.log('[AI SERVICE] Response cache cleared successfully.');
}

module.exports = { processAI, testAIConnection, testProviderConnection, getAIIntegrationStatus, clearResponseCache };

