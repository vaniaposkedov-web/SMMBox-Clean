const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middleware/upload');
const authMiddleware = require('../middleware/auth');

const limiter = (max) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много попыток. Подождите 15 минут и попробуйте снова.' },
});
const loginLimiter = limiter(30);
const codeLimiter = limiter(10);

router.post('/register', loginLimiter, authController.register);
router.post('/verify-email', codeLimiter, authController.verifyEmail);
router.post('/login', loginLimiter, authController.login);

router.post('/telegram', loginLimiter, authController.telegramAuth);
router.post('/vk', loginLimiter, authController.vkAuth);
router.post('/link/telegram', authMiddleware, loginLimiter, authController.linkTelegramLogin);
router.post('/link/vk', authMiddleware, loginLimiter, authController.linkVkLogin);

router.post('/complete-onboarding', authMiddleware, authController.completeOnboarding);
router.post('/tg-chat-info', authMiddleware, authController.getTgChatInfo);

router.post('/request-link-email', authMiddleware, codeLimiter, authController.requestLinkEmail);
router.post('/verify-link-email', authMiddleware, codeLimiter, authController.verifyLinkEmail);

router.post('/forgot-password', codeLimiter, authController.forgotPassword);
router.post('/reset-password/:token', codeLimiter, authController.resetPassword);
router.get('/me', authMiddleware, authController.getMe);

router.put('/profile', authMiddleware, upload.single('avatar'), authController.updateProfile);

module.exports = router;
