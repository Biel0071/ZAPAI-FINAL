const { evaluateInboundAi } = require('./services/enterprise/ai-service');

async function test() {
  const customerMessage = "Olá! Posso ter mais informações sobre isso? (Anúncio: Deposito de Material VA - 🔥 TRANSFORME SUA ÁREA GOURMET COM ECONOMIA!)";
  console.log("Evaluating message:", customerMessage);
  
  const result = await evaluateInboundAi({
    chatId: "528431972395@lid",
    customerMessage,
    conversationHistory: [],
    forceAutoReply: false
  });
  
  console.log("Result:", result);
}

test().catch(console.error);
