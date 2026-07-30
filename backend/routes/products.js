const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const { fastCacheMiddleware } = require('../middleware/fastCache');

router.get('/products', fastCacheMiddleware(5000), productsController.getProducts);
router.get('/products/:id', fastCacheMiddleware(5000), productsController.getProductById);

module.exports = router;
