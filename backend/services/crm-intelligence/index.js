const CRMContext = require('./context');
const CRMMetrics = require('./metrics/crmMetrics');

// Initialize Event Listeners
require('./events/crmEvents');

// Pipeline Stages
const historyStage = require('./pipeline/historyStage');
const intentStage = require('./pipeline/intentStage');
const temperatureStage = require('./pipeline/temperatureStage');
const summaryStage = require('./pipeline/summaryStage');
const funnelStage = require('./pipeline/funnelStage');
const tagStage = require('./pipeline/tagStage');
const persistStage = require('./pipeline/persistStage');
const realtimeStage = require('./pipeline/realtimeStage');

class CRMIntelligenceEngine {
  
  /**
   * Processa uma mensagem recebida atraves do Pipeline do CRM
   */
  async processIncomingMessage(params) {
    console.log(`[CRM_START] Iniciando analise para ${params.conversationId}`);
    const metrics = new CRMMetrics();
    const context = new CRMContext({ ...params, metrics });
    
    const startTime = performance.now();

    try {
      // 1. History Stage (Sequential)
      await historyStage.execute(context);
      console.log(`[CRM_HISTORY_LOADED] Histórico carregado para ${context.conversationId}`);

      // 2. Parallel Stages (Intent, Temperature, Summary)
      await Promise.allSettled([
        intentStage.execute(context),
        temperatureStage.execute(context),
        summaryStage.execute(context)
      ]);
      console.log(`[CRM_INTENT_DONE] Análise paralela concluída para ${context.conversationId}`);

      // 3. Dependent Stages (Funnel requires Intent/Temperature)
      await funnelStage.execute(context);
      console.log(`[CRM_FUNNEL_DONE] Funil avançado: ${context.funnelStage}`);

      // 4. Tag Stage (Requires all above)
      await tagStage.execute(context);
      console.log(`[CRM_TAGS_DONE] Tags computadas`);

      // 5. Persistence Stage
      await persistStage.execute(context);

      // 6. Realtime Stage
      await realtimeStage.execute(context);

      metrics.record('total_time', performance.now() - startTime);
      metrics.logSummary(context.conversationId);
      
      console.log(`[CRM_SUCCESS] CRM processado com sucesso para ${context.conversationId}`);

      return context;
    } catch (err) {
      console.error(`[CRM_FAIL] Erro crítico no CRM Engine para ${context.conversationId}:`, err);
      // We return context so automation doesn't break
      return context; 
    }
  }
}

module.exports = new CRMIntelligenceEngine();
