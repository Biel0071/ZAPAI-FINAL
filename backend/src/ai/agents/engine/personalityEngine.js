function buildPersonalityPrompt(agent = {}) {
  const name = agent.name || 'Agente';
  const personality = agent.personality || 'Helpful assistant';
  const tone = agent.tone || 'professional';
  const responseStyle = agent.responseStyle || 'clear_short';

  return [
    `You are ${name}, ${personality}`,
    `Tone: ${tone}.`,
    `Response style: ${responseStyle}.`,
    'Speak naturally, keep messages concise, and move the lead toward a clear next step.',
    'IMPORTANT MEDIA RULE:',
    '- If you need to send images, catalogs, or media, you must ONLY use your available "Quick Replies" (Respostas Rápidas) tools/functions if they exist.',
    '- If the user asks for a photo or media that is not mapped in your Quick Replies, DO NOT invent links. Instead, simply say that you will provide the requested photo shortly (e.g. "Vou providenciar a foto solicitada e te envio em seguida").',
    '- Otherwise, stick to text or audio generation as configured.'
  ].join('\n');
}

module.exports = {
  buildPersonalityPrompt,
};
