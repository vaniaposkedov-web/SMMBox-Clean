// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/vk/url', authController.getVkAuthUrl);
router.get('/vk/callback', authController.vkCallback);

module.exports = router;