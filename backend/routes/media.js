const express = require('express');
const mediaController = require('../controllers/mediaController');

const router = express.Router();

router.post('/media/upload', mediaController.upload);
router.get('/media/:mediaId/metadata', mediaController.getMetadata);
router.get('/media/:mediaId/stream', mediaController.stream);

module.exports = router;
