const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');

// GET /api/v1/products - List products
router.get('/', productsController.findAll);

// GET /api/v1/products/filters - Get available colors and sizes
router.get('/filters', productsController.getFilters);

// GET /api/v1/products/price-range - Get price range
router.get('/price-range', productsController.getPriceRange);

// GET /api/v1/products/:slug - Get product by slug
router.get('/:slug', productsController.findBySlug);

module.exports = router;

