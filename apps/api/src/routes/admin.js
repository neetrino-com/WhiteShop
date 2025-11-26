const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard stats
router.get('/stats', adminController.getStats);

// Users management
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);

// Orders management
router.get('/orders', adminController.getOrders);
router.put('/orders/:id', adminController.updateOrder);

// Products management
router.get('/products', adminController.getProducts);
router.get('/products/:id', adminController.getProduct);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.patch('/products/:id/discount', adminController.updateProductDiscount);
router.delete('/products/:id', adminController.deleteProduct);

// Brands and categories for dropdowns
router.get('/brands', adminController.getBrands);
router.get('/categories', adminController.getCategories);
router.get('/attributes', adminController.getAttributes);

// Recent activity
router.get('/activity', adminController.getActivity);

// Dashboard specific endpoints
router.get('/dashboard/recent-orders', adminController.getRecentOrders);
router.get('/dashboard/top-products', adminController.getTopProducts);
router.get('/dashboard/user-activity', adminController.getUserActivity);

// Settings management
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;

