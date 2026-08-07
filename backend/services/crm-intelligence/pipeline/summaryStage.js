class SummaryStage {
  async execute(context) {
    const start = performance.now();
    try {
      // In a full ML environment, this would call an LLM to summarize the interaction.
      // Currently, ZAPFLOW maintains summary through aiIntelligenceService (which is loaded in TagStage for now)
      // or post-processing. This stage is a placeholder for future async summarization.
      
      // If we had a generative summarizer, we would do:
      // context.summary = await generativeSummarizer(context.history);
      
    } catch (err) {
      console.error('[CRM:SummaryStage] Falha no sumario', err);
    }
    context.metrics.record('summary_time', performance.now() - start);
  }
}

module.exports = new SummaryStage();
