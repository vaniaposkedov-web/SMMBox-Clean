const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/security');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Нет токена авторизации' });
        }

        const token = authHeader.split(' ')[1];

        if (!token || token === 'null' || token === 'undefined') {
            return res.status(401).json({ error: 'Пустой токен' });
        }

        const decoded = jwt.verify(token, getJwtSecret());

        req.user = decoded;
        req.userId = String(decoded.id || decoded.userId);

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Неверный или просроченный токен' });
    }
};
