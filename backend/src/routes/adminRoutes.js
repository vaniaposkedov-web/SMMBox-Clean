const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login', adminController.adminLogin);

// Защищенные роуты
router.get('/dashboard', adminAuth, adminController.getDashboardData);
router.get('/users', adminAuth, adminController.getAllUsers);
router.get('/users/:id', adminAuth, adminController.getUserDetails); 

// === НОВЫЕ РОУТЫ ===
router.post('/users/:id/grant-pro', adminAuth, adminController.grantProStatus);
router.put('/users/:id', adminAuth, adminController.updateUserAdmin);

module.exports = router;