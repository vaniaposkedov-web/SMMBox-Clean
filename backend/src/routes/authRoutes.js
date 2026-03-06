const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middleware/upload'); // Подключаем мидлвар
const authMiddleware = require('../middleware/auth');
const { protect } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/verify-email', authController.verifyEmail);
router.post('/login', authController.login);

// --- НОВЫЕ МАРШРУТЫ ДЛЯ СОЦСЕТЕЙ ---
router.post('/telegram', authController.telegramAuth);
router.post('/vk', authController.vkAuth);
router.post('/link-email', authController.linkEmailAndSendCode);
// ------------------------------------
router.post('/complete-onboarding', authMiddleware, authController.completeOnboarding);
router.post('/tg-chat-info', authController.getTgChatInfo); // <--- ДОБАВИТЬ ЭТО

router.post('/request-link-email', authController.requestLinkEmail);
router.post('/verify-link-email', authController.verifyLinkEmail);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// Используем upload.single('avatar') чтобы multer ловил файл с именем avatar
router.put('/profile', authMiddleware, upload.single('avatar'), authController.updateProfile);

module.exports = router;