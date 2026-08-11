const { unwrapMessageContent, extractMessageText } = require('./services/whatsapp/inbound/parser');

const msg = {
  key: { remoteJid: '123@lid', fromMe: false, id: 'abc' },
  message: {
    extendedTextMessage: {
      text: "Olá! Posso ter mais informações sobre isso? (Anúncio: Deposito de Material VA - ...)",
      contextInfo: {
        isForwarded: false
      }
    }
  }
};

const normalizedMessage = unwrapMessageContent(msg.message || {});
const type = Object.keys(normalizedMessage || {})[0] || 'unknown';
const text = extractMessageText(normalizedMessage);

console.log("unwrapMessageContent:", JSON.stringify(normalizedMessage));
console.log("type:", type);
console.log("extractMessageText:", text);
