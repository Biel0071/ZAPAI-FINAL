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
  const history = Array.isArray(options.history) ? options.history : [];
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
          messages: [
            ...history.map(h => ({
              role: h.role === 'assistant' || h.role === 'bot' ? 'assistant' : 'user',
              content: h.content || '',
            })),
            { role: 'user', content: message }
          ],
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
            ...history.map(h => ({
              role: h.role === 'assistant' || h.role === 'bot' ? 'assistant' : 'user',
              content: h.content || '',
            })),
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
  const agentName = String(agent?.name || '').trim();
  if (!agentName) return basePrompt;

  return String(basePrompt || '')
    .replace(/\{\{\s*agent_name\s*\}\}/gi, agentName)
    .replace(/\[NOME_DO_ATENDENTE\]/gi, agentName);
}

const RESPONSE_STYLE_DEFAULT_WORDS = Object.freeze({
  one_sentence: 20,
  ultra_short: 45,
  short_natural: 90,
  elaborate: 220,
});

function resolveResponseWordLimit(agent = {}) {
  const style = String(agent.responseStyle || 'short_natural');
  const customLimit = Number(agent.maxWords);
  const limit = customLimit > 0
    ? customLimit
    : (RESPONSE_STYLE_DEFAULT_WORDS[style] || RESPONSE_STYLE_DEFAULT_WORDS.short_natural);
  return Math.min(Math.max(Math.round(limit), 5), 500);
}

function enforceResponseWordLimit(text, agent = {}) {
  const normalized = String(text || '').trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const limit = resolveResponseWordLimit(agent);
  if (words.length <= limit) return normalized;
  return `${words.slice(0, limit).join(' ').replace(/[,:;\-]+$/, '')}...`;
}



function compileSystemPrompt(agent, store, contact = null) {
  const agentName = agent?.name || 'Atendente';
  const sector = agent?.sector || 'Geral';
  const objective = agent?.objective || 'Atendimento comercial';
  const personality = agent?.personality || agent?.prompt || '';
  const responseStyle = agent?.responseStyle || 'short_natural';
  const maxWords = resolveResponseWordLimit(agent);

  let styleInstruction = '';
  if (responseStyle === 'ultra_short') {
    const limit = maxWords;
    styleInstruction = `- Diretriz de Tamanho: Seja extremamente objetivo, curto e direto ao ponto. Responda em no máximo 1 ou 2 parágrafos curtos, com um limite máximo estrito de ${limit} palavras. Não faça rodeios e evite explicações longas.\n`;
  } else if (responseStyle === 'one_sentence') {
    const limit = maxWords;
    styleInstruction = `- Diretriz de Tamanho: Seja ultracurto. Responda com no máximo uma ou duas frases curtas, com um limite máximo estrito de ${limit} palavras. Não faça saudações repetidas e vá direto ao ponto.\n`;
  } else if (responseStyle === 'elaborate') {
    const limit = maxWords;
    styleInstruction = `- Diretriz de Tamanho: Responda de forma detalhada, completa e explicativa. Traga o máximo de contexto e detalhes necessários, com um limite sugerido de até ${limit} palavras para esclarecer completamente o cliente.\n`;
  } else {
    const limit = maxWords;
    styleInstruction = `- Diretriz de Tamanho: Responda de forma equilibrada, mantendo uma conversa natural, amigável e direta ao ponto, com um limite máximo estrito de ${limit} palavras.\n`;
  }

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
  compiled += styleInstruction;
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
  compiled += `- Mapeamento de Sinônimos/Abreviações: O cliente pode usar termos abreviados ou variações para se referir aos produtos da loja. Você deve sempre reconhecer e mapear corretamente esses termos. Exemplos importantes:\n`;
  compiled += `  * 'CP3', 'CP-3', 'CP III' e 'CP-III' referem-se ao cimento CPIII (ex: 'Cimento Campeão CPIII de 50kg' ou 'Cimento LIZ CP III de 50kg').\n`;
  compiled += `  * 'liz' ou 'Cimento Liz' refere-se especificamente ao 'Cimento LIZ CP III de 50kg'.\n`;
  compiled += `  * 'campeao' ou 'Cimento Campeão' refere-se especificamente ao 'Cimento Campeão CPIII de 50kg'.\n`;
  compiled += `  * Sempre valide com o cliente qual das marcas (Liz ou Campeão) ou tipos específicos ele deseja quando houver mais de uma opção correspondente.\n\n`;
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
  // 10. CAPACIDADES DE MÍDIA, ENVIOS E RESPOSTAS RÁPIDAS DA LOJA
  compiled += `[CAPACIDADES DE MÍDIA, ENVIOS E RESPOSTAS RÁPIDAS DA LOJA]\n`;
  compiled += `- CAPACIDADE DE ENVIO DE MÍDIAS: Você POSSUI suporte total e ativo para enviar fotos, imagens de produtos, catálogos em PDF, vídeos e áudios de voz aos clientes!\n`;
  compiled += `- REGRA CRÍTICA DE MÍDIA: JAMAIS diga ao cliente que "não consegue enviar fotos", "não pode mandar imagens" ou que "é apenas texto". Essa afirmação é estritamente PROIBIDA e considerada um erro grave.\n`;
  compiled += `- Quando o cliente solicitar foto, imagem, demonstração ou tabela de preços em PDF (ex: 'Me manda a foto', 'Tem foto da churrasqueira?', 'Manda catálogo de cimentos'), você DEVE responder confirmando com entusiasmo que está enviando a foto/mídia do produto e solicitar se ele deseja ver mais detalhes ou realizar o pedido!\n`;
  compiled += `- Respostas Rápidas e Mídias Mapeadas da Loja:\n`;
  const quickRepliesList = agent?.quickReplies || store?.quickReplies || [];
  if (Array.isArray(quickRepliesList) && quickRepliesList.length > 0) {
    for (const qr of quickRepliesList) {
      const label = typeof qr === 'string' ? qr : (qr.label || qr.cmd || qr.text);
      const text = typeof qr === 'string' ? qr : qr.text;
      const media = qr.mediaUrl || qr.fileUrl ? `[Anexo de Mídia: ${qr.mediaUrl || qr.fileUrl}]` : '';
      compiled += `  * Resposta Rápida/Mídia: "${label}" -> Conteúdo: "${text}" ${media}\n`;
    }
  } else {
    compiled += `  * Mídias cadastradas para envio automático: Fotos de Churrasqueiras pré-moldadas, Cimento Liz/Campeão, Tijolos e Tabela de Preços da Loja.\n`;
  }
  compiled += `\n`;

  // 11. DIRETRIZES GLOBAIS DE ATENDIMENTO
  compiled += `[DIRETRIZES GLOBAIS DE ATENDIMENTO]\n`;
  compiled += `- Sempre responda em português brasileiro de forma natural, calorosa, empática, simpática e profissional.\n`;
  compiled += `- Respeite rigorosamente a Diretriz de Tamanho configurada para o seu perfil no bloco [TOM/PERSONALIDADE]. Respostas muito longas para atendentes objetivos ou muito curtas para detalhados serão consideradas falhas.\n`;
  compiled += `- Use uma variedade de palavras e expressões para evitar respostas repetitivas ou mecânicas. Adapte o tom ao humor e estilo de escrita do cliente.\n`;
  compiled += `- TRANSCRIÇÃO DE ÁUDIOS DE VOZ: Se o cliente enviar uma mensagem de áudio, ela será automaticamente convertida em texto e entregue como '[Áudio Transcrito]: "..."'. Trate essa transcrição exatamente como se o cliente tivesse digitado o texto. Extraia produtos, quantidades, dúvidas ou dados de entrega fornecidos no áudio e DÊ SEGUIMENTO NORMAL ao atendimento, avançando no funil sem repetir perguntas sobre o que já foi dito no áudio!\n`;
  compiled += `- SISTEMA DE ETAPAS DE ATENDIMENTO: Siga rigorosamente o atendimento por etapas. Não avance etapas sem que a anterior esteja concluída. Nunca pergunte novamente por informações que o cliente já forneceu (consulte o histórico recente e a memória). As etapas são:\n`;
  compiled += `  1. Levantamento de Necessidades (Estágio: new_lead / interested): Pergunte quais produtos e quantidades o cliente precisa. Se o cliente já informou produtos e quantidades na mensagem inicial ou em áudio (ex: 'queria 150 cimentos'), CONFIRME e avance direto para a Etapa 2. Não pergunte o que ele quer novamente!\n`;
  compiled += `  2. Cotação de Preços (Estágio: price_sent): Apresente os preços dos produtos desejados conforme a tabela de produtos cadastrada. Se houver mais de uma opção (ex: Campeão vs Liz), dê as opções e pergunte qual prefere.\n`;
  compiled += `  3. Entrega ou Retirada (Estágio: negotiation): Pergunte se o cliente prefere receber no endereço ou se deseja retirar na loja. Se for entrega, solicite o CEP ou endereço completo para cálculo do frete. Não passe para a próxima etapa sem o endereço de entrega ou confirmação de retirada.\n`;
  compiled += `  4. Forma de Pagamento e Fechamento (Estágio: ready_to_buy): Com os produtos, quantidades e frete definidos, apresente as opções de pagamento (PIX com 5% desc, Crédito em até 10x sem juros, ou Boleto faturado sob consulta). Solicite a confirmação final do pedido.\n`;
  compiled += `  5. Conclusão (Estágio: closed): Agradeça e confirme que o pedido foi finalizado com sucesso. Informe que a equipe de faturamento entrará em contato em breve.\n`;
  compiled += `- Sinta-se livre para conversar sobre assuntos gerais ou saudações do dia a dia, mantendo um diálogo agradável e prestativo, mesmo que as respostas exatas não estejam descritas no prompt.\n`;
  compiled += `- Nunca mencione que você é um robô ou inteligência artificial, a menos que seja estritamente necessário para realizar o transbordo humano.\n`;
  compiled += `- Se o cliente solicitar atendimento humano ou se a IA não souber responder sobre preços ou condições críticas que você não tem acesso, acione o transbordo imediatamente.\n`;
  compiled += `- Continue o atendimento do ponto atual; não reinicie com saudações repetidas se já existe histórico.\n`;
  compiled += `- NÃO REPITA PERGUNTAS que o cliente já respondeu em texto ou áudio. Use as quantidades, produtos e preferências presentes no contexto.\n`;
  compiled += `- Seja flexível e criativo nas respostas gerais, mas evite inventar preços específicos, prazos de entrega ou condições financeiras que não estejam configurados no seu contexto.\n`;
  compiled += `\n`;

  // 11. ANÁLISE DE CONTEXTO E METADADOS DO FUNIL
  compiled += `[ANÁLISE DE CONTEXTO E METADADOS DO FUNIL]\n`;
  compiled += `Ao final da sua resposta, você DEVE analisar a mensagem recebida e o histórico para definir o estágio do funil do lead e marcadores (tags). Você DEVE obrigatoriamente anexar um bloco JSON de metadados no formato exato abaixo:\n`;
  compiled += `:::analysis\n`;
  compiled += `{\n`;
  compiled += `  "funnel_stage": "new_lead" | "interested" | "price_sent" | "negotiation" | "ready_to_buy" | "closed" | "lost",\n`;
  compiled += `  "tags_to_add": ["tag1", "tag2"],\n`;
  compiled += `  "address": "endereço completo de entrega caso tenha sido fornecido ou confirmado no fechamento",\n`;
  compiled += `  "phone": "telefone de contato caso tenha sido fornecido"\n`;
  compiled += `}\n`;
  compiled += `:::\n`;
  compiled += `Regras de análise:\n`;
  compiled += `- Escolha o estágio do funil condizente com a evolução do diálogo. Se o cliente pediu preços/orçamento, mude para "price_sent". Se demonstrou interesse real de compra, mude para "ready_to_buy". Se confirmou o fechamento da compra (por exemplo, escolhendo pagar no local ou agendando a entrega), mude para "closed". Se o cliente deserdar ou desistir, use "lost".\n`;
  compiled += `- Adicione marcadores relevantes em tags_to_add (com minúsculas, ex: "cimento", "areia", "vip", "reclamacao", "urgente").\n`;
  compiled += `- Se o cliente forneceu ou confirmou os dados de entrega (endereço, bairro, rua, número, etc.), você DEVE extrair e colocar no campo "address". Se houver telefone de contato ou celular, coloque no campo "phone".\n`;

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

async function testAIConnection({ store, providerId, model, message, prompt, agentKey, agentName, companyId, temperature, responseStyle, history, maxWords }) {
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
    await aiAgentService.listAgents(resolvedCompanyId);
    const resolvedKey = String(agentKey || agentName || '').trim().toLowerCase();
    matchedAgent = aiAgentService.getAgentsSync(resolvedCompanyId).find(
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

  // Override properties for dynamic testing in the simulator
  const finalAgent = {
    ...matchedAgent,
  };
  if (temperature !== undefined) {
    finalAgent.temperature = Number(temperature);
  }
  if (responseStyle !== undefined) {
    finalAgent.responseStyle = responseStyle;
  }
  if (prompt !== undefined) {
    finalAgent.personality = prompt;
  }
  if (maxWords !== undefined) {
    finalAgent.maxWords = Number(maxWords);
  }

  const fullPrompt = compileSystemPrompt(finalAgent, store);
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
    history,
    maxTokens: Number(store?.aiConfig?.advancedAISettings?.maxTokens) || 500,
    temperature: typeof finalAgent?.temperature === 'number'
      ? finalAgent.temperature
      : (store?.aiConfig?.advancedAISettings && typeof store.aiConfig.advancedAISettings.temperature === 'number'
         ? store.aiConfig.advancedAISettings.temperature
         : 0.6),
    timeoutMs: 45000,
  });
  if (result.ok && result.response) {
    let replyClean = result.response;
    let analysisResult = null;
    if (replyClean.includes(':::analysis')) {
      try {
        const parts = replyClean.split(':::analysis');
        replyClean = parts[0].trim();
        let block = parts[1].split(':::')[0].trim();
        block = block.replace(/```json/g, '').replace(/```/g, '').trim();
        analysisResult = JSON.parse(block);

        if (analysisResult && analysisResult.address) {
          const coords = await geocodeAddress(analysisResult.address);
          if (coords) {
            analysisResult.coordinates = coords;
          }
        }
      } catch (err) {
        console.error('[AI SERVICE testAIConnection] Failed to parse analysis block:', err.message);
      }
    }
    result.response = enforceResponseWordLimit(replyClean, finalAgent);
    result.analysis = analysisResult;
  }

  result.fullPrompt = fullPrompt;
  result.memoriesUsed = memoriesUsed;
  result.rulesTriggered = rulesTriggered;

  try {
    const { syncEngine } = require('./sync');
    syncEngine.dispatch('ai.response', {
      provider: resolvedProvider,
      model: model || 'default',
      agentName: finalAgent.name,
      replyLength: result.response?.length || 0,
      tenantId: 'default',
    });
  } catch (_) {}

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
    await aiAgentService.listAgents(resolvedCompanyId);
    resolvedAgent = aiAgentService.findByNameSync(agentName, resolvedCompanyId);
  } catch (err) {
    console.error('[AI SERVICE] Failed to resolve active agent configuration:', err);
  }

  if (!resolvedAgent) {
    console.warn(`[AI SERVICE] No store-specific agent configured for tenant ${resolvedCompanyId}.`);
    return null;
  }

  const agentMemoryGraphService = require('./agentMemoryGraphService');
  const resolvedAgentKey = resolvedAgent?.key || resolvedAgent?.name || agentName || 'agent';
  let graphMemory = { prompt: '', memories: [] };
  try {
    graphMemory = await agentMemoryGraphService.recallRelevantMemory({
      agentKey: resolvedAgentKey,
      agentName: resolvedAgent?.name || agentName,
      companyId: resolvedCompanyId,
      contact,
      message,
    });
  } catch (memoryError) {
    console.warn('[AI MEMORY GRAPH] Recall unavailable:', memoryError.message);
  }

  const systemPrompt = `${compileSystemPrompt(resolvedAgent, store, contact)}${graphMemory.prompt}`;
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

    // 11. EXTRAIR E LIMPAR BLOCO DE ANÁLISE :::analysis
    let replyClean = reply || '';
    let analysisResult = null;
    if (replyClean.includes(':::analysis')) {
      try {
        const parts = replyClean.split(':::analysis');
        replyClean = parts[0].trim();
        let block = parts[1].split(':::')[0].trim();
        block = block.replace(/```json/g, '').replace(/```/g, '').trim();
        analysisResult = JSON.parse(block);

        if (analysisResult && analysisResult.address) {
          const coords = await geocodeAddress(analysisResult.address);
          if (coords) {
            analysisResult.coordinates = coords;
          }
        }
        console.log('[AI SERVICE] Analysis parsed successfully:', analysisResult);
      } catch (err) {
        console.error('[AI SERVICE] Failed to parse analysis block:', err.message);
      }
    }

    // Save log entry asynchronously
    replyClean = enforceResponseWordLimit(replyClean, resolvedAgent);

    await aiLogService.saveLogEntry(
      {
        conversationId: contact.conversationId || contact.phone,
        contactName: contact.name,
        messageSent: message,
        messageReceived: replyClean,
        provider: providerId,
        model: model || 'default',
        promptTokens,
        completionTokens,
        totalTokens,
        sessionId: contact.sessionId || store?.sessionId || null,
      },
      store
    );

    try {
      await agentMemoryGraphService.learnFromInteraction({
        agentKey: resolvedAgentKey,
        companyId: resolvedCompanyId,
        contact,
        message,
        reply: replyClean,
      });
    } catch (memoryError) {
      console.warn('[AI MEMORY GRAPH] Learning unavailable:', memoryError.message);
    }

    const finalResult = {
      intent: 'information',
      leadScore: 0.5,
      reply: replyClean,
      analysis: analysisResult,
      suggestion: null,
      provider: providerId,
      model: model || 'default',
      responseTimeMs: Date.now() - startedAt,
      promptTokens,
      completionTokens,
      totalTokens,
      agentName: resolvedAgent?.name || agentName || 'Atendente',
      memoriesUsed: graphMemory.memories,
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

async function refineAgentPrompt({ store, currentPrompt, instruction, companyId }) {
  const resolvedCompanyId = companyId || store?.activeCompanyId || 'default';
  let resolvedProvider = null;
  
  try {
    const { query } = require('../config/database');
    const { rows } = await query(
      `SELECT * FROM provider_keys WHERE tenant_id = $1 AND enabled = TRUE LIMIT 1`,
      [resolvedCompanyId]
    );
    if (rows.length > 0) {
      let mappedProviderId = rows[0].provider.toLowerCase();
      if (mappedProviderId === 'anthropic') mappedProviderId = 'claude';
      if (mappedProviderId === 'google') mappedProviderId = 'gemini';

      resolvedProvider = {
        id: mappedProviderId,
        apiKey: decrypt(rows[0].api_key),
        model: rows[0].model,
        active: true
      };
    }
  } catch {}

  if (!resolvedProvider) {
    const providers = store?.aiConfig?.advancedAISettings?.providers || [];
    const providerObj = providers.find((item) => item.active) || providers[0];
    if (providerObj) {
      resolvedProvider = {
        id: providerObj.id,
        apiKey: providerObj.apiKey,
        model: providerObj.model,
        active: providerObj.active
      };
    }
  }

  if (!resolvedProvider) {
    throw new Error('Nenhum provedor de IA ativo configurado para refinamento.');
  }

  const refPrompt = `Você é um engenheiro de prompt especialista. Sua tarefa é refinar as instruções de personalidade/prompt de um atendente virtual com base nas solicitações de ajuste fornecidas pelo usuário.

Instruções atuais do atendente:
"""
${currentPrompt || ''}
"""

Solicitação de ajuste do usuário:
"${instruction}"

Regras de Refinamento:
1. Aplique as modificações solicitadas (adicione, remova ou altere as regras de acordo com o pedido).
2. Mantenha o idioma em português.
3. Preserve a estrutura geral, a clareza e as informações de contato/valores que já existiam, a menos que tenha sido solicitado expressamente para retirá-los.
4. Retorne APENAS o novo texto do prompt final refinado, sem introduções, explicações, blocos de código (Markdown) ou comentários.`;

  const result = await testProviderConnection(resolvedProvider, {
    model: resolvedProvider.model,
    message: 'Por favor, execute o refinamento das instruções conforme solicitado acima.',
    prompt: refPrompt,
    maxTokens: 1500,
    temperature: 0.3,
    timeoutMs: 30000,
  });

  if (!result.ok) {
    throw new Error(result.error || 'Falha ao processar o refinamento com o provedor de IA.');
  }

  return result.response.trim();
}

async function geocodeAddress(address) {
  if (!address) return null;
  let resolvedAddress = address;

  // 1. Detect CEP (ex: 30640-010 or 30640010)
  const cepMatch = address.match(/\b(\d{5})-?(\d{3})\b/);
  if (cepMatch) {
    const cep = cepMatch[1] + cepMatch[2];
    try {
      console.log(`[Geocoding CEP] Found CEP: ${cep}. Querying ViaCEP...`);
      const viacepRes = await axios.get(`https://viacep.com.br/ws/${cep}/json/`, { timeout: 4000 });
      if (viacepRes.data && !viacepRes.data.erro) {
        const { logradouro, bairro, localidade, uf } = viacepRes.data;
        // Try to extract house/building number from original address
        const numberMatch = address.match(/(?:nº|numero|num|n|no)\s*(\d+)/i);
        const streetNumber = numberMatch ? ` ${numberMatch[1]}` : "";
        resolvedAddress = `${logradouro}${streetNumber}, ${bairro}, ${localidade} - ${uf}, Brasil`;
        console.log(`[Geocoding CEP] Resolved CEP ${cep} successfully: ${resolvedAddress}`);
      }
    } catch (err) {
      console.warn(`[Geocoding CEP] ViaCEP lookup failed for CEP ${cep}:`, err.message);
    }
  }

  // 2. Query OSM Nominatim with resolved or original address
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: resolvedAddress,
        format: 'json',
        limit: 1,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'ZapFlowAI/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      const lat = parseFloat(response.data[0].lat);
      const lng = parseFloat(response.data[0].lon);
      return { lat, lng };
    }

    // 3. Fallback: If Nominatim failed on resolved address, try with CEP directly or original address
    if (cepMatch && resolvedAddress !== address) {
      console.log(`[Geocoding Fallback] Nominatim failed for resolved address. Retrying with original text...`);
      const fallbackResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'ZapFlowAI/1.0'
        }
      });
      if (fallbackResponse.data && fallbackResponse.data.length > 0) {
        const lat = parseFloat(fallbackResponse.data[0].lat);
        const lng = parseFloat(fallbackResponse.data[0].lon);
        return { lat, lng };
      }
    }
  } catch (err) {
    console.error('[Geocoding] Failed to geocode address:', err.message);
  }
  return null;
}

async function transcribeAudio({ mediaUrl, companyId }) {
  const { OpenAI } = require('openai');
  const fs = require('fs');
  const path = require('path');
  const axios = require('axios');

  const resolvedCompanyId = companyId || 'default';
  
  // 1. Fetch enabled OpenAI/Groq key
  const { query } = require('../config/database');
  const { rows } = await query(
    `SELECT * FROM provider_keys WHERE tenant_id = $1 AND enabled = TRUE AND (LOWER(provider) = 'openai' OR LOWER(provider) = 'groq') ORDER BY provider LIMIT 1`,
    [resolvedCompanyId]
  );
  
  if (rows.length === 0) {
    throw new Error('Nenhum provedor de IA com suporte a transcrição (OpenAI ou Groq) está ativo.');
  }
  
  const providerRow = rows[0];
  const apiKey = decrypt(providerRow.api_key);
  const providerName = providerRow.provider.toLowerCase();
  
  let baseURL = 'https://api.openai.com/v1';
  let modelName = 'whisper-1';
  if (providerName === 'groq') {
    baseURL = 'https://api.groq.com/openai/v1';
    modelName = 'whisper-large-v3-turbo';
  }
  
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });
  
  // 2. Locate or download file
  let isLocal = false;
  let localPath = '';
  let filename = 'audio.ogg';
  
  if (typeof mediaUrl === 'string' && mediaUrl.trim() !== '') {
    if (fs.existsSync(mediaUrl)) {
      isLocal = true;
      localPath = mediaUrl;
      filename = path.basename(mediaUrl);
    } else if (mediaUrl.startsWith('/') || mediaUrl.includes('/media/')) {
      const filenamePart = mediaUrl.split('/').pop().split('?')[0];
      const storagePath = path.join(__dirname, '..', '..', 'storage', 'media', filenamePart);
      if (fs.existsSync(storagePath)) {
        isLocal = true;
        localPath = storagePath;
        filename = filenamePart;
      }
    }
  }
  
  let fileObj;
  if (isLocal) {
    fileObj = fs.createReadStream(localPath);
  } else {
    const downloadRes = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(downloadRes.data);
    const filenamePart = String(mediaUrl).split('/').pop().split('?')[0] || 'audio.ogg';
    fileObj = await OpenAI.toFile(buffer, filenamePart);
  }
  
  // 3. Request transcription
  const response = await openai.audio.transcriptions.create({
    file: fileObj,
    model: modelName,
    language: 'pt'
  });
  
  return response.text;
}

module.exports = { processAI, testAIConnection, testProviderConnection, getAIIntegrationStatus, clearResponseCache, refineAgentPrompt, transcribeAudio };

