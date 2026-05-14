const express = require('express');
const router = express.Router();
const contactsController = require('../controllers/contactsController');

// GET /api/contacts — list all contacts
router.get('/contacts', contactsController.listContacts);

// POST /api/contacts — create contact
router.post('/contacts', contactsController.createContact);

// PATCH /api/contacts/:id — update contact
router.patch('/contacts/:id', contactsController.updateContact);

// DELETE /api/contacts/:id — delete contact
router.delete('/contacts/:id', contactsController.deleteContact);

// POST /api/contacts/import — bulk import
router.post('/contacts/import', contactsController.importContacts);

// GET /api/contacts/export — export contacts
router.get('/contacts/export', contactsController.exportContacts);

module.exports = router;
