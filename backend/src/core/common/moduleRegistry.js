let moduleRegistry = null;

try {
	moduleRegistry = require('ai-engine/core/moduleRegistry');
} catch (error) {
	console.warn('[AI] moduleRegistry bridge unavailable:', error.message || error);
	moduleRegistry = {
		readRegistry: async () => ({ modules: [], source: 'fallback' }),
	};
}

module.exports = moduleRegistry;
