const { buildLeadTags } = require('../../salesFunnel');
const aiIntelligenceService = require('../../aiIntelligenceService');

class TagStage {
  async execute(context) {
    const start = performance.now();
    try {
      const memoryContext = 
        aiIntelligenceService.getOpenAIContextForContact(context.store, context.conversationId) ||
        aiIntelligenceService.getOpenAIContextForContact(context.store, context.contact?.phone);
        
      const memoryTags = Array.isArray(memoryContext?.tags) ? memoryContext.tags : [];
      const convTags = Array.isArray(context.conversation?.tags) ? context.conversation.tags : [];
      
      const newTags = buildLeadTags(context.analysis, context.funnelStage);
      
      context.tags = Array.from(new Set([
        ...convTags,
        ...newTags,
        ...memoryTags,
      ]));
      
      context.summary = memoryContext?.summary || context.conversation?.summary;
      
    } catch (err) {
      console.error('[CRM:TagStage] Falha na construcao de tags', err);
    }
    context.metrics.record('tag_time', performance.now() - start);
  }
}

module.exports = new TagStage();
