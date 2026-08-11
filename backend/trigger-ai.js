require('dotenv').config();
const { runAIForChat } = require('./services/whatsapp/connection/stableSession');
const session = { companyId: 'default', sessionId: 'material', systemConnected: true };
const chat = { 
  aiEnabled: true, 
  assignedTo: null, 
  conversationId: 2518, 
  isGroup: false 
};
const store = { chats: { '528431972395@lid': chat }, contacts: {} };

// Mock dependencies
global.store = store;

async function testAI() {
  console.log("Triggering AI...");
  const enterpriseQueueService = require('./services/enterprise/queue-service');
  
  await enterpriseQueueService.enqueue(
    enterpriseQueueService.QUEUE_NAMES.aiJobs,
    {
      chatId: '528431972395@lid',
      messageId: 'ACDE234422736EB6BE39DAA297BE8810',
      sessionId: 'material'
    }
  );
  console.log("Job enqueued!");
}

testAI();
