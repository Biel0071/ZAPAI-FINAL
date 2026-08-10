module.exports = {
  controller: require('../../../../api/controllers/contactsController'),
  services: {
    contacts: require('../../../../../services/contactsService'),
    leads: require('../../../../../services/leadsService'),
  },
  repositories: {
    contact: require('../../../../data/repositories/contactRepository'),
  },
};
