const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log("❌ [Auth] Блокировка: Нет заголовка Authorization");
            return res.status(401).json({ error: 'Нет токена авторизации' });
        }

        const token = authHeader.split(' ')[1];
        
        if (!token || token === 'null' || token === 'undefined') {
            console.log("❌ [Auth] Блокировка: Токен пустой (null)");
            return res.status(401).json({ error: 'Пустой токен' });
        }

        // Расшифровываем токен. Ключ должен совпадать с тем, что в логине!
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret'); 
        
        // Гарантированно сохраняем ID для следующих функций
        req.user = decoded;
        req.userId = decoded.id || decoded.userId;
        
        next(); // Пускаем дальше!
    } catch (error) {
        console.error("❌ [Auth] Блокировка: Ошибка проверки токена:", error.message);
        return res.status(401).json({ error: 'Неверный или просроченный токен' });
    }
};