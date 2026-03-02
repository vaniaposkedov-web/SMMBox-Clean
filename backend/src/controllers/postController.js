const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Создание нового поста
exports.createPost = async (req, res) => {
  const { text, mediaUrls, accountIds, publishAt } = req.body;

  try {
    if (!accountIds || accountIds.length === 0) {
      return res.status(400).json({ error: 'Выберите хотя бы один аккаунт' });
    }

    // Если время указано - статус SCHEDULED (Отложено), иначе - PUBLISHED (Опубликовано)
    const status = publishAt ? 'SCHEDULED' : 'PUBLISHED'; 
    const targetDate = publishAt ? new Date(publishAt) : new Date();

    // Создаем отдельный пост для КАЖДОГО выбранного аккаунта
    const posts = await Promise.all(accountIds.map(async (accountId) => {
      
      // 1. Достаем аккаунт, чтобы взять его уникальную подпись
      const account = await prisma.account.findUnique({ where: { id: accountId } });
      
      // 2. Склеиваем основной текст товара и уникальную подпись группы
      const finalSignature = account?.signature ? `\n\n${account.signature}` : '';
      const finalText = (text || '') + finalSignature;

      // 3. Сохраняем пост в базу
      return prisma.post.create({
        data: {
          text: finalText,
          mediaUrls: JSON.stringify(mediaUrls || []), // Сохраняем ссылки на фото как строку
          status,
          publishAt: targetDate,
          accountId
        }
      });
    }));

    res.json({ success: true, count: posts.length });
  } catch (error) {
    console.error('Ошибка создания поста:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании поста' });
  }
};