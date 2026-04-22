module.exports = {
  controller: require('../../../controllers/automationController'),
  services: {
    automation: require('../../../services/automationService'),
    microtaskRunner: require('../../../services/microtaskRunner'),
  },
  tasks: {
    createConversation: require('../../../microtasks/createConversation'),
    createLead: require('../../../microtasks/createLead'),
    saveMessage: require('../../../microtasks/saveMessage'),
    updateConversation: require('../../../microtasks/updateConversation'),
  },
};
