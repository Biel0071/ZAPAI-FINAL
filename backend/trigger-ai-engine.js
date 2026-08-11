require('dotenv').config();
const enterpriseAiService = require('./services/enterprise/ai-service');
const aiAgentService = require('./src/ai/agents/services/aiAgentService');

async function test() {
  console.log("Loading agent...");
  await aiAgentService.listAgents('default').catch(() => {});
  const { getAgentByName } = require('./src/infrastructure/config/agents');
  
  let agent = getAgentByName(null, 'default');
  if (!agent) {
    const { pickRandomAgent } = require('./src/infrastructure/config/agents');
    agent = pickRandomAgent('default');
  }
  
  console.log("Agent:", agent?.name);
  
  console.log("Running evaluateInboundAi...");
  
  try {
    const aiResult = await enterpriseAiService.evaluateInboundAi({
      agent,
      chatId: '528431972395@lid',
      conversationHistory: [],
      customerMessage: 'Olá! Posso ter mais informações sobre isso? (Anúncio: Deposito de Material VA - ...)',
      store: {
        activePrompt: null,
        contact: { name: 'Lead Lid Test', phone: '528431972395' },
        isGroup: false,
        conversationSummary: null,
      },
      forceAutoReply: true,
      conversationId: 2518,
      conversation: { id: 2518, aiEnabled: true, ai_enabled: true },
      sessionId: 'material',
    });
    
    console.log("AI Result:", JSON.stringify(aiResult, null, 2));
  } catch (err) {
    console.error("AI Error:", err);
  }
}

test();
