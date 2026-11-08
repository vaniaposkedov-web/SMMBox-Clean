// Подготовка фото перед отправкой на телефоне и компьютере.
const MAX_SIZE = 1920;
const QUALITY = 0.85;

const toBlob = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));

const compressImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();

  image.onload = async () => {
    try {
      const scale = Math.min(1, MAX_SIZE / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

      // Safari не умеет сохранять WebP и молча отдаёт огромный PNG: в этом случае нужен JPEG.
      let blob = await toBlob(canvas, 'image/webp');
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg');

      canvas.width = 0;
      canvas.height = 0;
      if (blob) resolve(blob);
      else reject(new Error('Не удалось обработать фото'));
    } catch (error) {
      reject(error);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('Не удалось прочитать фото'));
  };

  image.src = url;
});

// Фото обрабатываются по одному: десять снимков с телефона, открытых разом, могут закрыть вкладку из-за нехватки памяти.
export const compressImages = async (files) => {
  const blobs = [];
  for (const file of files) blobs.push(await compressImage(file));
  return blobs;
};

// Имя файла с настоящим форматом
export const blobFileName = (blob, index) => `image_${index}.${blob?.type === 'image/jpeg' ? 'jpg' : 'webp'}`;

// Метка одного нажатия: повтор запроса при плохой связи не создаёт вторую публикацию.
export const newRequestKey = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};
