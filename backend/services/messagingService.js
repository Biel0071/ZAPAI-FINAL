const messageService = require('./messageService');
const whatsappService = require('./whatsappService');

function createMessagingService() {
  return {
    messageService,
    whatsappService,
  };
}

module.exports = {
  createMessagingService,
};
