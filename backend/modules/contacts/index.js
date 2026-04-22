const routes = require('../../routes/contacts');
const contactsController = require('../../controllers/contactsController');
const contactRepository = require('../../repositories/contactRepository');

module.exports = {
  name: 'contacts',
  routes,
  controller: contactsController,
  repositories: {
    contactRepository,
  },
};
