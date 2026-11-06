const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { getJwtSecret } = require('../utils/security');

module.exports = async (req, res, next) => {
    let decoded;
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Нет токена авторизации' });
        }

        const token = authHeader.split(' ')[1];

        if (!token || token === 'null' || token === 'undefined') {
            return res.status(401).json({ error: 'Пустой токен' });
        }

        decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
        return res.status(401).json({ error: 'Неверный или просроченный токен' });
    }

    const userId = String(decoded.id || decoded.userId);
    try {
        // Вход закрывается, когда соцсеть отвязали или клиент вернулся в аккаунт по ссылке поддержки.
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
        if (!user || (decoded.tv ?? 0) !== user.tokenVersion) {
            return res.status(401).json({ error: 'Этот вход больше не действует. Войдите снова.' });
        }
    } catch (error) {
        // Сбой базы не повод выкидывать человека с сайта: код 401 завершил бы его вход.
        console.error('Не удалось проверить вход:', error.message);
        return res.status(503).json({ error: 'Сервер временно недоступен. Попробуйте ещё раз.' });
    }

    req.user = decoded;
    req.userId = userId;
    next();
};
