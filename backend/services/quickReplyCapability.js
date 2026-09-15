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

  if (normMessage.includes('foto') || normMessage.includes('imagem') || normMessage.includes('ver') || normMessage.includes('olhar')) {
    requestedMediaType = 'image';
  } else if (normMessage.includes('audio') || normMessage.includes('áudio') || normMessage.includes('voz')) {
    requestedMediaType = 'audio';
  } else if (normMessage.includes('video') || normMessage.includes('vídeo')) {
    requestedMediaType = 'video';
  } else if (normMessage.includes('catalogo') || normMessage.includes('tabela') || normMessage.includes('pdf')) {
    requestedMediaType = 'document';
  }

  const results = await searchQuickReplies({
    query: message,
    intent,
    product,
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

  const lines = [];
  for (const qr of quickReplies.slice(0, 15)) {
    const id = qr.id;
    const title = qr.title || qr.label || qr.cmd || 'Recurso';
    const items = Array.isArray(qr.items) && qr.items.length > 0 ? qr.items : (qr.steps || []);
    const types = items.map((i) => i.type).filter(Boolean);
    if (qr.mediaUrl || qr.fileUrl) types.push(qr.mediaType || 'image');
    const mediaBadge = types.length > 0 ? `[Mídias: ${[...new Set(types)].join(', ')}]` : '[Apenas Texto]';
    const summary = String(qr.content || qr.text || '').replace(/\s+/g, ' ').slice(0, 100);
    const mem = qr.aiMemory ? ` (Visão: ${qr.aiMemory.slice(0, 60)})` : '';

    lines.push(`- ID: "${id}" | Título: "${title}" ${mediaBadge}${mem} -> "${summary}..."`);
  }

  return lines.join('\n');
}

module.exports = {
  searchQuickReplies,
  findBestMatchForContext,
  formatCapabilitiesForPrompt,
};
