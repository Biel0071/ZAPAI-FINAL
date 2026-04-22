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
  ].join(' ');
}

module.exports = {
  buildPersonalityPrompt,
};
