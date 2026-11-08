const prisma = require('../utils/prisma');
const cron = require('node-cron');

const PUBLIC_FIELDS = { id: true, name: true, pavilion: true, avatarUrl: true };

exports.getPartnerData = async (req, res) => {
  const userId = req.userId;
  try {
    // Запрос повторяется каждые 15 секунд: четыре чтения идут одновременно, а уведомлений отдаётся не больше 100.
    const [incomingRequests, outgoingRequests, acceptedPartnerships, notifications] = await Promise.all([
      prisma.partnership.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: { requester: { select: PUBLIC_FIELDS } },
      }),
      prisma.partnership.findMany({
        where: { requesterId: userId, status: 'PENDING' },
        include: { receiver: { select: PUBLIC_FIELDS } },
      }),
      prisma.partnership.findMany({
        where: { OR: [{ requesterId: userId }, { receiverId: userId }], status: 'ACCEPTED' },
        include: {
          requester: { select: { ...PUBLIC_FIELDS, phone: true } },
          receiver: { select: { ...PUBLIC_FIELDS, phone: true } },
        },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const partners = acceptedPartnerships.map((p) => (p.requesterId === userId ? p.receiver : p.requester));

    res.json({ incomingRequests, outgoingRequests, partners, notifications });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки данных' });
  }
};

exports.searchPartners = async (req, res) => {
  const { query } = req.query;
  const userId = req.userId;
  try {
    if (!query) return res.json([]);

    const filteredUsers = await prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { pavilion: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: PUBLIC_FIELDS,
      take: 20,
    });

    const partnerships = await prisma.partnership.findMany({
      where: {
        OR: [
          { requesterId: userId, receiverId: { in: filteredUsers.map((u) => u.id) } },
          { receiverId: userId, requesterId: { in: filteredUsers.map((u) => u.id) } },
        ],
      },
    });

    const resultsWithStatus = filteredUsers.map((user) => {
      const p = partnerships.find((item) => item.requesterId === user.id || item.receiverId === user.id);
      let status = 'NONE';
      if (p) {
        if (p.status === 'ACCEPTED') status = 'PARTNER';
        else if (p.requesterId === userId) status = 'PENDING';
        else status = 'INCOMING';
      }
      return { ...user, status };
    });

    res.json(resultsWithStatus);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
};

exports.sendRequest = async (req, res) => {
  const { receiverId } = req.body;
  const requesterId = req.userId;
  try {
    if (!receiverId || String(receiverId) === requesterId) {
      return res.status(400).json({ error: 'Нельзя отправить заявку этому пользователю' });
    }
    const existing = await prisma.partnership.findFirst({
      where: { OR: [{ requesterId, receiverId: String(receiverId) }, { requesterId: String(receiverId), receiverId: requesterId }] },
    });
    if (existing) return res.status(400).json({ error: 'Заявка уже отправлена' });

    const partnership = await prisma.partnership.create({
      data: { requesterId, receiverId: String(receiverId), status: 'PENDING' },
    });
    res.json(partnership);
  } catch (error) {
    res.status(400).json({ error: 'Не удалось отправить заявку' });
  }
};

exports.acceptRequest = async (req, res) => {
  const { partnershipId } = req.body;
  try {
    const request = await prisma.partnership.findFirst({
      where: { id: partnershipId, receiverId: req.userId, status: 'PENDING' },
    });
    if (!request) return res.status(404).json({ error: 'Заявка не найдена' });

    const updated = await prisma.partnership.update({
      where: { id: request.id },
      data: { status: 'ACCEPTED' },
      include: { receiver: { select: PUBLIC_FIELDS } },
    });

    await prisma.notification.create({
      data: {
        userId: updated.requesterId,
        type: 'SUCCESS',
        text: `Пользователь ${updated.receiver.name || 'Без имени'} (Павильон: ${updated.receiver.pavilion || '?'}) принял вашу заявку! Теперь вы партнеры.`,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при принятии заявки' });
  }
};

exports.declineRequest = async (req, res) => {
  const { partnershipId } = req.body;
  try {
    const p = await prisma.partnership.findFirst({
      where: { id: partnershipId, OR: [{ requesterId: req.userId }, { receiverId: req.userId }] },
      include: { receiver: { select: PUBLIC_FIELDS } },
    });
    if (!p) return res.status(404).json({ error: 'Заявка не найдена' });

    if (p.status === 'PENDING' && p.receiverId === req.userId) {
      await prisma.notification.create({
        data: {
          userId: p.requesterId,
          type: 'WARNING',
          text: `Пользователь ${p.receiver.name || 'Без имени'} отклонил вашу заявку в партнеры.`,
        },
      });
    }
    await prisma.partnership.delete({ where: { id: p.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка отмены' });
  }
};

exports.removePartner = async (req, res) => {
  const { partnerId } = req.body;
  const currentUserId = req.userId;
  try {
    const { count } = await prisma.partnership.deleteMany({
      where: {
        OR: [
          { requesterId: currentUserId, receiverId: partnerId },
          { requesterId: partnerId, receiverId: currentUserId },
        ],
      },
    });
    if (count === 0) return res.status(404).json({ error: 'Партнёр не найден' });

    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId }, select: { name: true } });
    await prisma.notification.create({
      data: {
        userId: partnerId,
        type: 'ERROR',
        text: `Пользователь ${currentUser?.name || 'Без имени'} прекратил с вами сотрудничество.`,
      },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при удалении' });
  }
};

exports.clearNotifications = async (req, res) => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.userId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка очистки' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { id: req.body.id, userId: req.userId }, data: { isRead: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка' });
  }
};

// Раз в сутки: заявки без ответа и посты, которые партнёр не использовал за неделю.
exports.cleanupExpiredPartnerItems = async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const expiredRequests = await prisma.partnership.findMany({
        where: { status: 'PENDING', createdAt: { lt: sevenDaysAgo } },
        include: { requester: { select: PUBLIC_FIELDS }, receiver: { select: PUBLIC_FIELDS } },
      });

      for (const item of expiredRequests) {
        await prisma.notification.create({
          data: {
            userId: item.receiverId,
            type: 'WARNING',
            text: `Заявка в партнеры от ${item.requester.name || 'Пользователя'} была автоматически отменена (истек срок 7 дней).`,
          },
        });
        await prisma.notification.create({
          data: {
            userId: item.requesterId,
            type: 'WARNING',
            text: `Пользователь ${item.receiver.name || 'Без имени'} не принял вашу заявку в течение недели. Заявка аннулирована.`,
          },
        });
        await prisma.partnership.delete({ where: { id: item.id } });
      }

      const ignoredPosts = await prisma.sharedPost.findMany({
        // Пост, который партнёр уже отправляет или запланировал, не считается забытым.
        where: { isPublished: false, createdAt: { lt: sevenDaysAgo }, posts: { none: { status: { in: ['PROCESSING', 'SCHEDULED'] } } } },
        include: { receiver: { select: PUBLIC_FIELDS } },
      });

      for (const post of ignoredPosts) {
        await prisma.notification.create({
          data: {
            userId: post.senderId,
            type: 'WARNING',
            text: `Партнер ${post.receiver.name || 'Без имени'} так и не опубликовал отправленный вами пост в течение недели.`,
            metadata: JSON.stringify({ text: post.text, mediaUrls: post.mediaUrls }),
          },
        });
        await prisma.sharedPost.delete({ where: { id: post.id } });
      }
};

exports.initPartnerCron = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      await exports.cleanupExpiredPartnerItems();
    } catch (error) {
      console.error('Ошибка в Partner CRON:', error.message);
    }
  });
};
