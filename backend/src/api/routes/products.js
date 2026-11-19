const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const { fastCacheMiddleware } = require('../middleware/fastCache');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.get('/products', fastCacheMiddleware(5000), productsController.getProducts);
router.get('/products/:id', fastCacheMiddleware(5000), productsController.getProductById);
router.post('/products', productsController.createProduct);
router.put('/products/:id', productsController.updateProduct);
router.delete('/products/:id', productsController.deleteProduct);
router.post('/products/upload-image', upload.single('image'), productsController.uploadProductImage);

router.get('/catalog/products', fastCacheMiddleware(5000), productsController.getProducts);
router.get('/catalog/products/:id', fastCacheMiddleware(5000), productsController.getProductById);
router.post('/catalog/products', productsController.createProduct);
router.put('/catalog/products/:id', productsController.updateProduct);
router.delete('/catalog/products/:id', productsController.deleteProduct);
router.post('/catalog/products/upload-image', upload.single('image'), productsController.uploadProductImage);

router.post('/catalog/sync', productsController.syncWhatsAppCatalog);
router.post('/products/sync', productsController.syncWhatsAppCatalog);

module.exports = router;
