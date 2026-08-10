const crmIntelligence = require('../services/crm-intelligence');
const historyCache = require('../services/crm-intelligence/cache/historyCache');

// Mocks
jest.mock('../repositories/conversationRepository', () => ({
  updateConversationState: jest.fn().mockResolvedValue({ id: 'conv_1', updated: true })
}));

jest.mock('../repositories/messageRepository', () => ({
  getMessagesByConversation: jest.fn().mockResolvedValue([])
}));

describe('CRM Intelligence Engine', () => {
  let ioMock;
  
  beforeEach(() => {
    ioMock = { emit: jest.fn() };
    historyCache.cache.clear();
    jest.clearAllMocks();
  });

  it('Caso 1: CRM atualizado independentemente da resposta enviada', async () => {
    const params = {
      sessionId: 'sess_1',
      conversationId: 'conv_1',
      contact: { phone: '11999999999' },
      message: 'Quanto custa?',
      store: {},
      io: ioMock
    };

    const context = await crmIntelligence.processIncomingMessage(params);

    expect(context.analysis.intent).toBe('price_request');
    expect(context.funnelStage).toBe('price_sent');
    
    // Verifica se salvou no banco
    const conversationRepository = require('../src/data/repositories/conversationRepository');
    expect(conversationRepository.updateConversationState).toHaveBeenCalled();
  });
  
  it('Caso 5: Erro no leadAnalyzer - Sales Funnel continua', async () => {
    // Simulando erro num stage que roda em Promise.allSettled
    jest.mock('../services/leadAnalyzer', () => ({
        analyzeLeadIntent: jest.fn().mockImplementation(() => { throw new Error('Mock error'); })
    }));
    
    const context = await crmIntelligence.processIncomingMessage({
      sessionId: 'sess_1',
      conversationId: 'conv_1',
      contact: { phone: '11999999999' },
      message: 'Teste de erro',
      store: {}
    });
    
    // Deve continuar e tentar avançar o funil com os fallbacks
    expect(context.funnelStage).toBe('new_lead');
  });

});
