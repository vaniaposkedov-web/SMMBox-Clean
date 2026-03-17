const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login', adminController.adminLogin);

// Защищенные роуты (только для ADMIN)
router.get('/dashboard', adminAuth, adminController.getDashboardData);
router.get('/users', adminAuth, adminController.getAllUsers);
router.get('/users/:id', adminAuth, adminController.getUserDetails); 

// === НОВЫЕ РОУТЫ: Финансы, PRO и Нейросеть ===
router.post('/users/:id/grant-pro', adminAuth, adminController.grantProStatus);
router.get('/settings/ai', adminAuth, adminController.getAiSettings);
router.post('/settings/ai', adminAuth, adminController.updateAiSettings);

module.exports = router;