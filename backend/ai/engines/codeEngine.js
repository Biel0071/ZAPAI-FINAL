const moduleEngine = require('./moduleEngine');

async function generateFromPrompt(prompt = '') {
  const plan = moduleEngine.parseModulePrompt(prompt);

  if (!plan.valid) {
    throw new Error('Unable to parse module name from prompt.');
  }

  const moduleResult = await moduleEngine.createModule(plan.moduleName);
  return {
    action: 'create_module',
    prompt,
    plan,
    result: moduleResult,
  };
}

module.exports = {
  generateFromPrompt,
};
