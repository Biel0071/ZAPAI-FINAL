const express = require('express');
const router = express.Router();
const contactsController = require('../controllers/contactsController');

router.get('/api/contacts', contactsController.listContacts);

module.exports = router;
