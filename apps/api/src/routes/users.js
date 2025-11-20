const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticateToken } = require('../middleware/auth');

// GET /api/v1/users/profile - Get user profile
router.get('/profile', authenticateToken, usersController.getProfile);

// PUT /api/v1/users/profile - Update user profile
router.put('/profile', authenticateToken, usersController.updateProfile);

// PUT /api/v1/users/password - Change password
router.put('/password', authenticateToken, usersController.changePassword);

// GET /api/v1/users/addresses - Get all addresses
router.get('/addresses', authenticateToken, usersController.getAddresses);

// POST /api/v1/users/addresses - Add address
router.post('/addresses', authenticateToken, usersController.addAddress);

// PUT /api/v1/users/addresses/:addressId - Update address
router.put('/addresses/:addressId', authenticateToken, usersController.updateAddress);

// DELETE /api/v1/users/addresses/:addressId - Delete address
router.delete('/addresses/:addressId', authenticateToken, usersController.deleteAddress);

// PATCH /api/v1/users/addresses/:addressId/default - Set default address
router.patch('/addresses/:addressId/default', authenticateToken, usersController.setDefaultAddress);

module.exports = router;

