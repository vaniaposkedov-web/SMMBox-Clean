const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cron = require('node-cron');

// 1. Получить все данные (Партнеры, Заявки, Уведомления)
exports.getPartnerData = async (req, res) => {
  const { userId } = req.query;
  try {
    const incomingRequests = await prisma.partnership.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: { requester: { select: { id: true, name: true, pavilion: true, avatarUrl: true } } }
    });

    // ИСПРАВЛЕНИЕ 1: Добавили "include: { receiver: ... }" чтобы аватарки отображались в исходящих
    const outgoingRequests = await prisma.partnership.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      include: { receiver: { select: { id: true, name: true, pavilion: true, avatarUrl: true } } }
    });

    const acceptedPartnerships = await prisma.partnership.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        status: 'ACCEPTED'
      },
      include: {
        requester: { select: { id: true, name: true, pavilion: true, phone: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, pavilion: true, phone: true, avatarUrl: true } }
      }
    });

    const partners = acceptedPartnerships.map(p => 
      p.requesterId === userId ? p.receiver : p.requester
    );

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ incomingRequests, outgoingRequests, partners, notifications });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки данных' });
  }
};

// 2. УМНЫЙ МУЛЬТИ-ПОИСК С ОПРЕДЕЛЕНИЕМ СТАТУСОВ
exports.searchPartners = async (req, res) => {
  const { query, userId } = req.query;
  try {
    if (!query) return res.json([]);
    
    // Ищем юзеров мощным запросом через Prisma (без учета регистра)
    const filteredUsers = await prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { pavilion: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, pavilion: true, phone: true, avatarUrl: true },
      take: 20
    });

    // Находим все возможные связи между текущим юзером и найденными людьми
    const partnerships = await prisma.partnership.findMany({
      where: {
        OR: [
          { requesterId: userId, receiverId: { in: filteredUsers.map(u => u.id) } },
          { receiverId: userId, requesterId: { in: filteredUsers.map(u => u.id) } }
        ]
      }
    });

    // ИСПРАВЛЕНИЕ 2: Присваиваем статусы, чтобы фронтенд знал, какие кнопки показывать
    const resultsWithStatus = filteredUsers.map(user => {
      const p = partnerships.find(p => p.requesterId === user.id || p.receiverId === user.id);
      let status = 'NONE';
      if (p) {
        if (p.status === 'ACCEPTED') status = 'PARTNER'; // Уже партнер
        else if (p.requesterId === userId) status = 'PENDING'; // Заявка уже отправлена нами
        else status = 'INCOMING'; // Нам прислали заявку
      }
      return { ...user, status };
    });

    res.json(resultsWithStatus);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
};

// 3. Отправить заявку
exports.sendRequest = async (req, res) => {
  const { requesterId, receiverId } = req.body;
  try {
    const partnership = await prisma.partnership.create({
      data: { requesterId, receiverId, status: 'PENDING' }
    });
    res.json(partnership);
  } catch (error) {
    res.status(400).json({ error: 'Заявка уже отправлена' });
  }
};

// 4. Принять заявку (ОБНОВЛЕНО: ТЕПЕРЬ СОЗДАЕТ УВЕДОМЛЕНИЕ)
exports.acceptRequest = async (req, res) => {
  const { partnershipId } = req.body;
  try {
    const updated = await prisma.partnership.update({
      where: { id: partnershipId },
      data: { status: 'ACCEPTED' },
      include: { requester: true, receiver: true }
    });

    await prisma.notification.create({
      data: {
        userId: updated.requesterId,
        type: 'SUCCESS',
        text: `Пользователь ${updated.receiver.name || 'Без имени'} (Павильон: ${updated.receiver.pavilion || '?'}) принял вашу заявку! Теперь вы партнеры.`
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при принятии заявки' });
  }
};

// 4.1 Отклонить/Отозвать заявку
exports.declineRequest = async (req, res) => {
  const { partnershipId } = req.body;
  try {
    const p = await prisma.partnership.findUnique({ where: { id: partnershipId }, include: { requester: true, receiver: true } });
    if (p && p.status === 'PENDING') {
      // Если заявку отклоняет получатель — уведомляем отправителя
      await prisma.notification.create({
        data: {
          userId: p.requesterId,
          type: 'WARNING',
          text: `Пользователь ${p.receiver.name || 'Без имени'} отклонил вашу заявку в партнеры.`
        }
      });
    }
    await prisma.partnership.delete({ where: { id: partnershipId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка отмены' });
  }
};

exports.removePartner = async (req, res) => {
  const { currentUserId, partnerId } = req.body;
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });

    await prisma.partnership.deleteMany({
      where: {
        OR: [
          { requesterId: currentUserId, receiverId: partnerId },
          { requesterId: partnerId, receiverId: currentUserId }
        ]
      }
    });

    await prisma.notification.create({
      data: {
        userId: partnerId,
        type: 'ERROR',
        text: `Пользователь ${currentUser.name || 'Без имени'} прекратил с вами сотрудничество.`
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при удалении' });
  }
};

// 6. Очистить уведомления
exports.clearNotifications = async (req, res) => {
  const { userId } = req.body;
  try {
    await prisma.notification.deleteMany({ where: { userId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка очистки' });
  }
};

// === ФОНОВЫЕ ЗАДАЧИ (CRON) ДЛЯ ПАРТНЕРОВ ===
exports.initPartnerCron = () => {
  // Запускается каждый день в 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // 1. Очистка просроченных заявок в партнеры
      const expiredRequests = await prisma.partnership.findMany({
        where: { status: 'PENDING', createdAt: { lt: sevenDaysAgo } },
        include: { requester: true, receiver: true }
      });

      for (const req of expiredRequests) {
        // Уведомляем получателя
        await prisma.notification.create({
          data: {
            userId: req.receiverId,
            type: 'WARNING',
            text: `Заявка в партнеры от ${req.requester.name || 'Пользователя'} была автоматически отменена (истек срок 7 дней).`
          }
        });
        // Уведомляем отправителя
        await prisma.notification.create({
          data: {
            userId: req.requesterId,
            type: 'WARNING',
            text: `Пользователь ${req.receiver.name || 'Без имени'} не принял вашу заявку в течение недели. Заявка аннулирована.`
          }
        });
        await prisma.partnership.delete({ where: { id: req.id } });
      }

      // 2. Проверка неопубликованных партнерских постов
      const ignoredPosts = await prisma.sharedPost.findMany({
        where: { isPublished: false, createdAt: { lt: sevenDaysAgo } },
        include: { sender: true, receiver: true }
      });

      for (const post of ignoredPosts) {
        await prisma.notification.create({
          data: {
            userId: post.senderId,
            type: 'WARNING',
            text: `Партнер ${post.receiver.name || 'Без имени'} так и не опубликовал отправленный вами пост в течение недели.`,
            metadata: JSON.stringify({ text: post.text, mediaUrls: post.mediaUrls })
          }
        });
        // Удаляем пост, чтобы не спамить
        await prisma.sharedPost.delete({ where: { id: post.id } });
      }

    } catch (error) {
      console.error('Ошибка в Partner CRON:', error);
    }
  });
};