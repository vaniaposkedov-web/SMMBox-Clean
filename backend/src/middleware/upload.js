// backend/src/middleware/upload.js
const multer = require('multer');

// На Vercel файловая система "только для чтения", поэтому создавать папки нельзя.
// Используем хранение в оперативной памяти (MemoryStorage)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Лимит 5 МБ
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения!'));
    }
  }
});

module.exports = upload;