// Файл: backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Браузеры иногда шлют предварительный запрос OPTIONS, пропускаем его
  if (req.method === 'OPTIONS') return next();

  try {
    // Достаем токен из заголовка "Authorization: Bearer <token>"
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Нет доступа. Токен не найден.' });
    }

    // Расшифровываем токен. Если он подделан, выдаст ошибку
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Записываем ID пользователя из токена в сам запрос
    req.user = decoded; 
    
    // Пропускаем дальше к контроллеру
    next();
  } catch (error) {
    res.status(401).json({ error: 'Неверный или просроченный токен авторизации.' });
  }
};