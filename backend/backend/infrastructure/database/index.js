module.exports = {
  config: require('../../../config/database'),
  repositories: {
    contact: require('../../../repositories/contactRepository'),
    conversation: require('../../../repositories/conversationRepository'),
    message: require('../../../repositories/messageRepository'),
    session: require('../../../repositories/sessionRepository'),
    systemSettings: require('../../../repositories/systemSettingsRepository'),
  },
};
