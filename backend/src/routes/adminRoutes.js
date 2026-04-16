const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login', adminController.adminLogin);

// Защищенные роуты (Только для ADMIN)
router.get('/dashboard', adminAuth, adminController.getDashboardData);
router.get('/users', adminAuth, adminController.getAllUsers);
router.get('/users/:id', adminAuth, adminController.getUserDetails); 
router.put('/users/:id', adminAuth, adminController.updateUserAdmin);

// === РОУТЫ ТАРИФОВ И ПОДПИСОК (НОВОЕ) ===
router.get('/plans', adminAuth, adminController.getPlans);
router.post('/plans', adminAuth, adminController.createPlan);
router.put('/plans/:id', adminAuth, adminController.updatePlan);

// Выдача подписки и фиксация финансов
router.post('/users/:id/grant-pro', adminAuth, adminController.grantProStatus);

// === РОУТЫ НАСТРОЕК НЕЙРОСЕТИ ===
router.get('/settings/ai', adminAuth, adminController.getAiSettings);
router.post('/settings/ai', adminAuth, adminController.updateAiSettings);

module.exports = router;