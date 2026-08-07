class CRMContext {
  constructor(params) {
    this.sessionId = params.sessionId;
    this.conversationId = params.conversationId;
    this.contact = params.contact || {};
    this.message = params.message || '';
    this.conversation = params.conversation || null;
    this.store = params.store || null;

    // Output from stages
    this.history = [];
    this.leadHistory = []; // Translated format for AI
    
    this.analysis = {
      confidence: 0,
      intent: 'information',
      lead_temperature: 'cold',
      next_action: 'educate'
    };
    
    this.funnelStage = null;
    this.tags = [];
    this.summary = null;
    
    this.crmState = null; // Result of the DB update

    this.metrics = null; // Injected
  }
}

module.exports = CRMContext;
