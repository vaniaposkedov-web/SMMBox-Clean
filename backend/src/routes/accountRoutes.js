const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middleware/auth');

// Этот роут вызывает сам ВКонтакте, поэтому здесь не нужна проверка авторизации (JWT)
router.get('/vk/callback', accountController.vkCallback);
router.post('/vk/save', authMiddleware, accountController.saveVkGroups);
router.post('/tg/save', authMiddleware, accountController.saveTgAccounts);
router.post('/tg/verify-status', authMiddleware, accountController.verifyTgAccountsStatus);

router.get('/global/settings', authMiddleware, accountController.getGlobalSettings);
router.put('/global/settings', authMiddleware, accountController.saveGlobalSettings);
router.get('/', accountController.getAccounts);
router.delete('/:id', authMiddleware, accountController.deleteAccount);
router.put('/:id/design', accountController.saveAccountDesign);

module.exports = router;