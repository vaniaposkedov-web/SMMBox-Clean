const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Наши новые реальные роуты
router.post('/register', authController.register);
router.post('/login', authController.login);

// Старые роуты ВК
router.get('/vk/url', authController.vkUrl);
router.get('/vk/callback', authController.vkCallback);

module.exports = router;