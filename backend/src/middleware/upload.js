const multer = require('multer');
const os = require('os');

// ⚡ ИСПРАВЛЕНИЕ: Используем временную папку ОС (на диске), а не оперативную память
const upload = multer({ 
  dest: os.tmpdir(), 
  limits: { fileSize: 15 * 1024 * 1024 }, // Увеличили лимит до 15 МБ
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения!'));
    }
  }
});

module.exports = upload;