const { query } = require('../src/infrastructure/config/database');
const quickReplyCapability = require('./quickReplyCapability');

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
 * Avalia correspondência direta com as 77 Respostas Rápidas, Mídias e Catálogo da loja (Rota Rápida VPS).
 * Retorna resposta imediata com mídias anexadas (<10ms, 0 tokens).
 */
async function matchQuickReplyFastPath(messageText, { companyId = 'default', bestQuickReplyMatch = null, agent = null, history = [] } = {}) {
  if (!messageText || typeof messageText !== 'string' || messageText.trim().length < 2) {
    return null;
  }

  const norm = messageText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Se o cliente está enviando dados de endereço ou documento, não interceptar com FAQ genérico
  const isSubmission = /\b(cpf|rua|numero|bairro|cep|pagar|chave pix)\b/i.test(norm) && norm.length > 30;
  if (isSubmission && !norm.includes('qual') && !norm.includes('como') && !norm.includes('onde')) {
    return null;
  }

  let match = bestQuickReplyMatch;
  if (!match) {
    try {
      match = await quickReplyCapability.findBestMatchForContext({
        message: messageText,
        companyId,
      });
    } catch (_) {
      return null;
    }
  }

  if (!match) return null;
  if (!match.content && !match.selectedMediaItem) return null;

  // Critérios para rota rápida instantânea:
  // 1) Solicitação explícita de mídia com item correspondente (foto, áudio, catálogo)
  // 2) FAQ direto de produto com alta relevância (score >= 45)
  // 3) Termos fundamentais da loja (cimento, churrasqueira, garantia, pix, entrega, tabela de preço)
  const hasExplicitMedia = Boolean(match.requestedMediaType && match.selectedMediaItem);
  const isHighConfidenceFaq = match.score >= 50;
  const isStrongKeyword = match.score >= 38 && (
    norm.includes('cimento') ||
    norm.includes('churras') ||
    norm.includes('garantia') ||
    norm.includes('pix') ||
    norm.includes('foto') ||
    norm.includes('imagem') ||
    norm.includes('audio') ||
    norm.includes('preco') ||
    norm.includes('valor') ||
    norm.includes('entrega') ||
    norm.includes('frete') ||
    norm.includes('tabela')
  );

  if (!hasExplicitMedia && !isHighConfidenceFaq && !isStrongKeyword) {
    return null;
  }

  let responseText = (match.content && match.content.trim()) || '';
  if (responseText.startsWith('{')) {
    try {
      const parsed = JSON.parse(responseText);
      if (typeof parsed.text === 'string') {
        responseText = parsed.text.trim();
      }
      const mediaItem = (parsed.items || []).find(i => i.type && i.type !== 'text');
      if (mediaItem) {
        match.selectedMediaItem = {
          type: mediaItem.type,
          value: mediaItem.value || mediaItem.mediaUrl || mediaItem.content,
          caption: mediaItem.caption || '',
        };
      } else if (parsed.mediaUrl) {
        match.selectedMediaItem = {
          type: parsed.mediaType || 'image',
          value: parsed.mediaUrl,
          caption: parsed.filename || '',
        };
      }
    } catch (_) {}
  }

  if (!responseText) {
    const isAudio = match.requestedMediaType === 'audio' || match.selectedMediaItem?.type === 'audio';
    const isImage = match.requestedMediaType === 'image' || match.selectedMediaItem?.type === 'image';
    const isPix = norm.includes('pix') || match.title?.toLowerCase().includes('pix');

    if (isPix && isAudio) {
      responseText = 'Segue o áudio oficial da loja com as informações para pagamento via PIX:';
    } else if (isAudio) {
      responseText = 'Segue o áudio oficial com a explicação detalhada:';
    } else if (isImage) {
      responseText = 'Aqui está a foto solicitada do nosso catálogo:';
    } else {
      responseText = 'Segue a informação oficial solicitada da nossa loja:';
    }
  }
  const analysis = {
    trigger_quick_reply: match.id,
    fast_path: true,
    confidence: match.score,
    source: 'vps_fast_path',
  };

  if (match.selectedMediaItem) {
    analysis.send_media = {
      type: match.requestedMediaType || match.selectedMediaItem.type || 'image',
      value: match.selectedMediaItem.value,
      caption: match.selectedMediaItem.caption || '',
    };
  }

  return {
    text: responseText,
    analysis,
    trigger_quick_reply: match.id,
    send_media: analysis.send_media,
    source: 'quick_reply_fast_path',
    score: match.score,
    matchId: match.id,
    title: match.title,
  };
}

/**
 * Consulta a "Mente Local / Rota Rápida" do agente na VPS para responder sem gastar tokens.
 * @param {string} agentKey 
 * @param {string} companyId 
 * @param {string} messageText Mensagem de entrada do cliente
 * @param {object} options Opções adicionais (bestQuickReplyMatch, agent, history, contact)
 * @returns {object|null} Objeto { text, analysis, send_media, trigger_quick_reply } ou null
 */
async function queryLocalBrain(agentKey, companyId, messageText, options = {}) {
  if (!messageText || messageText.length < 2) return null;

  // 1. Rota Rápida VPS: correspondência exata ou de alta confiança com respostas rápidas e catálogo
  try {
    const fastMatch = await matchQuickReplyFastPath(messageText, {
      companyId,
      bestQuickReplyMatch: options.bestQuickReplyMatch,
      agent: options.agent,
      history: options.history,
    });
    if (fastMatch) {
      console.log(`[LOCAL BRAIN] Rota Rápida VPS acionada! Score: ${fastMatch.score}, Item: "${fastMatch.title}"`);
      return fastMatch;
    }
  } catch (err) {
    console.warn('[LOCAL BRAIN] Fast path match error:', err.message);
  }

  // 2. Aprendizados prévios do agente (agent_learning_events)
  if (messageText.length >= 5) {
    const learnedEvents = await getAgentLearnedEvents(agentKey, companyId);
    if (learnedEvents.length > 0) {
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
        console.log(`[LOCAL BRAIN] Match aprendido encontrado! (Score: ${(highestScore*100).toFixed(1)}%). Ignorando chamada à LLM.`);
        console.log(`[LOCAL BRAIN] Pergunta: "${messageText}" => Match: "${bestMatch.customer_question}"`);
        return {
          text: bestMatch.human_answer,
          analysis: { learned_match: true, fast_path: true },
          source: 'learned_events',
          score: highestScore,
        };
      }
    }
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
  matchQuickReplyFastPath,
  autoLearn,
  stringSimilarity, // exportado p/ testes
};
