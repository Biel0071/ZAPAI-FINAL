/**
 * Message Variation Engine (Spintax, Personalization & Dynamic Anti-Ban Mutations)
 * 
 * Ensures campaign dispatches and outbound messages never sound repetitive or identical,
 * creating natural human variations and unique hashes to prevent Meta/WhatsApp spam filters.
 */

/**
 * Clean a contact's name for natural speech:
 * - Drops emojis, special characters, phone numbers, and raw JIDs.
 * - Extracts only the clean first name with proper capitalization.
 */
function getCleanFirstName(contact = {}) {
  let raw = contact?.name || contact?.pushName || contact?.leadName || '';
  if (!raw || typeof raw !== 'string') return '';

  // If it's a phone number or JID or LID, do not use it as a name
  if (raw.includes('@') || /^\+?\d{8,}$/.test(raw.replace(/\D/g, '')) && raw.length > 7) {
    return '';
  }

  // Remove emojis and non-alphanumeric unicode
  const clean = raw
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[^\p{L}\s]/gu, '')
    .trim();

  if (!clean || clean.length < 2) return '';

  // Get first name
  const firstName = clean.split(/\s+/)[0];
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

/**
 * Resolves standard Spintax syntax: {Option 1|Option 2|Option 3}
 * Supports nested spintax recursively: {Oi|{Olá|Opa}}
 */
function parseSpintax(text) {
  if (!text || typeof text !== 'string') return '';

  const spintaxRegex = /\{([^{}]+)\}/g;
  let matches = 0;
  let result = text;

  while (spintaxRegex.test(result) && matches < 20) {
    matches++;
    result = result.replace(spintaxRegex, (_match, group) => {
      const choices = group.split('|');
      const chosen = choices[Math.floor(Math.random() * choices.length)];
      return chosen ? chosen.trim() : '';
    });
  }

  return result;
}

/**
 * Replaces personal variables like {nome}, {primeiro_nome}, {saudacao}
 */
function personalizeMessage(text, contact = {}) {
  if (!text || typeof text !== 'string') return '';

  const firstName = getCleanFirstName(contact);
  const now = new Date();
  const hours = now.getHours();
  
  let timeGreeting = 'Olá';
  if (hours >= 5 && hours < 12) timeGreeting = 'Bom dia';
  else if (hours >= 12 && hours < 18) timeGreeting = 'Boa tarde';
  else timeGreeting = 'Boa noite';

  let result = text;

  // Personalize name
  if (firstName) {
    result = result.replace(/\{nome\}|\{name\}|\{primeiro_nome\}/gi, firstName);
    // If the message starts with a greeting like "Oi!" or "Olá!" and has a name, we can naturally inject the name
    // e.g., "Oi! Tudo bem?" -> "Oi Bruno! Tudo bem?"
    result = result.replace(/^(Oi|Olá|Opa)!?\s+(Tudo bem\?|Tudo certo\?|Como vai\?)/i, `$1 ${firstName}! $2`);
  } else {
    // If no clean name is available, remove variable cleanly without leaving blank spaces
    result = result.replace(/\{nome\}|\{name\}|\{primeiro_nome\}/gi, '');
  }

  // Personalize greeting by time of day
  result = result.replace(/\{saudacao\}/gi, timeGreeting);

  return result;
}

/**
 * Set of common Portuguese sales/retail phrases with interchangeable equivalents.
 * Applied automatically so identical templates generate distinct, human variants.
 */
const EQUIVALENCE_MAP = [
  // 1. Saudações Iniciais
  {
    pattern: /Oi!?\s+Tudo bem\?/gi,
    spintax: '{Oi! Tudo bem?|Olá! Tudo bem?|Oi, tudo certo?|Olá, tudo joia?|Oi! Como você tá?|Opa! Tudo em ordem?}'
  },
  {
    pattern: /Olá!?\s+Tudo bem\?/gi,
    spintax: '{Olá! Tudo bem?|Oi! Tudo bem?|Olá, tudo certo?|Oi, tudo joia?|Opa! Tudo bem?}'
  },
  {
    pattern: /Bom dia!?\s+Tudo bem\?/gi,
    spintax: '{Bom dia! Tudo bem?|Olá, bom dia! Tudo bem?|Bom dia, tudo certo?|Bom dia! Tudo joia?}'
  },
  {
    pattern: /Boa tarde!?\s+Tudo bem\?/gi,
    spintax: '{Boa tarde! Tudo bem?|Olá, boa tarde! Tudo bem?|Boa tarde, tudo certo?|Boa tarde! Tudo joia?}'
  },

  // 2. Apresentações do Atendente
  {
    pattern: /É a Camila aqui do Depósito Vista Alegre\./gi,
    spintax: '{É a Camila aqui do Depósito Vista Alegre.|Aqui é a Camila do Depósito Vista Alegre.|Camila por aqui, do Depósito Vista Alegre.|Aqui é a Camila da Vista Alegre.|Sou a Camila aqui do Depósito Vista Alegre.}'
  },
  {
    pattern: /Aqui é a Camila do Depósito Vista Alegre\./gi,
    spintax: '{Aqui é a Camila do Depósito Vista Alegre.|É a Camila aqui do Depósito Vista Alegre.|Camila por aqui, do Depósito Vista Alegre.|Sou a Camila aqui do Depósito Vista Alegre.}'
  },
  {
    pattern: /É a ([A-Z][a-z]+) aqui d[oe] ([A-Z][a-zA-Z\s]+)\./gi,
    spintax: '{É a $1 aqui do $2.|Aqui é a $1 do $2.|Aqui é a $1 da equipe do $2.|Sou a $1 aqui do $2.}'
  },

  // 3. Menção ao contato / Gancho com o lead
  {
    pattern: /Vi que você falou com a gente hoje sobre materiais\./gi,
    spintax: '{Vi que você falou com a gente hoje sobre materiais.|Vi que você nos chamou mais cedo sobre materiais.|Notei que você conversou com a nossa equipe hoje sobre materiais.|Vi que você entrou em contato com a gente hoje sobre sua obra.}'
  },
  {
    pattern: /Vi que você entrou em contato com a gente ontem sobre seu orçamento de materiais\./gi,
    spintax: '{Vi que você entrou em contato com a gente ontem sobre seu orçamento de materiais.|Notei que você nos chamou ontem sobre o orçamento da sua obra.|Vi que você conversou ontem com a gente sobre os materiais.|Vi seu contato de ontem sobre o pedido de materiais.}'
  },
  {
    pattern: /Vi que você falou com a gente/gi,
    spintax: '{Vi que você falou com a gente|Notei seu contato com a nossa equipe|Vi que você nos chamou|Vi que você conversou com a gente}'
  },

  // 4. Chamada de Fechamento / Call to Action
  {
    pattern: /Conseguiu ver seu pedido certinho ou quer que eu revise algum item e as condições pra gente fechar e agendar sua entrega\?/gi,
    spintax: '{Conseguiu ver seu pedido certinho ou quer que eu revise algum item e as condições pra gente fechar e agendar sua entrega?|Deu pra dar uma olhada na cotação ou quer que eu veja os itens e condições de pagamento pra agendarmos a entrega?|Conseguiu analisar os valores ou prefere que eu ajuste algo pra gente já fechar e programar a entrega?|Deu certo de conferir a lista ou quer que eu revise alguma condição pra adiantar seu pedido?}'
  },
  {
    pattern: /fechar e agendar sua entrega\?/gi,
    spintax: '{fechar e agendar sua entrega?|programar a entrega da sua obra?|adiantar seu pedido e entrega?|já deixar sua entrega combinada?}'
  }
];

/**
 * Injects dynamic micro-variations into text by matching common structural phrases
 */
function applyHumanMicroVariations(text) {
  if (!text || typeof text !== 'string') return '';

  let varied = text;
  for (const item of EQUIVALENCE_MAP) {
    if (item.pattern.test(varied)) {
      varied = varied.replace(item.pattern, item.spintax);
    }
  }

  return varied;
}

/**
 * Process a message for campaign dispatch:
 * 1. Personalizes with contact data ({nome}, etc.).
 * 2. If no explicit spintax was provided, applies automatic human micro-variations.
 * 3. Resolves all Spintax choices.
 * 4. Cleans whitespace.
 */
function processCampaignMessage(rawContent, contact = {}, options = {}) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { text: '', isVaried: false };
  }

  const hasManualSpintax = /\{[^{}]+\|[^{}]+\}/.test(rawContent);
  let stepText = rawContent;

  // 1. Personalize contact variables
  stepText = personalizeMessage(stepText, contact);

  // 2. If autoVariations is true (default) and no manual spintax was used, apply micro-variations
  const autoVariations = options.autoVariations !== false;
  if (autoVariations) {
    stepText = applyHumanMicroVariations(stepText);
  }

  // 3. Resolve all spintax branches
  const finalText = parseSpintax(stepText).replace(/[ \t]+/g, ' ').trim();

  return {
    text: finalText,
    originalText: rawContent,
    isVaried: finalText !== rawContent,
  };
}

module.exports = {
  getCleanFirstName,
  parseSpintax,
  personalizeMessage,
  applyHumanMicroVariations,
  processCampaignMessage,
};
