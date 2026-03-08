const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login', adminController.adminLogin);
router.get('/dashboard', adminAuth, adminController.getDashboardData);

module.exports = router;