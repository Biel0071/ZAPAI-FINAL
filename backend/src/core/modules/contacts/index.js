const routes = require('../../../api/routes/contacts');
const contactsController = require('../../../api/controllers/contactsController');
const contactRepository = require('../../../data/repositories/contactRepository');

module.exports = {
  name: 'contacts',
  routes,
  controller: contactsController,
  repositories: {
    contactRepository,
  },
};
