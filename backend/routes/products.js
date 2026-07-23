const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');

router.get('/products', productsController.getProducts);
router.get('/products/:id', productsController.getProductById);

module.exports = router;
