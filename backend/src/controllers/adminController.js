const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();


exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user || user.role !== 'ADMIN') {
            return res.status(401).json({ error: 'Неверные учетные данные' }); 
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


exports.getDashboardData = async (req, res) => {
    try {
        const totalUsers = await prisma.user.count();
        const proUsers = await prisma.user.count({ where: { isPro: true } });
        const totalAccounts = await prisma.account.count();
        const totalPosts = await prisma.post.count();
        
        const recentUsers = await prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, phone: true, isPro: true, role: true, createdAt: true }
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

exports.getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, phone: true, isPro: true, role: true, createdAt: true }
        });
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки пользователей' });
    }
};


exports.getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                accounts: {
                    select: { id: true, provider: true, name: true, isValid: true, createdAt: true }
                },
                globalWatermark: true
            }
        });
        
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        
        const postsCount = await prisma.post.count({
            where: { account: { userId: id } }
        });

        
        const { password, ...safeUser } = user;

        res.json({ success: true, user: safeUser, postsCount });
    } catch (error) {
        console.error('Ошибка получения досье:', error);
        res.status(500).json({ error: 'Ошибка сервера при загрузке досье' });
    }
};


exports.toggleProStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await prisma.user.findUnique({ where: { id } });
        
        if (!targetUser) return res.status(404).json({ error: 'Пользователь не найден' });

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { isPro: !targetUser.isPro }
        });

        res.json({ success: true, isPro: updatedUser.isPro });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при изменении статуса' });
    }
};