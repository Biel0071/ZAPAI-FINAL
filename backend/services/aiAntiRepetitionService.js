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

// Common Brazilian WhatsApp greeting regex patterns
const GREETING_START_REGEX = /^(?:(?:ol[aá]|oi|opa|bom\s+dia|boa\s+tarde|boa\s+noite)[!,.\s]*)+(?:aqui\s+[eé]\s+(?:a\s+|o\s+)?(?:camila|[a-zà-ÿ]+)(?:\s+da\s+loja)?[!,.\s]*)?(?:tudo\s+(?:bem|joia|certo)\??|como\s+vai\??)?[!,.\s]*/i;
const SELF_INTRO_REGEX = /(?:aqui\s+[eé]\s+(?:a\s+|o\s+)?(?:camila|[a-zà-ÿ]+)(?:\s+da\s+loja)?|sou\s+(?:a\s+|o\s+)?(?:camila|[a-zà-ÿ]+)(?:\s+da\s+loja)?)[!,.\s]*/i;

// Dynamic CTAs pool for varied commercial progression
const VARIED_CTAS = {
  freight_location: [
    'Qual o seu bairro ou CEP para eu já calcular a entrega com o melhor desconto?',
    'A entrega seria para qual bairro? Posso consultar a rota do caminhão agora.',
    'Me passa o bairro ou cidade da sua obra pra eu verificar o frete com as melhores condições.',
    'Você prefere que a gente entregue na sua obra ou gostaria de retirar direto na loja?'
  ],
  payment: [
    'Prefere pagamento à vista no PIX com 5% de desconto ou parcelado em até 10x no cartão?',
    'No PIX consigo aplicar o melhor desconto de imediato. Deseja que eu envie a chave?',
    'Qual forma de pagamento fica mais prática para você fechar hoje?'
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
    'Posso já verificar o prazo de expedição para a sua região?'
  ]
};

/**
 * Extracts the last N bot messages from history or message array.
 * Handles both [{ role, content }] and [{ from, text, fromMe }] formats.
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
      msg.from === 'agent' ||
      msg.from === 'bot' ||
      msg.fromMe === true ||
      msg.sender === 'agent' ||
      msg.sender === 'ai';

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
  const match = text.trim().match(GREETING_START_REGEX);
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
 * Checks similarity between two CTA strings to prevent repeating the same question
 */
function areCtasSimilar(ctaA = '', ctaB = '') {
  if (!ctaA || !ctaB) return false;
  const normA = ctaA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();
  const normB = ctaB.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();

  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Key phrase overlap
  const keyPhrases = [
    'reserve esse modelo',
    'reservar esse modelo',
    'reserve seu modelo',
    'qual o seu bairro',
    'qual seu bairro',
    'qual o cep',
    'pix com 5%',
    'pix ou cartao',
    '10x no cartao',
    'como posso ajudar'
  ];

  for (const phrase of keyPhrases) {
    if (normA.includes(phrase) && normB.includes(phrase)) return true;
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
  return (intersection / union) >= 0.55;
}

/**
 * Generates an alternate closing CTA when a repetition is detected
 */
function getAlternativeCta(lastCta = '', topic = 'closing_advance') {
  const pool = VARIED_CTAS[topic] || VARIED_CTAS.closing_advance;
  const filtered = pool.filter(c => !areCtasSimilar(c, lastCta));
  if (filtered.length > 0) {
    return filtered[Math.floor(Math.random() * filtered.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
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

    const lastBotMsg = recentBotReplies[recentBotReplies.length - 1];
    const lastCta = lastBotMsg?.cta || '';

    prompt += `\nREGRAS ESTRITAS DE CONDUTA CONVERSACIONAL (NUNCA REPETIR):\n`;
    prompt += `1. PROIBIDO REPETIR APRESENTAÇÃO/SAUDAÇÃO: Como você JÁ falou na conversa, NUNCA envie saudações de apresentação ("Olá! Aqui é a Camila...", "Oi, tudo bem?"). Vá DIRETO ao assunto respondendo ao que o cliente falou!\n`;
    if (lastCta) {
      prompt += `2. PROIBIDO REPETIR O MESMO CTA: Sua pergunta anterior foi: "${lastCta}". É PROIBIDO repetir essa mesma pergunta ou variação idêntica (como insistir em "Deseja que eu reserve esse modelo para a sua obra?"). Avance o diálogo com uma pergunta diferente (sobre entrega, pagamento, medidas ou confirmação).\n`;
    } else {
      prompt += `2. PROIBIDO REPETIR O MESMO CTA: Varie a pergunta de fechamento em cada mensagem.\n`;
    }
  } else {
    prompt += `Esta é a primeira mensagem do atendente nesta interação. Faça uma saudação amigável e acolhedora, variando naturalmente o cumprimento ("Oi!", "Olá!", "Opa!").\n`;
  }

  prompt += `3. SEGUIMENTO REAL NA LINHA DE RACIOCÍNIO: Se o cliente acabou de responder uma pergunta sua (por exemplo, informando capacidade "De 5 mil litros", local "Centro", ou pagamento "no pix"), você DEVE responder e confirmar exatamente o dado informado ("Temos a de 5 mil litros em polietileno com tampa de rosca...", "Para o Centro nossa entrega é rápida...", etc.) e em seguida fazer uma pergunta de avanço comercial.\n`;
  prompt += `4. DINÂMICA HUMANA DE WHATSAPP: Escreva como uma pessoa real digitando no WhatsApp: frases naturais, vocabulário dinâmico, sem rodeios robóticos e sem blocos gigantes de texto.\n`;

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
 * 1. Strips repetitive greetings if the bot already spoke.
 * 2. Replaces repetitive closing CTAs with fresh context-appropriate alternatives.
 * 3. Applies natural micro-variations.
 */
function sanitizeAndVaryBotReply(replyText = '', recentBotReplies = [], options = {}) {
  if (!replyText || typeof replyText !== 'string') return replyText;

  let cleaned = replyText.trim();
  const hasPastBotMessages = Array.isArray(recentBotReplies) && recentBotReplies.length > 0;

  // 1. Strip redundant greetings when conversation is already in progress
  if (hasPastBotMessages) {
    const matchGreeting = cleaned.match(GREETING_START_REGEX);
    if (matchGreeting && matchGreeting[0]) {
      const stripped = cleaned.slice(matchGreeting[0].length).trim();
      // Ensure we don't empty the message completely
      if (stripped.length >= 8) {
        // Capitalize first character
        cleaned = stripped.charAt(0).toUpperCase() + stripped.slice(1);
      }
    }

    // Strip standalone mid-conversation "Aqui é a Camila..." if repeated
    const introMatch = cleaned.match(SELF_INTRO_REGEX);
    if (introMatch && introMatch[0] && recentBotReplies.some(r => SELF_INTRO_REGEX.test(r.text))) {
      const strippedIntro = cleaned.replace(SELF_INTRO_REGEX, '').replace(/^[,\s.-]+/, '').trim();
      if (strippedIntro.length >= 8) {
        cleaned = strippedIntro.charAt(0).toUpperCase() + strippedIntro.slice(1);
      }
    }
  }

  // 2. Prevent repeating the exact same CTA as the last bot message
  if (hasPastBotMessages) {
    const lastBotMsg = recentBotReplies[recentBotReplies.length - 1];
    const lastCta = lastBotMsg?.cta || '';
    const currentCta = extractClosingCta(cleaned);

    if (lastCta && currentCta && areCtasSimilar(lastCta, currentCta)) {
      // Determine appropriate replacement topic
      let topic = 'closing_advance';
      const lowerClean = cleaned.toLowerCase();
      if (lowerClean.includes('5 mil') || lowerClean.includes('litros') || lowerClean.includes('caixa') || lowerClean.includes('churrasqueira') || lowerClean.includes('tijolo')) {
        topic = lowerClean.includes('bairro') || lowerClean.includes('cep') ? 'payment' : 'freight_location';
      } else if (lowerClean.includes('frete') || lowerClean.includes('entrega')) {
        topic = 'payment';
      }

      const altCta = getAlternativeCta(lastCta, topic);
      
      // Replace the closing question with the alternative
      if (currentCta.length > 5 && cleaned.endsWith(currentCta)) {
        cleaned = cleaned.slice(0, -currentCta.length).trim() + ' ' + altCta;
      } else {
        cleaned = cleaned.replace(currentCta, altCta);
      }
    }
  }

  // 3. Apply human micro-variations for natural tone
  try {
    cleaned = applyHumanMicroVariations(cleaned);
  } catch (_) {}

  return cleaned.trim();
}

module.exports = {
  extractRecentBotReplies,
  detectGreeting,
  extractClosingCta,
  areCtasSimilar,
  getAlternativeCta,
  buildAntiRepetitionPromptBlock,
  sanitizeAndVaryBotReply,
  VARIED_CTAS,
};
