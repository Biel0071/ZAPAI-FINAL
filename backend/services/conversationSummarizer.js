function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function getRecentMessages(messages = []) {
  return messages.slice(-20);
}

function getLastClientMessage(messages = []) {
  return [...messages].reverse().find((message) => message && message.from === 'client');
}

function hasAnyTerm(text, terms) {
  return terms.some((term) => text.includes(term));
}

function getTopicClauses(messages = []) {
  const text = messages
    .filter((message) => message && message.text)
    .map((message) => normalizeText(message.text))
    .join(' ');

  const clauses = [];

  if (hasAnyTerm(text, ['orcamento', 'orçamento', 'preco', 'preço', 'valor', 'quanto custa'])) {
    clauses.push('pediu orçamento');
  }

  if (hasAnyTerm(text, ['entrega', 'retirada', 'frete'])) {
    clauses.push('perguntou sobre entrega');
  }

  if (hasAnyTerm(text, ['pix', 'pagamento', 'como pagar', 'cartao', 'cartão'])) {
    clauses.push('demonstrou interesse em pagamento');
  }

  if (hasAnyTerm(text, ['quero comprar', 'fechar', 'pedido'])) {
    clauses.push('sinalizou intenção de compra');
  }

  if (hasAnyTerm(text, ['muito caro', 'vou pensar', 'depois eu vejo', 'ta caro', 'tá caro'])) {
    clauses.push('apresentou objeção comercial');
  }

  return clauses;
}

function generateConversationSummary(messages = []) {
  const recentMessages = getRecentMessages(messages);

  if (!recentMessages.length) {
    return 'Conversa iniciada sem resumo disponível.';
  }

  const topicClauses = getTopicClauses(recentMessages);

  if (topicClauses.length > 0) {
    const limitedClauses = topicClauses.slice(0, 2);
    const sentence = limitedClauses.join(' e ');
    return `Cliente ${sentence}.`;
  }

  const lastClientMessage = getLastClientMessage(recentMessages);

  if (lastClientMessage?.text) {
    const preview = String(lastClientMessage.text).trim().replace(/\s+/g, ' ').slice(0, 90);
    return `Última demanda do cliente: ${preview}${preview.length >= 90 ? '...' : ''}`;
  }

  return 'Conversa em andamento no WhatsApp.';
}

module.exports = {
  generateConversationSummary,
};