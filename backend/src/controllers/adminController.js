const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

// Секретный вход только для админов
exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user || user.role !== 'ADMIN') {
            return res.status(401).json({ error: 'Неверные учетные данные' }); // Не выдаем, что админа нет
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({ success: true, token, user });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

// Сбор глобальной статистики проекта
exports.getDashboardData = async (req, res) => {
    try {
        const totalUsers = await prisma.user.count();
        const proUsers = await prisma.user.count({ where: { isPro: true } });
        const totalAccounts = await prisma.account.count();
        const totalPosts = await prisma.post.count();
        
        // Последние 10 регистраций
        const recentUsers = await prisma.user.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, phone: true, isPro: true, createdAt: true }
        });

        res.json({
            success: true,
            stats: { totalUsers, proUsers, totalAccounts, totalPosts },
            recentUsers
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки данных' });
    }
};