const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login', adminController.adminLogin);

// Защищенные роуты (только для ADMIN)
router.get('/dashboard', adminAuth, adminController.getDashboardData);
router.get('/users', adminAuth, adminController.getAllUsers);
router.post('/users/:id/toggle-pro', adminAuth, adminController.toggleProStatus);

module.exports = router;