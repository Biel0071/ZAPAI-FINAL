const codeEngine = require('../engines/codeEngine');

async function run(payload = {}) {
  const prompt = payload.prompt || '';
  const output = await codeEngine.generateFromPrompt(prompt);

  return {
    agent: 'codeGeneratorAgent',
    generatedAt: new Date().toISOString(),
    output,
  };
}

module.exports = {
  run,
};
