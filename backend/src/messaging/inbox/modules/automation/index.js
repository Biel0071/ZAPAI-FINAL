module.exports = {
  controller: require('../../../../api/controllers/automationController'),
  services: {
    automation: require('../../../../../services/automationService'),
    microtaskRunner: require('../../../../../services/microtaskRunner'),
  },
  tasks: {
    createConversation: require('../../../../infrastructure/microtasks/createConversation'),
    createLead: require('../../../../infrastructure/microtasks/createLead'),
    saveMessage: require('../../../../infrastructure/microtasks/saveMessage'),
    updateConversation: require('../../../../infrastructure/microtasks/updateConversation'),
  },
};
