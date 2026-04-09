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
// Добавь эту строку к остальным маршрутам /vk/
router.get('/vk/managed-groups', authMiddleware, accountController.getVkManagedGroups);
router.get('/vk/group-callback', accountController.vkGroupCallback);
router.get('/vk/fetch-groups-callback', accountController.vkFetchGroupsCallback);
router.post('/vk/save-group-tokens', authMiddleware, accountController.saveVkGroupTokens);
router.post('/telegram/webhook', accountController.telegramWebhook);
// Добавь эти строки к остальным маршрутам /vk/
router.post('/vk/komod-sync', authMiddleware, accountController.syncVkKomod);
router.post('/vk/komod-confirm', authMiddleware, accountController.confirmVkKomod);
router.post('/vk/komod-add', authMiddleware, accountController.addVkKomodGroup);
router.get('/vk/komod-groups', authMiddleware, accountController.getKomodGroupsForSelection);
router.post('/vk/komod-add', authMiddleware, accountController.addVkKomodGroup);
// Добавь эту строчку:
router.post('/vk/komod-add-profile', authMiddleware, accountController.addVkKomodProfile);


module.exports = router;