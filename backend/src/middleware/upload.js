const multer = require('multer');
const os = require('os');

// Заменяем memoryStorage на diskStorage во временную директорию ОС.
// Это спасет сервер от падения по RAM при массовых загрузках.
const upload = multer({ 
  dest: os.tmpdir(), 
  limits: { fileSize: 15 * 1024 * 1024 }, // Лимит можно поднять, т.к. RAM не страдает
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения!'));
    }
  }
});

module.exports = upload;