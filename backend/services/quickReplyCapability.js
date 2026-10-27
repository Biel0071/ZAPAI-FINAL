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

  // Detecção de tipo de mídia explicitamente solicitado pelo cliente
  const hasExplicitPhotoRequest =
    normMessage.includes('foto') ||
    normMessage.includes('imagem') ||
    normMessage.includes('imagens') ||
    normMessage.includes('ver o modelo') ||
    normMessage.includes('ver produto');

  const hasExplicitAudioRequest =
    normMessage.includes('audio') ||
    normMessage.includes('voz') ||
    normMessage.includes('ouvir') ||
    normMessage.includes('grava');

  const hasExplicitVideoRequest =
    normMessage.includes('video') ||
    normMessage.includes('grava') ||
    normMessage.includes('teste de resistencia');

  const hasExplicitDocRequest =
    normMessage.includes('catalogo') ||
    normMessage.includes('tabela de precos') ||
    normMessage.includes('pdf');

  if (hasExplicitPhotoRequest) {
    requestedMediaType = 'image';
  } else if (hasExplicitAudioRequest) {
    requestedMediaType = 'audio';
  } else if (hasExplicitVideoRequest) {
    requestedMediaType = 'video';
  } else if (hasExplicitDocRequest) {
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
    } else if (normMessage.includes('garantia') || normMessage.includes('defeito') || normMessage.includes('seguranca')) {
      detectedProduct = 'garantia';
    } else if (normMessage.includes('pix')) {
      detectedProduct = 'pix';
    } else if (normMessage.includes('sinal') || normMessage.includes('cartao') || normMessage.includes('parcel')) {
      detectedProduct = 'pagamento';
    } else if (normMessage.includes('bom dia') || normMessage.includes('bomdia')) {
      detectedProduct = 'bomdia';
    }
  }

  // Detecção de intenção específica
  if (!detectedIntent) {
    if (normMessage.includes('fechar') || normMessage.includes('comprar') || normMessage.includes('dados') || normMessage.includes('cpf') || normMessage.includes('ficha')) {
      detectedIntent = 'fechamento';
    } else if (normMessage.includes('retirar') || normMessage.includes('retirada') || normMessage.includes('entrega') || normMessage.includes('frete')) {
      detectedIntent = 'entrega';
    } else if (normMessage.includes('garantia')) {
      detectedIntent = 'garantia';
    } else if (normMessage.includes('foto') || normMessage.includes('imagem') || normMessage.includes('ver')) {
      detectedIntent = 'foto';
    } else if (normMessage.includes('audio') || normMessage.includes('voz') || normMessage.includes('ouvir')) {
      detectedIntent = 'audio';
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

  // Encontrar o melhor resultado elegível
  let best = null;
  for (const res of results) {
    if (res.score < 35) continue;
    // Se for áudio exclusivo sem texto e cliente não pediu áudio nem voz, pular para o próximo elegível
    const isAudioOnly = res.availableTypes?.includes('audio') && res.availableTypes?.length === 1 && !res.quickReply?.content?.trim();
    if (isAudioOnly && !hasExplicitAudioRequest && !normMessage.includes('audio') && !normMessage.includes('voz')) {
      continue;
    }
    best = res;
    break;
  }

  if (!best) return null;

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
 * Constrói a Memória Acoplada Multimodal completa de Respostas Rápidas, Imagens e Áudios para o System Prompt.
 */
function buildCoupledQuickReplyMemory(quickReplies = [], { agent = null, message = '', companyId = 'default', matchedCapability = null } = {}) {
  if (!Array.isArray(quickReplies) || quickReplies.length === 0) {
    return 'Nenhuma resposta rápida cadastrada na loja.';
  }

  const lines = [
    '=== [MEMÓRIA ACOPLADA: RESPOSTAS RÁPIDAS, IMAGENS & ÁUDIOS OFICIAIS DA LOJA] ===',
    'Você dispõe de uma biblioteca acoplada de Respostas Rápidas, Fotos Reais e Áudios Oficiais gravados da loja.',
    'Esta biblioteca é uma extensão viva e direta da sua memória e capacidade como atendente.',
    '',
    'DIRETRIZES DE USO FLEXÍVEL DESTA MEMÓRIA:',
    '1. USAR PARTES DO TEXTO: Você pode citar ou parafrasear livremente qualquer argumento de venda, condição de pagamento (ex: R$ 990,00, 5% no PIX ou 10x sem juros), prazos (3 a 5 dias úteis) ou perguntas de cadastro contidas nos textos das respostas rápidas em sua fala natural e humanizada.',
    '2. USAR O TEXTO COMPLETO: Quando a resposta rápida expressar exatamente o que deve ser dito, você pode usar seu texto completo de forma fluida.',
    '3. ENVIAR UMA IMAGEM ESPECÍFICA: Se o cliente pedir foto/imagem ou se for a etapa de prova social (Step 2), declare no JSON de análise :::analysis:',
    '   "send_media": { "type": "image", "value": "<caminho_da_imagem>", "caption": "<legenda opcional>" }',
    '4. ENVIAR UM ÁUDIO ESPECÍFICO: Se o cliente pedir áudio, preferir ouvir uma explicação em voz ou se você desejar enviar uma explicação gravada oficial da loja (ex: garantia, pagamento, apresentação), declare no JSON de análise :::analysis:',
    '   "send_media": { "type": "audio", "value": "<caminho_do_audio>" }',
    '5. DISPARAR A RESPOSTA RÁPIDA COMPLETA: Se desejar disparar a sequência completa de mídias e etapas da resposta rápida, declare no JSON de análise :::analysis:',
    '   "trigger_quick_reply": "<ID_OU_TITULO_DA_RESPOSTA_RAPIDA>"',
  ];

  if (matchedCapability) {
    lines.push('');
    lines.push('⭐ RECURSO EM DESTAQUE PARA A DEMANDA ATUAL DO CLIENTE:');
    lines.push(`- Título: "${matchedCapability.title}" (ID: "${matchedCapability.id}")`);
    lines.push(`  Tipos de mídia disponíveis: ${(matchedCapability.availableTypes || []).join(', ')}`);
    if (matchedCapability.selectedMediaItem) {
      lines.push(`  Mídia sugerida: [${String(matchedCapability.selectedMediaItem.type || 'media').toUpperCase()}] ${matchedCapability.selectedMediaItem.value}`);
    }
    lines.push(`  Se o cliente solicitou fotos, áudio ou informações desse produto, declare no "trigger_quick_reply" ou "send_media"!`);
  }

  // Separar QRs prioritárias para detalhamento
  const priorityKeywords = ['churras', 'garantia', 'pix', 'sinal', 'entrega', 'dados', 'bomdia', 'cimento', 'bloco', 'jad'];
  const priorityQRs = [];
  const otherQRs = [];

  for (const qr of quickReplies) {
    const titleNorm = String(qr.title || '').toLowerCase();
    const isPriority = priorityKeywords.some(kw => titleNorm.includes(kw)) || qr.id === matchedCapability?.id;
    if (isPriority) {
      priorityQRs.push(qr);
    } else {
      otherQRs.push(qr);
    }
  }

  lines.push('');
  lines.push('--- [RECURSOS MULTIMODAIS DETALHADOS (FOTOS REAIS, ÁUDIOS & TEXTOS)] ---');

  for (const qr of priorityQRs.slice(0, 4)) {
    const items = Array.isArray(qr.items) && qr.items.length > 0 ? qr.items : (qr.steps || []);
    const images = items.filter(i => i.type === 'image' || (qr.mediaType === 'image' && qr.mediaUrl));
    const audios = items.filter(i => i.type === 'audio' || (qr.mediaType === 'audio' && qr.mediaUrl));
    const textItem = items.find(i => i.type === 'text' && i.value?.trim()) || { value: qr.content || qr.text || '' };

    lines.push(`\n▶ [ID: "${qr.id}"] Título: "${qr.title}" | Categoria: ${qr.category || 'GERAL'}`);
    if (qr.aiMemory) {
      lines.push(`  Memória Semântica: "${qr.aiMemory}"`);
    }
    if (textItem.value) {
      const textPreview = textItem.value.length > 220 ? `${textItem.value.substring(0, 220)}...` : textItem.value;
      lines.push(`  Texto Oficial: "${textPreview.replace(/\n+/g, ' ')}"`);
    }
    if (images.length > 0) {
      lines.push(`  Imagens Reais (${images.length} fotos disponíveis):`);
      images.slice(0, 2).forEach((img, idx) => {
        lines.push(`    - Foto ${idx + 1}: ${img.value || qr.mediaUrl} ${img.caption ? `(Legenda: "${img.caption}")` : ''}`);
      });
      if (images.length > 2) lines.push(`    - (+ ${images.length - 2} fotos adicionais disponíveis ao disparar trigger_quick_reply)`);
    }
    if (audios.length > 0) {
      lines.push(`  Áudios de Voz Gravados (${audios.length} áudio(s) disponível(is)):`);
      audios.forEach((aud, idx) => {
        lines.push(`    - Áudio ${idx + 1}: ${aud.value || qr.mediaUrl} (Áudio oficial gravado em voz da loja)`);
      });
    }
  }

  if (otherQRs.length > 0 && !matchedCapability) {
    lines.push('\n--- [OUTRAS RESPOSTAS RÁPIDAS DA LOJA (CATÁLOGO GERAL)] ---');
    for (const qr of otherQRs.slice(0, 4)) {
      const items = Array.isArray(qr.items) && qr.items.length > 0 ? qr.items : [];
      const types = [...new Set(items.map(i => i.type).filter(Boolean))];
      if (qr.mediaUrl) types.push(qr.mediaType || 'media');
      const typeBadge = types.length > 0 ? `[${types.join(', ')}]` : '[Texto]';
      const mem = qr.aiMemory ? ` - ${qr.aiMemory.slice(0, 80)}` : '';
      lines.push(`* "${qr.title}" (ID: ${qr.id}) ${typeBadge}${mem}`);
    }
  }

  return lines.join('\n');
}

/**
 * Formata capacidades de respostas rápidas para inclusão no System Prompt da IA (compatibilidade).
 */
function formatCapabilitiesForPrompt(quickReplies = []) {
  if (!Array.isArray(quickReplies) || quickReplies.length === 0) {
    return 'Nenhuma capacidade de resposta rápida registrada.';
  }
  const lines = ['--- [CATÁLOGO DE CAPACIDADES E RESPOSTAS RÁPIDAS DA LOJA] ---'];
  for (const qr of quickReplies) {
    const id = qr.id;
    const title = qr.title || qr.label || qr.cmd || 'Recurso';
    const items = Array.isArray(qr.items) && qr.items.length > 0 ? qr.items : (qr.steps || []);
    const stepsCount = items.length || 1;
    const types = [...new Set(items.map(i => i.type).filter(Boolean))];
    const mediaBadge = types.length > 0 ? ` [${stepsCount} etapas] [Mídias: ${types.join(', ')}]` : ` [${stepsCount} etapas]`;
    const firstText = items.find(i => i.type === 'text' && i.value)?.value || qr.content || qr.text || '';
    const textPreview = firstText ? ` - "${String(firstText).slice(0, 120)}"` : '';
    lines.push(`* "${title}" (ID: ${id})${mediaBadge}${textPreview}`);
  }
  return lines.join('\n');
}

module.exports = {
  searchQuickReplies,
  findBestMatchForContext,
  formatCapabilitiesForPrompt,
  buildCoupledQuickReplyMemory,
};
