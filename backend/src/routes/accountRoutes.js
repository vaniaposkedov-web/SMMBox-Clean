const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middleware/auth');

// === МАРШРУТЫ ПРОФИЛЕЙ (НОВОЕ) ===
router.post('/profiles/link', authMiddleware, accountController.linkSocialProfile);
router.get('/profiles', accountController.getProfiles);
router.delete('/profiles/:id', authMiddleware, accountController.deleteSocialProfile);

// === МАРШРУТЫ ГРУПП И КАНАЛОВ ===
router.get('/', accountController.getAccounts);
router.delete('/:id', authMiddleware, accountController.deleteAccount);
router.post('/tg/save', authMiddleware, accountController.saveTgAccounts);
router.post('/tg/verify-status', authMiddleware, accountController.verifyTgAccountsStatus);
router.post('/tg/scan', authMiddleware, accountController.scanTgChannels);
router.post('/vk/save', authMiddleware, accountController.saveVkGroups);
router.post('/vk/save-by-token', authMiddleware, accountController.saveVkGroupWithToken);
router.post('/vk/verify-status', authMiddleware, accountController.verifyVkAccountsStatus);
router.put('/:id/design', authMiddleware, accountController.saveAccountDesign);
router.get('/global/settings', authMiddleware, accountController.getGlobalSettings);
router.put('/global/settings', authMiddleware, accountController.saveGlobalSettings);


module.exports = router;