module.exports = {
  controller: require('../../../controllers/contactsController'),
  services: {
    contacts: require('../../../services/contactsService'),
    leads: require('../../../services/leadsService'),
  },
  repositories: {
    contact: require('../../../repositories/contactRepository'),
  },
};
