'use strict';

const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');

router.post('/', (req, res) => quoteController.createQuote(req, res));
router.get('/', (req, res) => quoteController.listQuotes(req, res));
router.get('/:id', (req, res) => quoteController.getQuote(req, res));
router.post('/:id/send', (req, res) => quoteController.sendQuote(req, res));
router.post('/:id/accept', (req, res) => quoteController.acceptQuote(req, res));
router.post('/:id/reject', (req, res) => quoteController.rejectQuote(req, res));

module.exports = router;
