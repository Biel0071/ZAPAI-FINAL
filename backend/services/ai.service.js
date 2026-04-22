function loadAiEngine() {
  try {
    // Keep AI intelligence in external package only.
    return require('ai-engine');
  } catch (error) {
    console.error('[AI SERVICE] Failed to load ai-engine:', error.message);
    return null;
  }
}

async function processAI(data) {
  const aiEngine = loadAiEngine();

  if (!aiEngine || typeof aiEngine.processMessage !== 'function') {
    return null;
  }

  try {
    const response = await aiEngine.processMessage({
      message: data.message,
      contact: data.contact,
      history: data.history,
    });

    return normalizeResponse(response);
  } catch (error) {
    console.error('[AI SERVICE] AI ERROR:', error.message);
    return null;
  }
}

function normalizeResponse(res) {
  return {
    intent: res?.intent || 'unknown',
    leadScore: Number(res?.score) || 0,
    reply: res?.reply || '',
    suggestion: res?.suggestion || null,
  };
}

module.exports = { processAI };
