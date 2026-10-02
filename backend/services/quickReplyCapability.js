/**
 * QuickReplyCapability — Camada de Capacidades e Ferramentas Multimodais de Resposta Rápida
 *
 * Transforma Respostas Rápidas de simples frases em EXTENSÕES DE CAPACIDADE DA IA.
 * Suporta:
 * - SEARCH_QUICK_REPLIES
 * - GET_QUICK_REPLY
 * - USE_QUICK_REPLY (Texto, Imagem, Áudio, Vídeo, Documento)
 * - Matching ponderado por intenção, produto, sinônimos e palavras-chave
 * - Suporte a múltiplos itens multimodais por resposta rápida
 * - Registro de uso e evolução de maturidade
 */

const quickReplyService = require('./quickReplyService');

function normalize(str = '') {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"´`]/g, '')
    .trim();
}

/**
 * Busca respostas rápidas com score de relevância por texto, produto ou intenção.
 */
async function searchQuickReplies({ query = '', intent = '', product = '', mediaType = '', companyId = 'default' }) {
  const all = await quickReplyService.listQuickReplies({ companyId });
  const normQuery = normalize(query);
  const normIntent = normalize(intent);
  const normProduct = normalize(product);
  const normMediaType = normalize(mediaType);

  const scored = all.map((qr) => {
    let score = 0;
    const title = normalize(qr.title || qr.label || '');
    const content = normalize(qr.content || qr.text || '');
    const category = normalize(qr.category || '');
    const tags = (qr.tags || []).map(normalize);
    const aiMemory = normalize(qr.aiMemory || '');

    // Verifica tipos de mídia disponíveis nos items ou steps
    const items = Array.isArray(qr.items) && qr.items.length > 0 ? qr.items : (qr.steps || []);
    const availableTypes = new Set(items.map((i) => String(i.type || 'text').toLowerCase()));
    if (qr.mediaUrl || qr.fileUrl) {
      availableTypes.add(String(qr.mediaType || 'image').toLowerCase());
    }

    // 0. Prioridade de Tenant (resposta personalizada da loja tem preferência sobre template default)
    if (companyId && companyId !== 'default' && qr.companyId === companyId) {
      score += 40;
    }

    // 1. Match de Produto (peso altíssimo)
    if (normProduct) {
      if (title.includes(normProduct)) score += 40;
      if (tags.some((t) => t.includes(normProduct))) score += 35;
      if (content.includes(normProduct)) score += 20;
      if (aiMemory.includes(normProduct)) score += 25;

      const prodWords = normProduct.split(/\s+/).filter((w) => w.length >= 3);
      for (const pw of prodWords) {
        if (title.includes(pw)) score += 20;
        if (tags.some((t) => t.includes(pw))) score += 15;
      }
    }

    // 2. Match de Intenção (ex: foto, preço, entrega, pagamento)
    if (normIntent) {
      if (normIntent.includes('foto') || normIntent.includes('imagem') || normIntent.includes('image')) {
        if (availableTypes.has('image')) score += 25;
      }
      if (normIntent.includes('audio') || normIntent.includes('voz')) {
        if (availableTypes.has('audio')) score += 25;
      }
      if (normIntent.includes('preco') || normIntent.includes('valor')) {
        if (category.includes('preco') || title.includes('preco') || content.includes('r$')) score += 20;
      }
      if (normIntent.includes('entrega') || normIntent.includes('frete')) {
        if (category.includes('entrega') || title.includes('entrega') || content.includes('frete')) score += 20;
      }
    }

    // 3. Match de Termo de Busca Livre
    if (normQuery) {
      const queryWords = normQuery.split(/\s+/).filter((w) => w.length >= 3);
      for (const word of queryWords) {
        if (title.includes(word)) score += 12;
        if (tags.some((t) => t.includes(word))) score += 10;
        if (content.includes(word)) score += 5;
        if (aiMemory.includes(word)) score += 8;
      }
    }

    // 4. Match de Tipo de Mídia Solicitado (bônus massivo para quem tem a mídia solicitada e penalidade para quem não tem)
    if (normMediaType) {
      if (availableTypes.has(normMediaType)) {
        score += 60;
      } else {
        score -= 60;
      }
    }

    // Bônus de favoritos e uso prévio
    if (qr.favorite) score += 3;
    if (qr.usageCount) score += Math.min(5, Math.floor(qr.usageCount / 5));

    return {
      quickReply: qr,
      score,
      availableTypes: Array.from(availableTypes),
    };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Seleciona a melhor resposta rápida / recurso multimodal para o contexto atual.
 */
async function findBestMatchForContext({ message = '', intent = '', product = '', companyId = 'default' }) {
  const normMessage = normalize(message);
  let requestedMediaType = null;
  let detectedProduct = product || '';
  let detectedIntent = intent || '';

  // Detecção de tipo de mídia solicitado
  if (normMessage.includes('foto') || normMessage.includes('imagem') || normMessage.includes('ver') || normMessage.includes('olhar') || normMessage.includes('fotos')) {
    requestedMediaType = 'image';
  } else if (normMessage.includes('audio') || normMessage.includes('áudio') || normMessage.includes('voz') || normMessage.includes('ouvir')) {
    requestedMediaType = 'audio';
  } else if (normMessage.includes('video') || normMessage.includes('vídeo') || normMessage.includes('resistencia') || normMessage.includes('quebra')) {
    requestedMediaType = 'video';
  } else if (normMessage.includes('catalogo') || normMessage.includes('tabela') || normMessage.includes('pdf')) {
    requestedMediaType = 'document';
  }

  // Detecção de produto pelo contexto da mensagem
  if (!detectedProduct) {
    if (normMessage.includes('churras') || normMessage.includes('grelha') || normMessage.includes('trio')) {
      detectedProduct = 'churrasqueira';
    } else if (normMessage.includes('betoneir') || normMessage.includes('csm')) {
      detectedProduct = 'betoneira';
    } else if (normMessage.includes('chale') || normMessage.includes('container')) {
      detectedProduct = 'chale container';
    } else if (normMessage.includes('jadlog') || normMessage.includes('jad') || normMessage.includes('rastre')) {
      detectedProduct = 'jadlog';
    } else if (normMessage.includes('tijol') || normMessage.includes('milheiro')) {
      detectedProduct = 'tijolo';
    } else if (normMessage.includes('cimento')) {
      detectedProduct = 'cimento';
    } else if (normMessage.includes('bloco')) {
      detectedProduct = 'bloco';
    } else if (normMessage.includes('caixa') || normMessage.includes('fortlev') || normMessage.includes('10000')) {
      detectedProduct = 'caixa';
    } else if (normMessage.includes('telha') || normMessage.includes('black')) {
      detectedProduct = 'telha';
    }
  }

  // Detecção de intenção específica
  if (!detectedIntent) {
    if (normMessage.includes('fechar') || normMessage.includes('comprar') || normMessage.includes('dados') || normMessage.includes('cpf')) {
      detectedIntent = 'fechamento';
    } else if (normMessage.includes('retirar') || normMessage.includes('retirada') || normMessage.includes('entrega')) {
      detectedIntent = 'entrega';
    }
  }

  const results = await searchQuickReplies({
    query: message,
    intent: detectedIntent,
    product: detectedProduct,
    mediaType: requestedMediaType || '',
    companyId,
  });

  if (results.length === 0) return null;

  const best = results[0];
  if (best.score < 10) return null; // Score mínimo de confiança

  const qr = best.quickReply;
  const items = Array.isArray(qr.items) && qr.items.length > 0 ? qr.items : (qr.steps || []);

  // Selecionar itens específicos de mídia se requisitado
  let selectedMediaItem = null;
  if (requestedMediaType) {
    selectedMediaItem = items.find((i) => String(i.type || '').toLowerCase() === requestedMediaType);
  }
  if (!selectedMediaItem && (qr.mediaUrl || qr.fileUrl)) {
    selectedMediaItem = {
      type: qr.mediaType || 'image',
      value: qr.mediaUrl || qr.fileUrl,
      caption: qr.text || '',
      filename: qr.filename || qr.fileName,
    };
  }

  return {
    id: qr.id,
    title: qr.title || qr.label,
    content: qr.content || qr.text,
    score: best.score,
    availableTypes: best.availableTypes,
    requestedMediaType,
    selectedMediaItem,
    allItems: items,
  };
}

/**
 * Formata capacidades de respostas rápidas para inclusão no System Prompt da IA.
 */
function formatCapabilitiesForPrompt(quickReplies = []) {
  if (!Array.isArray(quickReplies) || quickReplies.length === 0) {
    return 'Nenhuma capacidade de resposta rápida registrada.';
  }

  const lines = [
    '=== SKILLS & PODERES MULTIMODAIS DA ATENDENTE (RESPOSTAS RÁPIDAS DA LOJA) ===',
    'Você dispõe das seguintes skills e mídias oficiais para acionar quando o cliente demonstrar interesse ou solicitar fotos, vídeos ou áudios:',
  ];

  // Group by category
  const categories = {};
  for (const qr of quickReplies) {
    const cat = qr.category || 'GERAL';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(qr);
  }

  for (const [catName, catItems] of Object.entries(categories)) {
    lines.push(`\n[CATEGORIA: ${catName}]`);
    for (const qr of catItems.slice(0, 8)) {
      const id = qr.id;
      const title = qr.title || qr.label || 'Recurso';
      const items = Array.isArray(qr.items) && qr.items.length > 0 ? qr.items : (qr.steps || []);
      const types = items.map((i) => i.type).filter(Boolean);
      if (qr.mediaUrl || qr.fileUrl) types.push(qr.mediaType || 'image');
      const uniqueTypes = [...new Set(types)];
      const mediaBadge = uniqueTypes.length > 0 ? `[Mídias: ${uniqueTypes.join(', ')}]` : '[Texto]';
      const mem = qr.aiMemory ? ` - ${qr.aiMemory}` : '';
      lines.push(`  * "${title}" (ID: ${id}) ${mediaBadge}${mem}`);
    }
  }

  lines.push('\nInstrução Multimodal: Se o cliente pedir fotos, vídeos de qualidade, áudios ou se estiver na etapa de fechamento/rastreio correspondente, adicione no JSON de análise: "trigger_quick_reply": "<ID ou Titulo da Skill>". O sistema cuidará de enviar a mídia com o atraso e digitação humana perfeitos.');

  return lines.join('\n');
}

module.exports = {
  searchQuickReplies,
  findBestMatchForContext,
  formatCapabilitiesForPrompt,
};
