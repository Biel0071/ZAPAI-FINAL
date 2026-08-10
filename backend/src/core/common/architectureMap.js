let architectureMap = null;

try {
	architectureMap = require('ai-engine/core/architectureMap');
} catch (error) {
	console.warn('[AI] architectureMap bridge unavailable:', error.message || error);
	architectureMap = {
		buildSystemArchitectureMap: async () => ({
			generatedAt: new Date().toISOString(),
			modules: [],
			source: 'fallback',
		}),
	};
}

module.exports = architectureMap;
