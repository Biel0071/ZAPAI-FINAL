require('dotenv').config();
const { analyzeLeadIntent } = require('./services/leadAnalyzer');
const { evaluateInboundAi } = require('./services/enterprise/ai-service');

async function test() {
  const customerMessage = "Olá! Posso ter mais informações sobre isso? (Anúncio: Deposito de Material VA - 🔥 TRANSFORME SUA ÁREA GOURMET COM ECONOMIA!)";
  console.log("Evaluating message:", customerMessage);
  
  const lead = analyzeLeadIntent(customerMessage, []);
  console.log("Lead Intent:", lead);
  
  const result = await evaluateInboundAi({
    chatId: "528431972395@lid",
    customerMessage,
    conversationHistory: [],
    forceAutoReply: false
  });
  
  console.log("Evaluate result:", result);
}

test().catch(console.error);
