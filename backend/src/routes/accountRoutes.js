const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');


router.get('/', accountController.getAccounts);
router.delete('/:accountId', accountController.deleteAccount);

// Раскомментировали роут для тестового добавления Telegram
router.post('/mock-add', accountController.addMockAccount);

// Рабочий роут для ВК (оставляем)
router.post('/vk/add-by-token', accountController.vkAddByToken);

// Этот пока оставляем закомментированным (напишем позже, когда будем делать водяные знаки)
// router.put('/:id/design', accountController.updateDesign);

module.exports = router;