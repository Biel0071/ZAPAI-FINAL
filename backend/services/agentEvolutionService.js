const { query } = require('../config/database');
const crypto = require('crypto');
const aiAgentService = require('../ai-agents/services/aiAgentService');
const agentLearningRepo = require('../repositories/agentLearningRepository');
const { testProviderConnection } = require('./ai.service');

function getEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY || 'zapai_crm_encryption_secure_key_32bytes_2026';
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
    try {
      const legacyKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'ZAPFLOW_SECURE_SALT_KEY_2026').digest();
      const parts = text.split(':');
      const iv = Buffer.from(parts.shift(), 'hex');
      const encryptedText = Buffer.from(parts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (legacyErr) {
      return '';
    }
  }
}

async function resolveProvider(store, companyId = 'default') {
  try {
    const { rows } = await query(
      `SELECT * FROM provider_keys WHERE tenant_id = $1 AND enabled = TRUE LIMIT 1`,
      [companyId]
    );
    if (rows.length > 0) {
      let mappedProviderId = rows[0].provider.toLowerCase();
      if (mappedProviderId === 'anthropic') mappedProviderId = 'claude';
      if (mappedProviderId === 'google') mappedProviderId = 'gemini';

      return {
        id: mappedProviderId,
        apiKey: decrypt(rows[0].api_key),
        model: rows[0].model,
        active: true
      };
    }
  } catch {}

  const providers = store?.aiConfig?.advancedAISettings?.providers || [];
  const providerObj = providers.find((item) => item.active) || providers[0];
  if (providerObj) {
    return {
      id: providerObj.id,
      apiKey: providerObj.apiKey,
      model: providerObj.model,
      active: providerObj.active
    };
  }
  return null;
}

async function detectUnansweredQuestions(agentKey, companyId = 'default') {
  await aiAgentService.listAgents(companyId);
  const agent = aiAgentService.getAgentsSync(companyId).find(a => a.key === agentKey);
  if (!agent) return 0;
  
  const agentName = agent.name;
  
  const result = await query(
    `
      SELECT m.id, m.conversation_id, m.content, m.from_me, m.timestamp,
             l.phone, l.name as lead_name
      FROM messages m
      INNER JOIN conversations conv ON conv.id = m.conversation_id
      INNER JOIN leads l ON l.id = conv.lead_id
      WHERE conv.company_id = $2
        AND (conv.agent_name = $1 OR conv.agent_name IS NULL)
        AND m.timestamp >= NOW() - INTERVAL '15 days'
      ORDER BY m.conversation_id, m.timestamp ASC
      LIMIT 1000
    `,
    [agentName, companyId]
  );
  
  const messages = result.rows;
  const uncertaintyPatterns = [
    /não tenho essa informação/i,
    /não sei informar/i,
    /vou verificar/i,
    /entre em contato/i,
    /não posso ajudar com isso/i,
    /infelizmente não/i,
    /não disponho dessa informação/i,
    /preciso consultar/i
  ];
  
  let createdCount = 0;
  
  for (let i = 1; i < messages.length; i++) {
    const currentMsg = messages[i];
    const prevMsg = messages[i - 1];
    
    if (
      currentMsg.from_me && 
      !prevMsg.from_me && 
      currentMsg.conversation_id === prevMsg.conversation_id
    ) {
      const replyText = currentMsg.content || '';
      const isUncertain = uncertaintyPatterns.some(p => p.test(replyText));
      
      if (isUncertain) {
        const questionText = (prevMsg.content || '').trim();
        if (questionText.length > 5 && questionText.length < 500) {
          const existing = await query(
            `
              SELECT id FROM agent_learning_events 
              WHERE agent_key = $1 AND customer_question = $2 AND company_id = $3
              LIMIT 1
            `,
            [agentKey, questionText, companyId]
          );
          
          if (existing.rows.length === 0) {
            await agentLearningRepo.createLearningEvent({
              agentKey,
              eventType: 'unanswered',
              customerQuestion: questionText,
              aiResponse: replyText,
              contactPhone: prevMsg.phone,
              contactName: prevMsg.lead_name,
              conversationId: currentMsg.conversation_id,
              companyId,
            });
            createdCount++;
          }
        }
      }
    }
  }
  
  return createdCount;
}

async function refineWholeAgent(agentKey, userInstruction, store, companyId = 'default') {
  await aiAgentService.listAgents(companyId);
  const agent = aiAgentService.getAgentsSync(companyId).find(a => a.key === agentKey);
  if (!agent) {
    throw new Error('Atendente não encontrado.');
  }
  
  const pendingEvents = await agentLearningRepo.getPendingEvents(agentKey, companyId, 5);
  const history = await agentLearningRepo.getEvolutionHistory(agentKey, companyId, 5);
  
  const provider = await resolveProvider(store, companyId);
  if (!provider) {
    throw new Error('Nenhum provedor de IA ativo configurado para evolução do atendente.');
  }
  
  const currentFields = {
    name: agent.name,
    personality: agent.personality,
    objective: agent.objective,
    sector: agent.sector,
    rules: agent.rules,
    company: agent.company,
    companyDescription: agent.companyDescription,
    products: agent.products,
    services: agent.services,
    faq: agent.faq,
    policies: agent.policies,
    tone: agent.tone,
    responseStyle: agent.responseStyle,
    temperature: agent.temperature,
    memory: agent.memory,
    escalationTriggers: agent.escalationTriggers,
    hours: agent.hours,
  };
  
  const pendingText = pendingEvents.map((e, index) => `${index + 1}. Pergunta: "${e.customer_question}" | IA: "${e.ai_response || ''}"`).join('\n') || 'Nenhuma pergunta pendente.';
  const historyText = history.map((h) => `- Alteração em ${h.created_at.toISOString().split('T')[0]}: ${h.source_description}`).join('\n') || 'Nenhum histórico recente.';
  
  const refPrompt = `Você é um especialista em configuração de atendentes virtuais de WhatsApp.

CONFIGURAÇÃO ATUAL DO ATENDENTE:
\`\`\`json
${JSON.stringify(currentFields, null, 2)}
\`\`\`

PERGUNTAS QUE O ATENDENTE NÃO SOUBE RESPONDER RECENTEMENTE:
${pendingText}

ÚLTIMAS EVOLUÇÕES APLICADAS:
${historyText}

INSTRUÇÃO DO DONO DA CONTA (O que ensinar ou alterar no atendente):
"${userInstruction}"

TAREFA:
Analise a instrução do dono e determine quais campos do atendente precisam ser alterados, adicionados ou expandidos. 
Responda APENAS com um bloco de código JSON válido contendo a seguinte estrutura:
{
  "changes": {
    "NOME_DO_CAMPO": {
      "action": "update" ou "append" ou "replace",
      "value": "o novo valor do campo"
    }
  },
  "reasoning": "Breve explicação das mudanças efetuadas",
  "suggestions": ["sugestão adicional 1", "sugestão adicional 2"]
}

REGRAS CRÍTICAS:
1. Retorne APENAS o JSON válido. Não inclua texto introdutório, explicações fora do JSON ou blocos Markdown extras.
2. Campos disponíveis: personality, rules, faq, products, services, memory, company, companyDescription, objective, policies, tone, responseStyle, temperature, escalationTriggers, hours.
3. Se o dono informa um novo produto ou preço, use action "append" no campo "products" (adicionando os dados ao fim do campo atual de forma limpa).
4. Se o dono ensina uma nova dúvida/resposta, adicione no formato de Q&A (Pergunta/Resposta) usando action "append" no campo "faq".
5. Se o dono solicita uma alteração de comportamento geral, reescreva ou adicione ao campo "rules" (append/update) ou "personality" (update).
6. Se a ação for "append", o "value" que você retornar DEVE ser apenas o conteúdo adicional a ser acrescentado, não o campo inteiro. Se a ação for "update", será a substituição completa daquele campo.
7. Mantenha as alterações em português brasileiro natural.`;

  const result = await testProviderConnection(provider, {
    model: provider.model,
    message: 'Execute a análise e retorne o JSON com as alterações propostas.',
    prompt: refPrompt,
    maxTokens: 2500,
    temperature: 0.2,
    timeoutMs: 40000,
  });
  
  if (!result.ok) {
    throw new Error(result.error || 'Falha ao conectar com o provedor de IA.');
  }
  
  let responseText = result.response.trim();
  if (responseText.startsWith('```json')) {
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  } else if (responseText.startsWith('```')) {
    responseText = responseText.replace(/```/g, '').trim();
  }
  
  try {
    const parsed = JSON.parse(responseText);
    return {
      changes: parsed.changes || {},
      reasoning: parsed.reasoning || '',
      suggestions: parsed.suggestions || [],
      currentAgent: currentFields,
    };
  } catch (err) {
    console.error('Failed to parse AI refiner response:', responseText);
    throw new Error('A resposta da IA não pôde ser lida como um JSON válido.');
  }
}

async function applyAgentChanges(agentKey, changes, sourceDescription, changeType = 'prompt_refinement', companyId = 'default') {
  await aiAgentService.listAgents(companyId);
  const agent = aiAgentService.getAgentsSync(companyId).find(a => a.key === agentKey);
  if (!agent) {
    throw new Error('Atendente não encontrado.');
  }
  
  const fieldsChanged = {};
  const updatedPayload = { ...agent };
  
  for (const field of Object.keys(changes)) {
    const change = changes[field];
    const beforeValue = agent[field] || '';
    let afterValue = '';
    
    if (change.action === 'append') {
      afterValue = beforeValue ? `${beforeValue}\n\n${change.value}` : change.value;
    } else if (change.action === 'update' || change.action === 'replace') {
      afterValue = change.value;
    } else {
      afterValue = change.value;
    }
    
    updatedPayload[field] = afterValue;
    fieldsChanged[field] = {
      before: beforeValue,
      after: afterValue
    };
  }
  
  await aiAgentService.updateAgent(agentKey, updatedPayload, companyId);
  
  await agentLearningRepo.createEvolutionLog({
    agentKey,
    changeType,
    sourceDescription,
    fieldsChanged,
    companyId
  });
  
  return updatedPayload;
}

async function learnFromAnswer(eventId, humanAnswer, store, companyId = 'default') {
  const result = await query(
    `SELECT * FROM agent_learning_events WHERE id = $1 LIMIT 1`,
    [eventId]
  );
  if (result.rows.length === 0) {
    throw new Error('Evento de aprendizado não encontrado.');
  }
  
  const event = result.rows[0];
  const agentKey = event.agent_key;
  
  await aiAgentService.listAgents(companyId);
  const agent = aiAgentService.getAgentsSync(companyId).find(a => a.key === agentKey);
  if (!agent) {
    throw new Error('Atendente associado não encontrado.');
  }
  
  const provider = await resolveProvider(store, companyId);
  if (!provider) {
    throw new Error('Provedor de IA ativo não configurado.');
  }
  
  const formatPrompt = `Você é um analista de dados especialista. Um cliente fez uma pergunta e o dono da empresa ensinou a resposta correta.
Sua tarefa é formatar essa resposta de forma limpa para ser adicionada à base de conhecimento do atendente virtual.

DADOS DA INTERAÇÃO:
Pergunta do Cliente: "${event.customer_question}"
Resposta do Dono: "${humanAnswer}"

Determine qual o melhor campo do atendente para armazenar essa informação ("faq" ou "rules" ou "products" ou "memory"). 
Geralmente:
- Dúvida/resposta frequente vai para "faq"
- Regra de conduta/restrição vai para "rules"
- Catálogo, preço, frete vai para "products"
- Fatos/contexto corporativo vai para "memory"

Retorne APENAS um bloco de código JSON válido contendo:
{
  "targetField": "faq" | "rules" | "products" | "memory",
  "formattedContent": "conteúdo formatado de forma limpa. Se for FAQ, inclua em formato de Pergunta e Resposta clara. Ex: 'P: [Pergunta]\\nR: [Resposta]'"
}`;

  const formatResult = await testProviderConnection(provider, {
    model: provider.model,
    message: 'Formate a informação de treinamento.',
    prompt: formatPrompt,
    maxTokens: 1000,
    temperature: 0.1,
    timeoutMs: 30000,
  });
  
  if (!formatResult.ok) {
    throw new Error('Falha ao conectar com o provedor de IA para formatar a resposta.');
  }
  
  let responseText = formatResult.response.trim();
  if (responseText.startsWith('```json')) {
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  } else if (responseText.startsWith('```')) {
    responseText = responseText.replace(/```/g, '').trim();
  }
  
  let targetField = 'faq';
  let formattedContent = '';
  
  try {
    const parsed = JSON.parse(responseText);
    targetField = parsed.targetField || 'faq';
    formattedContent = parsed.formattedContent || '';
  } catch (err) {
    targetField = 'faq';
    formattedContent = `P: ${event.customer_question}\nR: ${humanAnswer}`;
  }
  
  const changes = {
    [targetField]: {
      action: 'append',
      value: formattedContent
    }
  };
  
  await applyAgentChanges(
    agentKey,
    changes,
    `Pergunta respondida: "${event.customer_question}"`,
    'question_learned',
    companyId
  );
  
  await query(
    `
      UPDATE agent_learning_events
      SET human_answer = $2,
          status = 'applied',
          applied_to_field = $3,
          resolved_at = NOW()
      WHERE id = $1
    `,
    [eventId, humanAnswer, targetField]
  );
  
  return { targetField, formattedContent };
}

module.exports = {
  detectUnansweredQuestions,
  refineWholeAgent,
  applyAgentChanges,
  learnFromAnswer,
};
