module.exports = {
  controller: require('../../../controllers/messagesController'),
  services: {
    message: require('../../../services/messageService'),
    messaging: require('../../../services/messagingService'),
    whatsapp: require('../../../services/whatsappService'),
  },
  repositories: {
    message: require('../../../repositories/messageRepository'),
    conversation: require('../../../repositories/conversationRepository'),
  },
};
