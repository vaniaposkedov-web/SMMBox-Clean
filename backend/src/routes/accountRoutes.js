const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middleware/auth');

router.post('/telegram/webhook', accountController.telegramWebhook);

router.get('/profiles', authMiddleware, accountController.getProfiles);
router.delete('/profiles/:id', authMiddleware, accountController.deleteSocialProfile);

router.get('/', authMiddleware, accountController.getAccounts);
router.get('/global/settings', authMiddleware, accountController.getGlobalSettings);
router.put('/global/settings', authMiddleware, accountController.saveGlobalSettings);

router.post('/tg/save', authMiddleware, accountController.saveTgAccounts);
router.post('/tg/verify-status', authMiddleware, accountController.verifyTgAccountsStatus);

router.post('/vk/verify-status', authMiddleware, accountController.verifyVkAccountsStatus);
router.post('/vk/komod-sync', authMiddleware, accountController.syncVkKomod);
router.post('/vk/komod-confirm', authMiddleware, accountController.confirmVkKomod);
router.post('/vk/komod-add', authMiddleware, accountController.addVkKomodGroup);
router.post('/vk/komod-add-profile', authMiddleware, accountController.addVkKomodProfile);
router.get('/vk/komod-groups', authMiddleware, accountController.getKomodGroupsForSelection);

router.delete('/:id', authMiddleware, accountController.deleteAccount);
router.put('/:id/design', authMiddleware, accountController.saveAccountDesign);

module.exports = router;