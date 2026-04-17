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
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfDay = new Date(now.setHours(0,0,0,0));

        const [totalRev, monthRev, dayRev] = await Promise.all([
            prisma.transaction.aggregate({ _sum: { amount: true } }),
            prisma.transaction.aggregate({ where: { createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
            prisma.transaction.aggregate({ where: { createdAt: { gte: startOfDay } }, _sum: { amount: true } })
        ]);

        const chartDataRaw = await prisma.$queryRaw`
            SELECT 
                TO_CHAR("createdAt", 'Mon') as month,
                SUM(amount) as total
            FROM "Transaction"
            WHERE "createdAt" > NOW() - INTERVAL '6 months'
            GROUP BY month, DATE_TRUNC('month', "createdAt")
            ORDER BY DATE_TRUNC('month', "createdAt") ASC
        `;

        const formattedChartData = chartDataRaw.map(item => ({
            month: item.month,
            total: Number(item.total || 0)
        }));

        const recentUsers = await prisma.user.findMany({
            take: 10, orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, phone: true, isPro: true, proExpiresAt: true, role: true, createdAt: true }
        });

        const recentTransactions = await prisma.transaction.findMany({
            take: 20, orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, email: true, name: true } } }
        });

        res.json({ 
            success: true, 
            stats: { 
                totalUsers, proUsers, totalAccounts, totalPosts, 
                revenue: {
                    total: totalRev._sum.amount || 0,
                    month: monthRev._sum.amount || 0,
                    today: dayRev._sum.amount || 0,
                    chart: formattedChartData
                }
            }, 
            recentUsers,
            recentTransactions
        });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ error: 'Ошибка загрузки данных дашборда' }); 
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, email: true, phone: true, isPro: true, proExpiresAt: true, proPlanType: true, role: true, createdAt: true }
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
                transactions: { orderBy: { createdAt: 'desc' }, take: 15 },
                globalWatermark: true
            }
        });
        
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        
        // Достаем историю последних постов
        const recentPosts = await prisma.post.findMany({
            where: { account: { userId: req.params.id } },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, text: true, status: true, createdAt: true, account: { select: { name: true, provider: true } } }
        });

        const postsCount = await prisma.post.count({ where: { account: { userId: req.params.id } } });
        const { password, ...safeUser } = user;

        res.json({ success: true, user: safeUser, postsCount, recentPosts });
    } catch (error) { 
        console.error('Ошибка в getUserDetails:', error);
        res.status(500).json({ error: 'Ошибка сервера при загрузке досье' }); 
    }
};

exports.updateUserAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { pavilion } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { pavilion }
        });
        res.json({ success: true, user: updatedUser });
    } catch (error) { res.status(500).json({ error: 'Ошибка обновления пользователя' }); }
};

exports.getPlans = async (req, res) => {
    try {
        const plans = await prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
        res.json({ success: true, plans });
    } catch (error) { res.status(500).json({ error: 'Ошибка загрузки тарифов' }); }
};

exports.createPlan = async (req, res) => {
    try {
        const { name, maxAccounts, maxPostsPerDay, price } = req.body;
        const plan = await prisma.subscriptionPlan.create({
            data: { name, maxAccounts: Number(maxAccounts), maxPostsPerDay: Number(maxPostsPerDay), price: Number(price) }
        });
        res.json({ success: true, plan });
    } catch (error) { res.status(500).json({ error: 'Ошибка создания тарифа' }); }
};

exports.updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, maxAccounts, maxPostsPerDay, price } = req.body;
        const plan = await prisma.subscriptionPlan.update({
            where: { id },
            data: { name, maxAccounts: Number(maxAccounts), maxPostsPerDay: Number(maxPostsPerDay), price: Number(price) }
        });
        res.json({ success: true, plan });
    } catch (error) { res.status(500).json({ error: 'Ошибка обновления тарифа' }); }
};

exports.grantProStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { planId, planType: reqPlanType, months, days, customAmount } = req.body; 

        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser) return res.status(404).json({ error: 'Пользователь не найден' });

        const isRevoke = Number(months) === 0 && Number(days) === 0 && !customAmount;

        if (isRevoke) {
            await prisma.user.update({ 
                where: { id }, 
                data: { isPro: false, proExpiresAt: null, planId: null, proPlanType: 'FREE' } 
            });
            return res.json({ success: true, isPro: false });
        }

        let finalAmount = Number(customAmount) || 0;
        let planType = reqPlanType || targetUser.proPlanType || 'PRO'; 
        let planPrice = 0;

        if (planId) {
            const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
            if (plan) {
                planType = plan.name;
                planPrice = plan.price;
            }
        }

        // ЗАЩИТА: Распределяем русские названия для фронта и англ. типы для базы данных
        let txType = 'SUB_PRO';
        if (planType.toLowerCase().includes('базов') || planType === 'BASIC') {
            planPrice = 1000;
            txType = 'SUB_BASIC';
            planType = 'Базовый';
        }
        else if (planType.toLowerCase().includes('расширен') || planType === 'PRO') {
            planPrice = 1800;
            txType = 'SUB_PRO';
            planType = 'Расширенный';
        }

        if (!customAmount && customAmount !== 0) {
            const calculatedAmount = (planPrice * Number(months || 0)) + Math.floor((planPrice / 30) * Number(days || 0)); 
            finalAmount = calculatedAmount > 0 ? calculatedAmount : 0;
        }

        let baseDate = new Date();
        if (targetUser.isPro && targetUser.proExpiresAt && new Date(targetUser.proExpiresAt) > baseDate) {
            baseDate = new Date(targetUser.proExpiresAt);
        }

        const expiresAt = new Date(baseDate);
        if (months) expiresAt.setMonth(expiresAt.getMonth() + Number(months));
        if (days) expiresAt.setDate(expiresAt.getDate() + Number(days));

        if (expiresAt <= new Date()) {
             await prisma.user.update({ 
                where: { id }, 
                data: { isPro: false, proExpiresAt: null, planId: null, proPlanType: 'FREE' } 
            });
            return res.json({ success: true, isPro: false });
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { 
                isPro: true, 
                proExpiresAt: expiresAt,
                planId: planId || targetUser.planId,
                proPlanType: planType
            }
        });

        if (finalAmount > 0) {
            await prisma.transaction.create({
                // ИСПОЛЬЗУЕМ БЕЗОПАСНЫЙ txType ВМЕСТО toUpperCase()
                data: { userId: id, amount: finalAmount, type: txType }
            });
        }

        res.json({ success: true, isPro: true, proExpiresAt: expiresAt });
    } catch (error) { 
        console.error("GRANT PRO ERROR:", error);
        res.status(500).json({ error: 'Ошибка при выдаче PRO: ' + error.message }); 
    }
};

exports.getAiSettings = async (req, res) => {
    try {
        let settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: { id: 'global', aiPrompt: "Ты — профессиональный SMM-копирайтер..." }
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

exports.getAiLogs = async (req, res) => {
    try {
        const { page = 1, search = '' } = req.query;
        const take = 20;
        const skip = (Number(page) - 1) * take;

        // Если есть поиск, ищем по ID пользователя
        const where = search ? { userId: { contains: search, mode: 'insensitive' } } : {};

        const logs = await prisma.aiLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            include: { user: { select: { email: true } } }
        });

        const total = await prisma.aiLog.count({ where });

        res.json({ success: true, logs, hasMore: skip + take < total });
    } catch (error) { 
        console.error("AI LOGS ERROR:", error);
        res.status(500).json({ error: 'Ошибка загрузки логов ИИ' }); 
    }
};