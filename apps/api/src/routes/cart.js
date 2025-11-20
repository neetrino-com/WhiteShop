const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticateToken } = require('../middleware/auth');

// GET /api/v1/cart - Get cart
router.get('/', authenticateToken, cartController.getCart);

// POST /api/v1/cart/items - Add item to cart
router.post('/items', authenticateToken, cartController.addItem);

// PATCH /api/v1/cart/items/:id - Update cart item
router.patch('/items/:id', authenticateToken, cartController.updateItem);

// DELETE /api/v1/cart/items/:id - Remove item from cart
router.delete('/items/:id', authenticateToken, cartController.removeItem);

module.exports = router;

