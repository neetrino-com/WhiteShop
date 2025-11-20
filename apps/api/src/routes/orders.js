const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const { authenticateToken } = require('../middleware/auth');

// POST /api/v1/orders/checkout - Create order
router.post('/checkout', authenticateToken, ordersController.checkout);

// GET /api/v1/orders - Get user orders list
router.get('/', authenticateToken, ordersController.list);

// GET /api/v1/orders/:number - Get order by number
router.get('/:number', authenticateToken, ordersController.findByNumber);

module.exports = router;

