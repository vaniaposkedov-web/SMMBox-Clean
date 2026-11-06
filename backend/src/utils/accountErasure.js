const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');
const { LEGAL_VERSION } = require('./legal');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

const parseUrls = (value) => {
  try {
    const list = JSON.parse(value || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

// Адреса вроде /uploads/posts/a.jpg превращаются в файл на диске. Внешние адреса и выход за пределы папки отбрасываются.
const toUploadedFile = (url) => {
  const match = /^\/(?:api\/)?uploads\/(.+)$/.exec(String(url || ''));
  if (!match) return null;
  const file = path.resolve(UPLOADS_DIR, match[1]);
  return file.startsWith(UPLOADS_DIR + path.sep) ? file : null;
};

const isFileStillUsed = async (file) => {
  const name = path.basename(file);
  const [posts, sharedPosts, avatars] = await Promise.all([
    prisma.post.count({ where: { OR: [{ mediaUrls: { contains: name } }, { originalMediaUrls: { contains: name } }] } }),
    prisma.sharedPost.count({ where: { mediaUrls: { contains: name } } }),
    prisma.user.count({ where: { avatarUrl: { contains: name } } }),
  ]);
  return posts + sharedPosts + avatars > 0;
};

// Удаляет аккаунт и все данные клиента. Остаются только запись об отзыве согласия и суммы оплат без связи с человеком:
// первая подтверждает законность обработки, вторые нужны для учёта.
const eraseUser = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
  const posts = await prisma.post.findMany({ where: { account: { userId } }, select: { mediaUrls: true, originalMediaUrls: true } });
  const sharedPosts = await prisma.sharedPost.findMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] }, select: { mediaUrls: true } });

  const urls = [
    user?.avatarUrl,
    ...posts.flatMap((post) => [...parseUrls(post.mediaUrls), ...parseUrls(post.originalMediaUrls)]),
    ...sharedPosts.flatMap((post) => parseUrls(post.mediaUrls)),
  ];
  const files = [...new Set(urls.map(toUploadedFile).filter(Boolean))];

  await prisma.$transaction(async (tx) => {
    await tx.legalConsent.create({ data: { userId, document: 'PERSONAL_DATA', version: LEGAL_VERSION, action: 'WITHDRAWN' } });
    await tx.user.delete({ where: { id: userId } });
  });

  // Записи в базе уже удалены. Если файл не удалится сейчас, фото постов уберёт ночная очистка.
  for (const file of files) {
    try {
      if (!(await isFileStillUsed(file))) await fs.promises.rm(file, { force: true });
    } catch (error) {
      console.error('Не удалось удалить файл клиента:', error.message);
    }
  }
};

module.exports = { eraseUser };
