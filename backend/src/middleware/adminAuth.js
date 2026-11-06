const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

module.exports = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Жесткая проверка в БД
        const user = await prisma.user.findUnique({ where: { id: decoded.id || decoded.userId } });
        
        if (!user || user.role !== 'ADMIN' || (decoded.tv ?? 0) !== user.tokenVersion) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Ошибка авторизации' });
    }
};