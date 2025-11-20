const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');

// GET /api/v1/categories/tree - Get category tree
router.get('/tree', categoriesController.getTree);

// GET /api/v1/categories/:slug - Get category by slug
router.get('/:slug', categoriesController.findBySlug);

module.exports = router;

