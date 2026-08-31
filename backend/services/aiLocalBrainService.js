const { query } = require('../src/infrastructure/config/database');

// Cache em memória para evitar sobrecarregar o DB
// agentKey: { lastFetched: timestamp, events: [...] }
const localCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const MIN_SIMILARITY_THRESHOLD = 0.80; // 80% de similaridade

/**
 * Normaliza string para comparação (minúsculo, sem acentos, pontuações)
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, '')
    .trim();
}

/**
 * Extrai bigramas de uma string
 */
function getBigrams(str) {
  const bigrams = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.slice(i, i + 2));
  }
  return bigrams;
}

/**
 * Sørensen–Dice coefficient para comparar duas strings
 * Retorna de 0.0 (totalmente diferente) a 1.0 (idêntico)
 */
function stringSimilarity(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (let i = 0; i < bigrams1.length; i++) {
    for (let j = 0; j < bigrams2.length; j++) {
      if (bigrams1[i] === bigrams2[j]) {
        intersection++;
        bigrams2[j] = null; // evita contar duas vezes
        break;
      }
    }
  }

  return (2.0 * intersection) / (bigrams1.length + bigrams2.length);
}

/**
 * Busca no cache ou DB os aprendizados ativos do agente
 */
async function getAgentLearnedEvents(agentKey, companyId) {
  const cacheKey = `${agentKey}_${companyId}`;
  const cached = localCache.get(cacheKey);

  if (cached && (Date.now() - cached.lastFetched < CACHE_TTL_MS)) {
    return cached.events;
  }

  try {
    const { rows } = await query(
      `SELECT customer_question, human_answer, ai_response
       FROM agent_learning_events
       WHERE agent_key = $1 AND company_id = $2 
         AND status IN ('applied', 'auto_learned') AND human_answer IS NOT NULL`,
      [agentKey, companyId]
    );
    
    localCache.set(cacheKey, {
      lastFetched: Date.now(),
      events: rows || []
    });

    return rows || [];
  } catch (error) {
    console.error('[LOCAL BRAIN] Erro ao buscar conhecimentos do agente:', error);
    return [];
  }
}

/**
 * Consulta a "Mente Local" do agente para ver se ele já sabe responder sem gastar tokens.
 * @param {string} agentKey 
 * @param {string} companyId 
 * @param {string} messageText Mensagem de entrada do cliente
 * @returns {string|null} Resposta cacheada ou null se não encontrar match
 */
async function queryLocalBrain(agentKey, companyId, messageText) {
  if (!messageText || messageText.length < 5) return null; // Msg curta não ativa cache
  
  const learnedEvents = await getAgentLearnedEvents(agentKey, companyId);
  if (learnedEvents.length === 0) return null;

  let bestMatch = null;
  let highestScore = 0;

  for (const event of learnedEvents) {
    const score = stringSimilarity(messageText, event.customer_question);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = event;
    }
  }

  if (highestScore >= MIN_SIMILARITY_THRESHOLD && bestMatch && bestMatch.human_answer) {
    console.log(`[LOCAL BRAIN] Match local encontrado! (Score: ${(highestScore*100).toFixed(1)}%). Ignorando chamada à LLM.`);
    console.log(`[LOCAL BRAIN] Pergunta: "${messageText}" => Match: "${bestMatch.customer_question}"`);
    return bestMatch.human_answer;
  }

  return null;
}

/**
 * Função de Auto-Aprendizado
 * Memoriza automaticamente respostas da IA que foram bem-sucedidas.
 */
async function autoLearn(agentKey, companyId, customerQuestion, aiResponse) {
  if (!customerQuestion || customerQuestion.length < 15) return;
  if (!aiResponse || aiResponse.length < 15) return;

  try {
    await query(
      `INSERT INTO agent_learning_events (
         agent_key, company_id, event_type, customer_question,
         human_answer, ai_response, status, created_at, resolved_at
       ) VALUES ($1, $2, 'knowledge_gap', $3, $4, $4, 'auto_learned', NOW(), NOW())`,
      [agentKey, companyId, customerQuestion, aiResponse]
    );

    // Invalida o cache local para carregar o novo aprendizado na próxima vez
    const cacheKey = `${agentKey}_${companyId}`;
    localCache.delete(cacheKey);

    console.log(`[LOCAL BRAIN] Auto-aprendizado realizado com sucesso para o agente ${agentKey}`);
  } catch (err) {
    console.error('[LOCAL BRAIN] Erro ao salvar auto-aprendizado:', err.message);
  }
}

module.exports = {
  queryLocalBrain,
  autoLearn,
  stringSimilarity, // exportado p/ testes
};
