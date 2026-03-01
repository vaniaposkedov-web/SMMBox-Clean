const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Поиск поставщиков (исключая себя)
exports.searchPartners = async (req, res) => {
  const { query, userId } = req.query;
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { name: { contains: query } },
          { pavilion: { contains: query } }
        ]
      },
      select: { id: true, name: true, pavilion: true } // Пароли не отдаем!
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка поиска' });
  }
};

// Отправка заявки / Принятие
exports.sendRequest = async (req, res) => {
  const { requesterId, receiverId } = req.body;
  try {
    const partnership = await prisma.partnership.create({
      data: { requesterId, receiverId }
    });
    res.json(partnership);
  } catch (error) {
    res.status(500).json({ error: 'Заявка уже отправлена' });
  }
};

// Прекращение сотрудничества (Удаление + Уведомление)
exports.removePartner = async (req, res) => {
  const { currentUserId, partnerId } = req.body;
  
  try {
    // 1. Находим текущего юзера, чтобы взять его имя и павильон
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });

    // 2. Удаляем связи
    await prisma.partnership.deleteMany({
      where: {
        OR: [
          { requesterId: currentUserId, receiverId: partnerId },
          { requesterId: partnerId, receiverId: currentUserId }
        ]
      }
    });

    // 3. Создаем уведомление для бывшего партнера
    await prisma.notification.create({
      data: {
        userId: partnerId,
        text: `Поставщик ${currentUser.name} (${currentUser.pavilion}) прекратил с вами сотрудничество. Он был удален из вашего списка партнеров.`
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при удалении' });
  }
};