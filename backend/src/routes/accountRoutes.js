const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');

router.get('/', accountController.getAccounts);
router.post('/mock-add', accountController.addMockAccount);
router.delete('/:accountId', accountController.deleteAccount);
router.put('/:id/design', accountController.updateDesign);
router.get('/vk/auth', accountController.vkAuth);
router.get('/vk/callback', accountController.vkCallback);

module.exports = router;