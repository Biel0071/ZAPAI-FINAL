module.exports = {
  config: require('../../../../infrastructure/config/database'),
  repositories: {
    contact: require('../../../../data/repositories/contactRepository'),
    conversation: require('../../../../data/repositories/conversationRepository'),
    message: require('../../../../data/repositories/messageRepository'),
    session: require('../../../../data/repositories/sessionRepository'),
    systemSettings: require('../../../../data/repositories/systemSettingsRepository'),
  },
};
