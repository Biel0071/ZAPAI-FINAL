/**
 * AI Anti-Repetition & Natural Attendant Service
 *
 * Tracks the bot's recent messages (last 3 replies) in a conversation to:
 * 1. NEVER repeat greetings ("Olá! Aqui é a Camila...", "Oi, tudo bem?", etc.) when the bot already spoke.
 * 2. NEVER repeat the same CTA or final question successively (e.g. "Deseja que eu reserve esse modelo para a sua obra?").
 * 3. Dynamically vary vocabulary, sentence length, and commercial progression like a real human WhatsApp attendant.
 * 4. Ensure direct, immediate follow-up on the customer's line of thought (e.g. "De 5 mil litros" -> respond directly about 5.000L).
 */

const { applyHumanMicroVariations } = require('./messageVariationEngine');

// Brazilian WhatsApp greeting opener patterns
const GREETING_OPENERS = /^(?:(?:ol[aá]|oi|opa|bom\s+dia|boa\s+tarde|boa\s+noite|e\s+a[ií])[!.,\s]*)+/i;

// Conversational pleasantries / check-ins
const PLEASANTRIES = /^(?:tudo\s+(?:bem|joia|j[oó]ia|certo|bom)(?:\s+(?:com\s+voc[eê]|por\s+a[ií]))?\??|como\s+(?:vai|est[aá](?:\s+voc[eê])?)\??|espero\s+que\s+esteja\s+bem[!.,\s]*)[!.,\s]*/i;

// Self-introduction patterns (Camila, Zaibot, or generic attendant)
const SELF_INTRO = /(?:(?:aqui\s+(?:[eé]|quem\s+fala\s+[eé])\s+|sou\s+)(?:a\s+|o\s+)?(?:camila|[a-zà-ÿ]+)(?:\s+da\s+(?:loja|nossa\s+loja))?|atendente\s+camila)[!.,\s]*/i;

// Dynamic CTAs pool for varied commercial progression (tenant-agnostic, zero hardcoded interest/discounts)
const VARIED_CTAS = {
  freight_location: [
    'Qual o seu bairro ou CEP para eu já calcular a entrega com o melhor desconto?',
    'A entrega seria para qual bairro? Posso consultar a rota do caminhão agora.',
    'Me passa o bairro ou cidade da sua obra pra eu verificar o frete com as melhores condições.',
    'Você prefere que a gente entregue na sua obra ou gostaria de retirar direto na loja?'
  ],
  payment: [
    'Prefere pagamento à vista no PIX com desconto ou parcelado no cartão?',
    'No PIX conseguimos o melhor valor com desconto à vista. Gostaria de fechar por lá?',
    'Qual forma de pagamento fica mais prática para você: PIX ou cartão de crédito parcelado?',
    'Prefere parcelar no cartão ou aproveitar a condição à vista no PIX?'
  ],
  dimensions_capacity: [
    'Essa capacidade atende perfeitamente sua obra ou quer que eu veja outro tamanho?',
    'Quer que eu verifique a disponibilidade desse modelo para entrega rápida?',
    'Você vai precisar também dos acessórios e conexões para a instalação?',
    'Gostaria que eu te mandasse as fotos e especificações técnicas desse modelo?'
  ],
  closing_advance: [
    'Quer que eu já adiante a separação desse item para você?',
    'Para quando você está precisando desse material na sua obra?',
    'Posso já verificar o prazo de expedição para a sua região?',
    'Podemos já reservar a sua unidade no estoque de hoje?'
  ]
};

/**
 * Extracts the last N bot messages from history or message array.
 * Handles diverse formats: [{ role, content }], [{ from, text }], [{ from_me, text }], [{ fromMe, text }].
 */
function extractRecentBotReplies(history = [], limit = 20) {
  if (!Array.isArray(history) || history.length === 0) return [];

  const botReplies = [];

  // Iterate backwards (from most recent to oldest)
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (!msg) continue;

    const isBot =
      msg.role === 'assistant' ||
      msg.role === 'model' ||
      msg.from === 'agent' ||
      msg.from === 'bot' ||
      msg.fromMe === true ||
      msg.fromMe === 'true' ||
      msg.from_me === true ||
      msg.from_me === 'true' ||
      msg.direction === 'outgoing' ||
      msg.key?.fromMe === true ||
      msg.sender === 'agent' ||
      msg.sender === 'ai' ||
      msg.sender === 'assistant';

    if (isBot) {
      const text = String(msg.content || msg.text || '').trim();
      if (text && !text.startsWith(':::analysis') && !text.startsWith('[Áudio Transcrito]')) {
        const sents = text.split(/(?<=[.!?])\s+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 15);
        botReplies.unshift({
          text,
          sentences: sents,
          greeting: detectGreeting(text),
          cta: extractClosingCta(text),
          timestamp: msg.timestamp || msg.createdAt || null
        });
      }
    }

    if (botReplies.length >= limit) break;
  }

  return botReplies;
}

/**
 * Detects if a text begins with a greeting or self-introduction
 */
function detectGreeting(text = '') {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const match = trimmed.match(GREETING_OPENERS);
  return match && match[0] ? match[0].trim() : null;
}

/**
 * Extracts the closing question or Call-To-Action (CTA) from a message
 */
function extractClosingCta(text = '') {
  if (!text || typeof text !== 'string') return '';
  const clean = text.replace(/:::analysis[\s\S]*:::?/, '').trim();
  
  // Find questions at the end of the text
  const questionMatches = clean.match(/([^\n.!?]+(?:\?|!|\.))$/);
  if (questionMatches && questionMatches[1]) {
    return questionMatches[1].trim();
  }

  // Fallback to last sentence
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.length > 0 ? sentences[sentences.length - 1].trim() : clean;
}

/**
 * Classifies a CTA into a commercial intent category to catch paraphrased repetitions
 */
function getCtaIntent(cta = '') {
  if (!cta || typeof cta !== 'string') return null;
  const norm = cta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/(?:reserve|reservar|reserva|separar|separacao|separacao|segurar|fechar o pedido|adiantar a separacao|confirmar o pedido|reservar esse modelo)/i.test(norm)) {
    return 'RESERVA';
  }
  if (/(?:bairro|cep|cidade|entrega|entregar|frete|regiao|local|retirar direto)/i.test(norm)) {
    return 'LOCALIZACAO_FRETE';
  }
  if (/(?:pix|cartao|parcelad|parcelar|forma de pagamento|a vista|condicao de pagamento|pagar|pagamento)/i.test(norm)) {
    return 'PAGAMENTO';
  }
  if (/(?:capacidade|litros|tamanho|medida|dimens|quantidade|quantos|milheiro|especificac)/i.test(norm)) {
    return 'MEDIDAS_CAPACIDADE';
  }
  if (/(?:para quando|urgente|prazo|inicio da obra|quando voce precisa|quando precisa|expedicao)/i.test(norm)) {
    return 'PRAZO_OBRA';
  }
  if (/(?:ajudar|duvida|posso ajudar|precisa de mais|mais alguma)/i.test(norm)) {
    return 'AJUDA_GERAL';
  }
  return null;
}

/**
 * Checks similarity between two CTA strings to prevent repeating the same question
 */
function areCtasSimilar(ctaA = '', ctaB = '') {
  if (!ctaA || !ctaB) return false;
  const normA = ctaA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();
  const normB = ctaB.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();

  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Intent classification match
  const intentA = getCtaIntent(normA);
  const intentB = getCtaIntent(normB);
  if (intentA && intentB && intentA === intentB) {
    return true;
  }

  // Key phrase overlap
  const keyPhrases = [
    'reserve esse modelo',
    'reservar esse modelo',
    'reserve seu modelo',
    'reserve para a sua obra',
    'reserve para sua obra',
    'qual o seu bairro',
    'qual seu bairro',
    'qual o cep',
    'pix ou cartao',
    'pix com desconto',
    'como posso ajudar'
  ];

  for (const phrase of keyPhrases) {
    const cleanPhrase = phrase.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normA.includes(cleanPhrase) && normB.includes(cleanPhrase)) return true;
  }

  // Word overlap Jaccard
  const wordsA = new Set(normA.split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(normB.split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return (intersection / union) >= 0.40;
}

/**
 * Generates an alternate closing CTA when a repetition is detected,
 * excluding any recent CTAs across the last bot replies and respecting known customer preferences.
 */
function getAlternativeCta(recentCtas = [], topic = 'closing_advance', knownPreferences = {}) {
  const ctaList = Array.isArray(recentCtas) ? recentCtas : [recentCtas].filter(Boolean);

  // Steer topic away from already known facts
  let effectiveTopic = topic;
  if (effectiveTopic === 'freight_location' && (knownPreferences.neighborhood || knownPreferences.city)) {
    effectiveTopic = !knownPreferences.paymentPreference ? 'payment' : 'closing_advance';
  } else if (effectiveTopic === 'payment' && knownPreferences.paymentPreference) {
    effectiveTopic = (!knownPreferences.neighborhood && !knownPreferences.city) ? 'freight_location' : 'closing_advance';
  } else if (effectiveTopic === 'dimensions_capacity' && knownPreferences.capacity) {
    effectiveTopic = (!knownPreferences.neighborhood && !knownPreferences.city) ? 'freight_location' : (!knownPreferences.paymentPreference ? 'payment' : 'closing_advance');
  }

  const pool = VARIED_CTAS[effectiveTopic] || VARIED_CTAS.closing_advance;
  const filtered = pool.filter(c => {
    if (ctaList.some(prev => areCtasSimilar(c, prev))) return false;
    const intent = getCtaIntent(c);
    if (intent === 'LOCALIZACAO_FRETE' && (knownPreferences.neighborhood || knownPreferences.city)) return false;
    if (intent === 'PAGAMENTO' && knownPreferences.paymentPreference) return false;
    if (intent === 'MEDIDAS_CAPACIDADE' && knownPreferences.capacity) return false;
    return true;
  });
  if (filtered.length > 0) {
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  // Fallback to closing_advance without already asked CTAs
  const fallbackPool = (VARIED_CTAS.closing_advance || []).filter(c => !ctaList.some(prev => areCtasSimilar(c, prev)));
  if (fallbackPool.length > 0) {
    return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  }
  return pool[0] || 'Como posso te ajudar com o seu pedido hoje?';
}

/**
 * Strips all greetings and self-introductions from text when bot already spoke
 */
function stripGreetingsAndIntroductions(text = '') {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text.trim();

  // Iteratively strip leading greetings, pleasantries, and self-introductions in any order
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 5) {
    changed = false;
    iterations++;

    // 1. Strip leading opener (Olá, Oi, Bom dia, etc.)
    const mOpen = cleaned.match(GREETING_OPENERS);
    if (mOpen && mOpen[0] && mOpen.index === 0) {
      cleaned = cleaned.slice(mOpen[0].length).trim();
      changed = true;
    }

    // 2. Strip leading pleasantries (Tudo bem? Tudo bom? Como vai? etc.)
    const mPleas = cleaned.match(PLEASANTRIES);
    if (mPleas && mPleas[0] && mPleas.index === 0) {
      cleaned = cleaned.slice(mPleas[0].length).trim();
      changed = true;
    }

    // 3. Strip leading self-introduction (Aqui é a Camila, Sou a Camila, etc.)
    const mIntro = cleaned.match(SELF_INTRO);
    if (mIntro && mIntro[0] && mIntro.index === 0) {
      cleaned = cleaned.slice(mIntro[0].length).trim();
      changed = true;
    }
  }

  // Also strip mid-conversation standalone self-introductions ("Aqui é a Camila da loja, ")
  cleaned = cleaned.replace(SELF_INTRO, '').trim();

  // Clean leading punctuation left behind (e.g. ", ", "! ", ". ")
  cleaned = cleaned.replace(/^[!,.:;\s-]+/, '').trim();

  if (cleaned.length >= 8) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  } else {
    // If stripping emptied or crippled message, fallback to original
    return text.trim();
  }

  return cleaned;
}

/**
 * Builds the Anti-Repetition and Conversational Progression prompt block
 */
function buildAntiRepetitionPromptBlock({ recentBotReplies = [], knownPreferences = {} } = {}) {
  const hasHistory = Array.isArray(recentBotReplies) && recentBotReplies.length > 0;

  let prompt = `### [RASTREAMENTO DE RESPOSTAS DO ATENDENTE & DIRETRIZ ANTI-REPETIÇÃO]\n`;

  if (hasHistory) {
    prompt += `Você (o atendente) já enviou as seguintes mensagens recentemente para este cliente:\n`;
    recentBotReplies.forEach((r, idx) => {
      const snippet = r.text.length > 180 ? `${r.text.substring(0, 180)}...` : r.text;
      prompt += `${idx + 1}. "${snippet}"\n`;
      if (r.cta) {
        prompt += `   -> Pergunta/CTA usado: "${r.cta}"\n`;
      }
    });

    const recentCtas = recentBotReplies.map(r => r.cta).filter(Boolean);
    const lastCta = recentCtas[recentCtas.length - 1] || '';

    prompt += `\nREGRAS ESTRITAS DE CONDUTA CONVERSACIONAL (NUNCA REPETIR):\n`;
    prompt += `1. PROIBIDO REPETIR APRESENTAÇÃO/SAUDAÇÃO: Como você JÁ falou na conversa, NUNCA envie saudações de apresentação ("Olá! Aqui é a Camila...", "Oi, tudo bem?"). Vá DIRETO ao assunto respondendo ao que o cliente falou!\n`;
    if (lastCta) {
      prompt += `2. PROIBIDO REPETIR O MESMO CTA: Sua pergunta anterior foi: "${lastCta}". É PROIBIDO repetir essa mesma pergunta ou variação idêntica (como insistir em "Deseja que eu reserve esse modelo para a sua obra?"). Avance o diálogo com uma pergunta diferente (sobre entrega, pagamento, medidas ou confirmação).\n`;
    } else {
      prompt += `2. PROIBIDO REPETIR O MESMO CTA: Varie a pergunta de fechamento em cada mensagem.\n`;
    }
    prompt += `3. PROIBIDO REPETIR A MESMA FRASE OU EXPLICAÇÃO: Não repita frases idênticas já enviadas nas mensagens anteriores.\n`;
  } else {
    prompt += `Esta é a primeira mensagem do atendente nesta interação. Faça uma saudação amigável e acolhedora (por exemplo: "Olá, tudo bem?"). Não use chaves {} ou formatos de template.\n`;
  }

  prompt += `4. SEGUIMENTO REAL NA LINHA DE RACIOCÍNIO: Se o cliente acabou de responder uma pergunta sua (por exemplo, informando capacidade "De 5 mil litros", local "Centro", ou pagamento "no pix"), você DEVE responder e confirmar exatamente o dado informado ("Temos a de 5 mil litros em polietileno com tampa de rosca...", "Para o Centro nossa entrega é rápida...", etc.) e em seguida fazer uma pergunta de avanço comercial.\n`;
  prompt += `5. DINÂMICA HUMANA DE WHATSAPP: Escreva como uma pessoa real digitando no WhatsApp: frases naturais, vocabulário dinâmico, sem rodeios robóticos e sem blocos gigantes de texto.\n`;

  // Fatos e preferências já conhecidas
  const prefLines = [];
  if (knownPreferences.product) prefLines.push(`- Produto em foco: ${knownPreferences.product}`);
  if (knownPreferences.capacity) prefLines.push(`- Capacidade/Tamanho: ${knownPreferences.capacity}`);
  if (knownPreferences.neighborhood || knownPreferences.city || knownPreferences.address) {
    prefLines.push(`- Localização já informada: ${[knownPreferences.neighborhood, knownPreferences.city, knownPreferences.address].filter(Boolean).join(', ')}`);
  }
  if (knownPreferences.paymentPreference) prefLines.push(`- Forma de pagamento: ${knownPreferences.paymentPreference}`);

  if (prefLines.length > 0) {
    prompt += `\nPREFERÊNCIAS JÁ INFORMADAS PELO CLIENTE (NÃO PERGUNTE NOVAMENTE):\n`;
    prompt += prefLines.join('\n') + '\n';
  }

  prompt += '\n';
  return prompt;
}

/**
 * Post-processes and sanitizes the bot's generated reply:
 * 1. Strips repetitive greetings and self-introductions if the bot already spoke.
 * 2. Replaces repetitive closing CTAs with fresh context-appropriate alternatives across all recent replies.
 * 3. Prevents sentence-level duplicates from previous bot replies.
 * 4. Applies natural micro-variations.
 */
function sanitizeAndVaryBotReply(replyText = '', recentBotReplies = [], options = {}) {
  if (!replyText || typeof replyText !== 'string') return replyText;

  let cleaned = replyText.trim();
  const hasPastBotMessages = Array.isArray(recentBotReplies) && recentBotReplies.length > 0;

  // 1. Strip redundant greetings and self-introductions when conversation is already in progress
  if (hasPastBotMessages) {
    cleaned = stripGreetingsAndIntroductions(cleaned);

    // 1.1 Prevent repetitive affirmative openers ("Com certeza!", "Perfeito!", etc.)
    const AFFIRMATIVE_OPENER = /^(?:Com certeza[!.,\s]*|Perfeito[!.,\s]*|Excelente[!.,\s]*|Com toda certeza[!.,\s]*|Sem d[uú]vida[!.,\s]*)/i;
    const mAff = cleaned.match(AFFIRMATIVE_OPENER);
    if (mAff && mAff[0]) {
      const pastAffirmations = recentBotReplies.map(r => {
        const m = (r.text || '').trim().match(AFFIRMATIVE_OPENER);
        return m ? m[0].trim().toLowerCase() : null;
      }).filter(Boolean);

      const currentAffNorm = mAff[0].trim().toLowerCase();
      if (pastAffirmations.includes(currentAffNorm)) {
        cleaned = cleaned.slice(mAff[0].length).trim();
        if (cleaned.length > 0) {
          cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }
      }
    }
  }

  // 2. Prevent repeating CTAs used in ANY of the last 3 bot messages
  if (hasPastBotMessages) {
    const recentCtas = recentBotReplies.map(r => r.cta).filter(Boolean);
    const currentCta = extractClosingCta(cleaned);

    const isRepeated = recentCtas.some(prevCta => areCtasSimilar(prevCta, currentCta));
    if (isRepeated && currentCta) {
      // Determine appropriate replacement topic based on content and known preferences
      let topic = 'closing_advance';
      const lowerClean = cleaned.toLowerCase();
      if (lowerClean.includes('litros') || lowerClean.includes('caixa') || lowerClean.includes('churrasqueira') || lowerClean.includes('tijolo')) {
        topic = (lowerClean.includes('bairro') || lowerClean.includes('cep')) ? 'payment' : 'freight_location';
      } else if (lowerClean.includes('frete') || lowerClean.includes('entrega')) {
        topic = 'payment';
      } else if (lowerClean.includes('pix') || lowerClean.includes('cartao') || lowerClean.includes('pagamento')) {
        topic = 'closing_advance';
      }

      const altCta = getAlternativeCta(recentCtas, topic);
      
      // Replace the closing question with the alternative
      if (currentCta.length > 5 && cleaned.endsWith(currentCta)) {
        cleaned = cleaned.slice(0, -currentCta.length).trim() + ' ' + altCta;
      } else {
        cleaned = cleaned.replace(currentCta, altCta);
      }
    }
  }

  // 3. Sentence-level deduplication: prevent repeating identical or paraphrased sentences from bot replies
  if (hasPastBotMessages) {
    const pastSentences = new Set();
    recentBotReplies.forEach(r => {
      const sents = (r.text || '').split(/(?<=[.!?])\s+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 20);
      sents.forEach(s => pastSentences.add(s));
    });

    if (pastSentences.size > 0 || recentBotReplies.length > 0) {
      const currentSentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
      const filtered = currentSentences.filter(s => {
        const normS = s.trim().toLowerCase();
        // NUNCA eliminar frases substantivas com valores monetários, cálculos ou especificações de produto
        if (/\b(?:r\$|\$|\d+(?:[.,]\d+)?\s*(?:reais|milheiro|sacos|litros|unidades|furos))\b/i.test(s)) {
          return true;
        }
        if (normS.length > 15 && pastSentences.has(normS)) return false;
        if (isSentenceRepeated(normS, recentBotReplies)) return false;
        return true;
      });
      cleaned = filtered.join(' ').trim();
    }
  }

  // 4. Resolve any residual spintax safely without leaving raw brackets
  try {
    const { parseSpintax } = require('./messageVariationEngine');
    cleaned = parseSpintax(cleaned).replace(/[ \t]+/g, ' ').trim();
  } catch (_) {}

  return cleaned.trim();
}

/**
 * Normalizes text for similarity comparison (lowercase, accent-free, alphanumeric)
 */
function normalizeTextForComparison(text = '') {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates word-level Jaccard similarity between two texts
 */
function calculateTextSimilarity(textA = '', textB = '') {
  const normA = normalizeTextForComparison(textA);
  const normB = normalizeTextForComparison(textB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = union > 0 ? (intersection / union) : 0;

  // Substring containment boost if length is similar
  if ((normA.includes(normB) || normB.includes(normA)) && (Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length) > 0.75)) {
    return Math.max(jaccard, 0.85);
  }

  return jaccard;
}

/**
 * Checks if a candidate sentence is substantially similar to any sentence previously sent by the bot
 */
function isSentenceRepeated(sentence = '', recentBotReplies = [], threshold = 0.88) {
  if (!sentence || typeof sentence !== 'string') return false;
  const normS = normalizeTextForComparison(sentence);
  if (normS.length < 15) return false;

  for (const botMsg of recentBotReplies) {
    const pastText = botMsg.text || '';
    const normPastText = normalizeTextForComparison(pastText);
    if (normPastText.includes(normS) && normS.length > 30) return true;

    const sents = botMsg.sentences || (pastText.split(/(?<=[.!?])\s+/).map(s => s.trim().toLowerCase()).filter(Boolean));
    for (const pastSentence of sents) {
      const normPastSent = normalizeTextForComparison(pastSentence);
      if (normPastSent === normS) return true;
      if (calculateTextSimilarity(normS, normPastSent) >= threshold) return true;
    }
  }

  return false;
}

/**
 * Detects if the candidate reply is caught in a repetitive loop or re-asking answered facts
 */
function detectRepetitionLoop({
  candidateReply = '',
  recentBotReplies = [],
  customerMessage = '',
  knownPreferences = {},
} = {}) {
  if (!candidateReply || typeof candidateReply !== 'string') {
    return { loopDetected: false };
  }

  const cleanCandidate = candidateReply.trim();
  const hasPast = Array.isArray(recentBotReplies) && recentBotReplies.length > 0;
  if (!hasPast) return { loopDetected: false };

  // 1. Direct or Near-Identical Repetition of the Last Bot Message (>= 0.75 similarity)
  const lastBotMsg = recentBotReplies[recentBotReplies.length - 1];
  if (lastBotMsg && lastBotMsg.text) {
    const sim = calculateTextSimilarity(cleanCandidate, lastBotMsg.text);
    if (sim >= 0.75) {
      return {
        loopDetected: true,
        reason: 'repetition_last_message',
        similarity: sim,
        detail: `Resposta tem similaridade de ${(sim * 100).toFixed(0)}% com o último envio do bot.`
      };
    }
  }

  // 2. Exact match with ANY bot reply in the recent window
  const normCandidate = normalizeTextForComparison(cleanCandidate);
  for (const prev of recentBotReplies) {
    if (prev.text) {
      const normPrev = normalizeTextForComparison(prev.text);
      if (normPrev === normCandidate && normCandidate.length > 25) {
        return {
          loopDetected: true,
          reason: 'identical_message_loop',
          detail: 'Mensagem idêntica a um envio anterior do bot.'
        };
      }
      const sim = calculateTextSimilarity(cleanCandidate, prev.text);
      if (sim >= 0.85 && cleanCandidate.length > 30) {
        return {
          loopDetected: true,
          reason: 'repetitive_echo_loop',
          detail: `Mensagem tem similaridade de ${(sim * 100).toFixed(0)}% com mensagem anterior.`
        };
      }
    }
  }

  // 3. Repeated CTA across turns without progression or re-asking already answered fact
  const currentCta = extractClosingCta(cleanCandidate);

  // Check if candidate asks a question demanding a fact that is already known
  const isDemandingLocation = (s) =>
    /(?:qual|onde|me passa|passa|informa|me diz|qual [eé]|qual o|qual seu)\b.*(?:bairro|cidade|cep|endere[cç]o|localidade)/i.test(s) ||
    /(?:para qual bairro|qual o seu bairro|qual seu bairro|qual o cep)/i.test(s);

  const isDemandingPayment = (s) =>
    /(?:qual|como|prefere|vai pagar|forma de pagamento|condi[cç][aã]o de pagamento|pix ou cart[aã]o|cart[aã]o ou pix)/i.test(s) &&
    /(?:pagamento|pagar|pix|cart[aã]o)/i.test(s);

  const isDemandingCapacity = (s) =>
    /(?:qual|quantos|quantas|qual tamanho|qual capacidade|quantos litros)\b/i.test(s) &&
    /(?:capacidade|litros|tamanho|medida|dimens)/i.test(s);

  const candidateSentences = cleanCandidate.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const s of candidateSentences) {
    if (s.includes('?')) {
      if (knownPreferences.capacity && isDemandingCapacity(s)) {
        return {
          loopDetected: true,
          reason: 'repetition_reasking_known_fact',
          detail: `Pergunta repetida sobre capacidade já informada: "${s}"`
        };
      }
      if ((knownPreferences.neighborhood || knownPreferences.city) && isDemandingLocation(s)) {
        return {
          loopDetected: true,
          reason: 'repetition_reasking_known_fact',
          detail: `Pergunta repetida sobre localização já informada: "${s}"`
        };
      }
      if (knownPreferences.paymentPreference && isDemandingPayment(s)) {
        return {
          loopDetected: true,
          reason: 'repetition_reasking_known_fact',
          detail: `Pergunta repetida sobre forma de pagamento já informada: "${s}"`
        };
      }
    }
  }

  // Check if candidate CTA is identical or substantially similar to the last bot CTA
  if (currentCta && lastBotMsg && lastBotMsg.cta) {
    if (areCtasSimilar(currentCta, lastBotMsg.cta)) {
      return {
        loopDetected: true,
        reason: 'repeated_cta_loop',
        detail: `Pergunta repetida consecutivamente: "${currentCta}"`
      };
    }
  }

  return { loopDetected: false };
}

const UNKNOWN_ANSWER_PATTERNS = [
  /n[aã]o tenho (?:essa|esta|acesso a essa|informa[cç][aã]o sobre essa|certeza sobre essa) informa[cç][aã]o/i,
  /n[aã]o sei (?:te |lhe )?informar/i,
  /n[aã]o sei (?:te |lhe )?responder/i,
  /n[aã]o consta no (?:nosso )?(?:cat[aá]logo|sistema|estoque)/i,
  /infelizmente n[aã]o (?:trabalhamos|temos esse produto|temos essa informa[cç][aã]o|possuo|disponho)/i,
  /n[aã]o trabalhamos com esse (?:produto|material|item)/i,
  /n[aã]o temos esse (?:produto|modelo|item)/i,
  /n[aã]o (?:vendemos|comercializamos|trabalhamos com|temos) (?:esse|este|essa|esta|esse tipo de|outros tipos de|esse modelo)/i,
  /n[aã]o (?:localizei|encontrei|achei) (?:no (?:sistema|cat[aá]logo|estoque)|essa informa[cç][aã]o|esse item|esse produto)/i,
  /est[aá] (?:em falta|esgotado|indispon[ií]vel)/i,
  /n[aã]o tenho como confirmar/i,
  /n[aã]o possuo (?:essa|esta) informa[cç][aã]o/i,
  /n[aã]o tenho (?:certeza|como confirmar|acesso|essa resposta)/i,
  /n[aã]o consigo (?:confirmar|verificar|te responder)/i,
  /como (?:um )?modelo de linguagem/i,
  /como (?:uma )?intelig[eê]ncia artificial/i,
  /minha base de dados n[aã]o/i,
  /sou apenas um (?:bot|atendente virtual|assistente virtual)/i,
  /n[aã]o posso ajudar com isso/i,
  /n[aã]o compreendi sua mensagem/i,
  /desculpe(?:-me)?,? mas n[aã]o consigo entender/i,
  /consulte (?:um|o) atendente/i,
  /falar com (?:um )?atendente humano/i,
  /vou transferir para um atendente/i,
];

const REPETITIVE_TOKEN_DELIRIUM = /(\b\w+\b)(?:\s+\1){3,}/i;
const REPETITIVE_PHRASE_DELIRIUM = /(\b(?:\w+\s+){1,4}\w+\b)(?:[\s,.?!]+\1){2,}/i;

const ABSURD_PROMISES_PATTERNS = [
  /parcelam(?:os|ento)? (?:em (?:at[eé]\s+)?)?(?:1[89]|2[0-9]|[3-9]\d)\s*x/i,
  /frete gr[aá]tis para todo o (?:brasil|pa[ií]s)/i,
  /(?:4[5-9]|[5-9]\d)%\s*de\s*desconto/i,
  /(?:desconto de\s+)?(?:4[5-9]|[5-9]\d)%/i,
  /garantia vital[ií]cia/i,
];

/**
 * Detects if candidate reply represents a delirium, unknown catalog answer, or severe hallucination
 */
function detectDeliriumOrUnknownAnswer({
  candidateReply = '',
  customerMessage = '',
  validationIssues = [],
} = {}) {
  if (!candidateReply || typeof candidateReply !== 'string') {
    return { isDelirium: false, isUnknownAnswer: false, shouldHandoff: false };
  }

  const clean = candidateReply.trim();

  // 1. Unknown answer patterns
  for (const pattern of UNKNOWN_ANSWER_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isDelirium: false,
        isUnknownAnswer: true,
        shouldHandoff: true,
        reason: 'unknown_answer',
        detail: `IA detectou ausência de resposta oficial no catálogo: "${clean.substring(0, 60)}..."`,
      };
    }
  }

  // 2. Token repetition / delirium loop (e.g. "caixa caixa caixa caixa" or phrase repeats)
  if (REPETITIVE_TOKEN_DELIRIUM.test(clean) || REPETITIVE_PHRASE_DELIRIUM.test(clean)) {
    return {
      isDelirium: true,
      isUnknownAnswer: false,
      shouldHandoff: true,
      reason: 'repetitive_token_delirium',
      detail: 'IA entrou em loop de repetição de palavras ou frases (delírio).',
    };
  }

  // 3. Official knowledge rule violations (severe price discrepancies)
  if (Array.isArray(validationIssues) && validationIssues.length > 0) {
    const hasMajorIssue = validationIssues.some(iss => {
      if (iss.mentionedPrice && iss.officialPrice) {
        const diff = Math.abs(iss.mentionedPrice - iss.officialPrice);
        return diff > 100;
      }
      return true;
    });
    if (hasMajorIssue) {
      return {
        isDelirium: true,
        isUnknownAnswer: false,
        shouldHandoff: true,
        reason: 'official_knowledge_conflict',
        detail: `Divergência severa com regras oficiais: ${validationIssues[0]?.message || 'preço inventado'}`,
      };
    }
  }

  // 4. Absurd / hallucinated promises
  for (const pattern of ABSURD_PROMISES_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isDelirium: true,
        isUnknownAnswer: false,
        shouldHandoff: true,
        reason: 'hallucinated_policy',
        detail: 'IA inventou condição comercial inexistente (delírio).',
      };
    }
  }

  // 5. Incoherent / code snippet / leaked JSON
  if (
    (clean.startsWith('{') && clean.endsWith('}') && clean.includes('"')) ||
    clean.startsWith('```') ||
    clean.includes(':::analysis')
  ) {
    return {
      isDelirium: true,
      isUnknownAnswer: false,
      shouldHandoff: true,
      reason: 'raw_code_or_json_leak',
      detail: 'IA vazou bloco de código ou JSON cru para o cliente.',
    };
  }

  return { isDelirium: false, isUnknownAnswer: false, shouldHandoff: false };
}

const GRACEFUL_HANDOFF_MESSAGE = 'Vou confirmar esse detalhe com a nossa equipe aqui no balcão e um atendente já te responde por aqui! 😊';
const CIRCUIT_BREAKER_TAGS = ['intervencao_humana', 'precisa_humano', 'delirio_evitado'];

/**
 * Full master evaluation of candidate reply:
 * Delirium check -> Repetition Loop check -> Sanitize & Vary -> Circuit Breaker trip if needed
 */
function evaluateCandidateReply({
  candidateReply = '',
  recentBotReplies = [],
  customerMessage = '',
  history = [],
  knownPreferences = {},
  validationIssues = [],
} = {}) {
  const isHandoffText = (txt) => {
    if (!txt || typeof txt !== 'string') return false;
    return (
      txt.includes('confirmar esse detalhe com a nossa equipe') ||
      txt.includes('um atendente já te responde') ||
      (txt.includes('vou confirmar') && txt.includes('atendente'))
    );
  };

  const alreadyHandoffSent =
    recentBotReplies.some(r => isHandoffText(r.text)) ||
    (Array.isArray(history) && history.some(h => isHandoffText(h.content || h.text)));

  if (!candidateReply || typeof candidateReply !== 'string' || !candidateReply.trim()) {
    return {
      valid: false,
      sanitizedReply: '',
      circuitBreakerTriggered: true,
      circuitBreakerReason: 'empty_reply',
      handoffReply: alreadyHandoffSent ? null : GRACEFUL_HANDOFF_MESSAGE,
      tagsToAdd: CIRCUIT_BREAKER_TAGS,
      action: alreadyHandoffSent ? 'silent_deactivate' : 'handoff',
    };
  }

  // 1. Delirium & Unknown Answer Check
  const deliriumCheck = detectDeliriumOrUnknownAnswer({
    candidateReply,
    customerMessage,
    validationIssues,
  });

  if (deliriumCheck.shouldHandoff) {
    return {
      valid: false,
      sanitizedReply: '',
      circuitBreakerTriggered: true,
      circuitBreakerReason: deliriumCheck.reason,
      handoffReply: alreadyHandoffSent ? null : GRACEFUL_HANDOFF_MESSAGE,
      tagsToAdd: CIRCUIT_BREAKER_TAGS,
      action: alreadyHandoffSent ? 'silent_deactivate' : 'handoff',
    };
  }

  // 2. Repetition Loop Check
  const loopCheck = detectRepetitionLoop({
    candidateReply,
    recentBotReplies,
    customerMessage,
    knownPreferences,
  });

  if (loopCheck.loopDetected) {
    return {
      valid: false,
      sanitizedReply: '',
      circuitBreakerTriggered: true,
      circuitBreakerReason: loopCheck.reason,
      handoffReply: alreadyHandoffSent ? null : GRACEFUL_HANDOFF_MESSAGE,
      tagsToAdd: CIRCUIT_BREAKER_TAGS,
      action: alreadyHandoffSent ? 'silent_deactivate' : 'handoff',
    };
  }

  // 3. Normal Sanitize & Vary
  let sanitized = sanitizeAndVaryBotReply(candidateReply, recentBotReplies, { knownPreferences });

  // If sanitized reply became empty or stripped down to nothing (< 8 chars)
  if (!sanitized || sanitized.length < 8) {
    return {
      valid: false,
      sanitizedReply: '',
      circuitBreakerTriggered: true,
      circuitBreakerReason: 'repetition_exhaustion',
      handoffReply: alreadyHandoffSent ? null : GRACEFUL_HANDOFF_MESSAGE,
      tagsToAdd: CIRCUIT_BREAKER_TAGS,
      action: alreadyHandoffSent ? 'silent_deactivate' : 'handoff',
    };
  }

  return {
    valid: true,
    sanitizedReply: sanitized,
    circuitBreakerTriggered: false,
    circuitBreakerReason: null,
    handoffReply: null,
    tagsToAdd: [],
    action: 'send',
  };
}

module.exports = {
  extractRecentBotReplies,
  detectGreeting,
  extractClosingCta,
  getCtaIntent,
  areCtasSimilar,
  getAlternativeCta,
  stripGreetingsAndIntroductions,
  buildAntiRepetitionPromptBlock,
  sanitizeAndVaryBotReply,
  normalizeTextForComparison,
  calculateTextSimilarity,
  isSentenceRepeated,
  detectRepetitionLoop,
  detectDeliriumOrUnknownAnswer,
  evaluateCandidateReply,
  GRACEFUL_HANDOFF_MESSAGE,
  CIRCUIT_BREAKER_TAGS,
  VARIED_CTAS,
};
