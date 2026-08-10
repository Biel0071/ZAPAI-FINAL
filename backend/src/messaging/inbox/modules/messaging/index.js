module.exports = {
  controller: require('../../../../api/controllers/messagesController'),
  services: {
    message: require('../../../../../services/messageService'),
    messaging: require('../../../../../services/messagingService'),
    whatsapp: require('../../../../../services/whatsappService'),
  },
  repositories: {
    message: require('../../../../data/repositories/messageRepository'),
    conversation: require('../../../../data/repositories/conversationRepository'),
  },
};
