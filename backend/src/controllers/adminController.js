const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.role !== 'ADMIN') return res.status(401).json({ error: 'Неверные учетные данные' }); 

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Неверные учетные данные' });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({ success: true, token, user });
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
};

exports.getDashboardData = async (req, res) => {
    try {
        const totalUsers = await prisma.user.count();
        const proUsers = await prisma.user.count({ where: { isPro: true } });
        const totalAccounts = await prisma.account.count();
        const totalPosts = await prisma.post.count();
        
        // --- ПОДРОБНАЯ ФИНАНСОВАЯ АНАЛИТИКА ---
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfDay = new Date(now.setHours(0,0,0,0));

        const [totalRev, monthRev, dayRev] = await Promise.all([
            prisma.transaction.aggregate({ _sum: { amount: true } }),
            prisma.transaction.aggregate({ where: { createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
            prisma.transaction.aggregate({ where: { createdAt: { gte: startOfDay } }, _sum: { amount: true } })
        ]);

        const recentUsers = await prisma.user.findMany({
            take: 5, orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, phone: true, isPro: true, proExpiresAt: true, role: true, createdAt: true }
        });

        // Достаем историю последних платежей
        const recentTransactions = await prisma.transaction.findMany({
            take: 15, orderBy: { createdAt: 'desc' },
            include: { user: { select: { email: true, name: true } } }
        });

        res.json({ 
            success: true, 
            stats: { 
                totalUsers, proUsers, totalAccounts, totalPosts, 
                revenue: {
                    total: totalRev._sum.amount || 0,
                    month: monthRev._sum.amount || 0,
                    today: dayRev._sum.amount || 0
                }
            }, 
            recentUsers,
            recentTransactions
        });
    } catch (error) { res.status(500).json({ error: 'Ошибка загрузки данных' }); }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, phone: true, isPro: true, proExpiresAt: true, role: true, createdAt: true }
        });
        res.json({ success: true, users });
    } catch (error) { res.status(500).json({ error: 'Ошибка загрузки пользователей' }); }
};

exports.getUserDetails = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                accounts: { select: { id: true, provider: true, name: true, isValid: true, createdAt: true } },
                transactions: { orderBy: { createdAt: 'desc' } }, // Подтягиваем историю платежей
                globalWatermark: true
            }
        });
        
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        const postsCount = await prisma.post.count({ where: { account: { userId: req.params.id } } });
        const { password, ...safeUser } = user;

        res.json({ success: true, user: safeUser, postsCount });
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера при загрузке досье' }); }
};

// === ВЫДАЧА PRO И ЗАПИСЬ ТРАНЗАКЦИИ ===
exports.grantProStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { months, amount } = req.body; 

        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser) return res.status(404).json({ error: 'Пользователь не найден' });

        // Если передали 0 месяцев — забираем PRO
        if (Number(months) === 0) {
            await prisma.user.update({ where: { id }, data: { isPro: false, proExpiresAt: null } });
            return res.json({ success: true, isPro: false, message: 'PRO статус отключен' });
        }

        // Вычисляем дату окончания
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + Number(months));

        // Выдаем PRO
        await prisma.user.update({
            where: { id },
            data: { isPro: true, proExpiresAt: expiresAt }
        });

        // Если админ указал сумму (например 2000), записываем в финансы
        if (Number(amount) > 0) {
            await prisma.transaction.create({
                data: { userId: id, amount: Number(amount), type: 'PRO_SUBSCRIPTION' }
            });
        }

        res.json({ success: true, isPro: true, proExpiresAt: expiresAt });
    } catch (error) { res.status(500).json({ error: 'Ошибка при выдаче PRO' }); }
};

// === НАСТРОЙКИ НЕЙРОСЕТИ ===
exports.getAiSettings = async (req, res) => {
    try {
        let settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
        if (!settings) {
            // Создаем стандартный промпт, если его еще нет
            settings = await prisma.systemSettings.create({
                data: { id: 'global', aiPrompt: "Ты — профессиональный SMM-копирайтер для продавцов из торговых центров..." }
            });
        }
        res.json({ success: true, aiPrompt: settings.aiPrompt });
    } catch (error) { res.status(500).json({ error: 'Ошибка загрузки настроек ИИ' }); }
};

exports.updateAiSettings = async (req, res) => {
    try {
        const { aiPrompt } = req.body;
        await prisma.systemSettings.upsert({
            where: { id: 'global' },
            update: { aiPrompt },
            create: { id: 'global', aiPrompt }
        });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Ошибка сохранения настроек ИИ' }); }
};