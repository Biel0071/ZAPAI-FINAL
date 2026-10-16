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
function extractRecentBotReplies(history = [], limit = 3) {
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
        botReplies.unshift({
          text,
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
 * excluding any recent CTAs across the last 3 bot replies.
 */
function getAlternativeCta(recentCtas = [], topic = 'closing_advance') {
  const ctaList = Array.isArray(recentCtas) ? recentCtas : [recentCtas].filter(Boolean);
  const pool = VARIED_CTAS[topic] || VARIED_CTAS.closing_advance;
  const filtered = pool.filter(c => !ctaList.some(prev => areCtasSimilar(c, prev)));
  if (filtered.length > 0) {
    return filtered[Math.floor(Math.random() * filtered.length)];
  }
  // Try fallback topic
  const fallbackTopic = topic === 'freight_location' ? 'payment' : (topic === 'payment' ? 'closing_advance' : 'freight_location');
  const fallbackPool = VARIED_CTAS[fallbackTopic] || VARIED_CTAS.closing_advance;
  const fallbackFiltered = fallbackPool.filter(c => !ctaList.some(prev => areCtasSimilar(c, prev)));
  if (fallbackFiltered.length > 0) {
    return fallbackFiltered[Math.floor(Math.random() * fallbackFiltered.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
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
    prompt += `Esta é a primeira mensagem do atendente nesta interação. Faça uma saudação amigável e acolhedora, variando naturalmente o cumprimento ("Oi!", "Olá!", "Opa!").\n`;
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

  // 3. Sentence-level deduplication: prevent repeating identical substantive sentences from last 3 bot replies
  if (hasPastBotMessages) {
    const pastSentences = new Set();
    recentBotReplies.forEach(r => {
      const sents = (r.text || '').split(/(?<=[.!?])\s+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 25);
      sents.forEach(s => pastSentences.add(s));
    });

    if (pastSentences.size > 0) {
      const currentSentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (currentSentences.length > 1) {
        const filtered = currentSentences.filter(s => {
          const normS = s.trim().toLowerCase();
          return !pastSentences.has(normS);
        });
        if (filtered.length >= 1) {
          cleaned = filtered.join(' ');
        }
      }
    }
  }

  // 4. Apply human micro-variations for natural tone
  try {
    cleaned = applyHumanMicroVariations(cleaned);
  } catch (_) {}

  return cleaned.trim();
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
  VARIED_CTAS,
};
