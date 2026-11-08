const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');

const AVATARS_DIR = path.resolve(__dirname, '../../uploads/avatars');
const INLINE_JPEG = 'data:image/jpeg;base64,';

// Аватар канала хранится файлом, а не внутри базы: иначе он уходит браузеру вместе с каждым постом этого канала.
// Имя зависит от содержимого, поэтому файл никогда не меняется и браузер может хранить его долго.
const saveAvatarFile = async (buffer) => {
  await fs.promises.mkdir(AVATARS_DIR, { recursive: true });
  const name = `${crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32)}.jpg`;
  await fs.promises.writeFile(path.join(AVATARS_DIR, name), buffer);
  return `/uploads/avatars/${name}`;
};

// Старые записи переводятся в файлы при запуске сервера. Повторный запуск ничего не меняет.
const migrateInlineAvatars = async () => {
  let moved = 0;
  for (const model of [prisma.account, prisma.socialProfile]) {
    const rows = await model.findMany({ where: { avatarUrl: { startsWith: INLINE_JPEG } }, select: { id: true, avatarUrl: true } });
    for (const row of rows) {
      const url = await saveAvatarFile(Buffer.from(row.avatarUrl.slice(INLINE_JPEG.length), 'base64'));
      await model.update({ where: { id: row.id }, data: { avatarUrl: url } });
      moved += 1;
    }
  }
  if (moved > 0) console.log(`Аватары каналов перенесены из базы в файлы: ${moved}`);
  return moved;
};

module.exports = { saveAvatarFile, migrateInlineAvatars };
