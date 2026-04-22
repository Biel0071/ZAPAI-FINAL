const routes = require('../../routes/messages');
const messagesController = require('../../controllers/messagesController');
const messageService = require('../../services/messageService');
const whatsappService = require('../../services/whatsappService');

module.exports = {
  name: 'messaging',
  routes,
  controller: messagesController,
  services: {
    messageService,
    whatsappService,
  },
};
