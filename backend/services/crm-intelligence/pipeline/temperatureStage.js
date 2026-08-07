class TemperatureStage {
  async execute(context) {
    const start = performance.now();
    try {
      // leadAnalyzer already extracts temperature inside the analysis object, 
      // but in an Enterprise CRM we might query external SLA or decay models here.
      // For now, we ensure the temperature is valid in the context.
      if (!context.analysis.lead_temperature) {
          context.analysis.lead_temperature = 'cold';
      }
    } catch (err) {
      console.error('[CRM:TemperatureStage] Falha', err);
    }
    context.metrics.record('temperature_time', performance.now() - start);
  }
}

module.exports = new TemperatureStage();
