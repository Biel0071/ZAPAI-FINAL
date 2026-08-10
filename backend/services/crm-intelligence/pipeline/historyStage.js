const messageRepository = require('../../../src/data/repositories/messageRepository');
const historyCache = require('../cache/historyCache');

class HistoryStage {
  async execute(context) {
    const start = performance.now();
    
    const cachedHistory = historyCache.get(context.conversationId);
    if (cachedHistory) {
      context.history = cachedHistory;
      context.metrics.increment('cache_hit');
      
      // Smart Cache Invalidation / Append
      // Because this is a new message, we add it to the context history array
      // so subsequent stages see it.
      context.history.push({
          content: context.message,
          role: 'user',
          timestamp: new Date().toISOString()
      });
      // Update cache
      historyCache.append(context.conversationId, [{
          content: context.message,
          role: 'user',
          timestamp: new Date().toISOString()
      }]);

    } else {
      context.metrics.increment('cache_miss');
      
      const dbMessages = await messageRepository
        .getMessagesByConversation(context.conversationId)
        .catch(() => []);

      context.history = dbMessages.slice(-20).map((msg) => ({
        content: msg.content || msg.text || '',
        role: msg.fromMe ? 'assistant' : 'user',
        timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
      }));

      historyCache.set(context.conversationId, context.history);
    }

    // Format for leadAnalyzer
    context.leadHistory = context.history.map((entry) => ({
      from: entry.role === 'assistant' ? 'agent' : 'client',
      text: entry.content,
    }));

    context.metrics.record('history_load_time', performance.now() - start);
  }
}

module.exports = new HistoryStage();
