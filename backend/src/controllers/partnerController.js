const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Получить все данные (Партнеры, Заявки, Уведомления)
exports.getPartnerData = async (req, res) => {
  const { userId } = req.query;
  try {
    // Входящие заявки
    const incomingRequests = await prisma.partnership.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: { requester: { select: { id: true, name: true, pavilion: true, avatarUrl: true } } }
    });

    // Исходящие заявки (чтобы понимать, кому мы уже отправили)
    const outgoingRequests = await prisma.partnership.findMany({
      where: { requesterId: userId, status: 'PENDING' }
    });

    // Подтвержденные партнеры
    const acceptedPartnerships = await prisma.partnership.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        status: 'ACCEPTED'
      },
      include: {
        requester: { select: { id: true, name: true, pavilion: true, phone: true } },
        receiver: { select: { id: true, name: true, pavilion: true, phone: true } }
      }
    });

    // Извлекаем людей
    const partners = acceptedPartnerships.map(p => 
      p.requesterId === userId ? p.receiver : p.requester
    );

    // Уведомления (о разрыве партнерства и т.д.)
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ incomingRequests, outgoingRequests, partners, notifications });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки данных' });
  }
};

// 2. МУЛЬТИ-ПОИСК (Имя, ID, Павильон, Телефон)
exports.searchPartners = async (req, res) => {
  const { query, userId } = req.query;
  
  try {
    if (!query) return res.json([]);
    const lowerQuery = query.toLowerCase().trim();

    // Запрашиваем всех пользователей и фильтруем мощным JS (чтобы 100% находило UUID и русский текст)
    const allUsers = await prisma.user.findMany({
      where: { id: { not: userId } },
      select: { id: true, name: true, pavilion: true, phone: true }
    });

    const filteredUsers = allUsers.filter(u => {
      const matchId = u.id && u.id.toLowerCase().includes(lowerQuery);
      const matchName = u.name && u.name.toLowerCase().includes(lowerQuery);
      const matchPavilion = u.pavilion && u.pavilion.toLowerCase().includes(lowerQuery);
      const matchPhone = u.phone && u.phone.toLowerCase().includes(lowerQuery);
      
      return matchId || matchName || matchPavilion || matchPhone;
    });

    // Отдаем первые 20 результатов, чтобы не перегружать мобильный интерфейс
    res.json(filteredUsers.slice(0, 20));
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

// 4.1 Отклонить/Отозвать заявку
exports.declineRequest = async (req, res) => {
  const { partnershipId } = req.body;
  try {
    await prisma.partnership.delete({ where: { id: partnershipId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка отмены' });
  }
};

// 5. Прекратить сотрудничество (Создает уведомление)
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

    // Создаем уведомление для удаленного партнера
    await prisma.notification.create({
      data: {
        userId: partnerId,
        text: `Пользователь ${currentUser.name || 'Без имени'} (Павильон: ${currentUser.pavilion || 'Не указан'}) прекратил с вами сотрудничество.`
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