const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Получить все данные (Партнеры, Заявки, Уведомления) для конкретного юзера
exports.getPartnerData = async (req, res) => {
  const { userId } = req.query;
  try {
    // Входящие заявки
    const incomingRequests = await prisma.partnership.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: { requester: { select: { id: true, name: true, pavilion: true } } }
    });

    // Подтвержденные партнеры (где юзер либо отправитель, либо получатель)
    const acceptedPartnerships = await prisma.partnership.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        status: 'ACCEPTED'
      },
      include: {
        requester: { select: { id: true, name: true, pavilion: true } },
        receiver: { select: { id: true, name: true, pavilion: true } }
      }
    });

    // Извлекаем самих людей из связей
    const partners = acceptedPartnerships.map(p => 
      p.requesterId === userId ? p.receiver : p.requester
    );

    // Уведомления
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ incomingRequests, partners, notifications });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки данных' });
  }
};

// 2. Поиск новых поставщиков
// 2. Поиск новых поставщиков (с поддержкой русского языка)
exports.searchPartners = async (req, res) => {
  const { query, userId } = req.query;
  
  try {
    if (!query) return res.json([]);

    // Получаем всех пользователей, кроме текущего
    const allUsers = await prisma.user.findMany({
      where: { id: { not: userId } },
      select: { id: true, name: true, pavilion: true }
    });

    // Переводим запрос в нижний регистр для независимого от регистра поиска
    const lowerQuery = query.toLowerCase();

    // Фильтруем через JavaScript (идеально для кириллицы)
    const filteredUsers = allUsers.filter(u => {
      const matchName = u.name && u.name.toLowerCase().includes(lowerQuery);
      const matchPavilion = u.pavilion && u.pavilion.toLowerCase().includes(lowerQuery);
      return matchName || matchPavilion;
    });

    res.json(filteredUsers);
  } catch (error) {
    console.error('Ошибка поиска:', error);
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

// 4. Принять заявку
exports.acceptRequest = async (req, res) => {
  const { partnershipId } = req.body;
  try {
    const updated = await prisma.partnership.update({
      where: { id: partnershipId },
      data: { status: 'ACCEPTED' }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при принятии заявки' });
  }
};

// 5. Прекратить сотрудничество (Удаление + Уведомление)
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
        text: `Поставщик ${currentUser.name} (${currentUser.pavilion}) прекратил с вами сотрудничество.`
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