const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const conversationRepoPath = require.resolve('../src/data/repositories/conversationRepository');
const messageRepoPath = require.resolve('../src/data/repositories/messageRepository');

let updateStateCalled = false;

require.cache[conversationRepoPath] = {
  id: conversationRepoPath,
  filename: conversationRepoPath,
  loaded: true,
  exports: {
    updateConversationState: async () => {
      updateStateCalled = true;
      return { id: 'conv_1', updated: true };
    },
    findById: async () => ({ id: 'conv_1', lead_id: 1, company_id: 'default' }),
  }
};

require.cache[messageRepoPath] = {
  id: messageRepoPath,
  filename: messageRepoPath,
  loaded: true,
  exports: {
    getMessagesByConversation: async () => []
  }
};

const crmIntelligence = require('../services/crm-intelligence');
const historyCache = require('../services/crm-intelligence/cache/historyCache');

describe('CRM Intelligence Engine', () => {
  let ioMock;

  beforeEach(() => {
    ioMock = { emit: () => {} };
    historyCache.cache.clear();
    updateStateCalled = false;
  });

  const { after } = require('node:test');
  after(async () => {
    try {
      const { pool } = require('../src/infrastructure/config/database');
      await pool.end();
    } catch {}
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

    assert.equal(context.analysis.intent, 'price_request');
    assert.equal(context.funnelStage, 'price_sent');
    assert.equal(updateStateCalled, true);
  });

  it('Caso 5: Erro no leadAnalyzer - Sales Funnel continua', async () => {
    const context = await crmIntelligence.processIncomingMessage({
      sessionId: 'sess_1',
      conversationId: 'conv_1',
      contact: { phone: '11999999999' },
      message: 'Teste de erro',
      store: {}
    });

    // Deve continuar e tentar avançar o funil com os fallbacks
    assert.equal(context.funnelStage, 'new_lead');
  });
});
