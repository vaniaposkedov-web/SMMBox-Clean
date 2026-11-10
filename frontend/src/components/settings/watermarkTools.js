// Настройки и предпросмотр водяного знака.
// Предпросмотр считает по тем же формулам, что и наложение на фото: applyWatermark в backend/src/controllers/postController.js.

export const DEFAULT_WATERMARK = {
  type: 'text',
  text: 'SADOVODPS',
  position: 'br', // tl, tc, tr, cl, cc, cr, bl, bc, br или custom (перетащили мышью)
  margin: 5,
  opacity: 80,
  size: 20,
  angle: 0,
  fontFamily: 'system-ui',
  textColor: '#FFFFFF',
  hasBackground: true,
  bgColor: '#000000',
  bgPadding: 10,
  hasStroke: false,
  strokeColor: '#000000',
  strokeWidth: 2,
};

// Размеры знака зависят от ширины фото, поэтому блоку предпросмотра нужен этот стиль.
export const PREVIEW_CONTAINER_STYLE = { containerType: 'inline-size' };

const getPositionStyle = ({ position, margin, x, y, angle }) => {
  const rotate = angle ? ` rotate(${angle}deg)` : '';
  if (position === 'custom' && Number.isFinite(x) && Number.isFinite(y)) {
    return { left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%)${rotate}` };
  }

  const [row, column] = /^[tcb][lcr]$/.test(position) ? position : 'br';
  const offset = `${margin ?? 5}%`;
  const style = {};
  const moves = [];
  if (column === 'l') style.left = offset;
  if (column === 'r') style.right = offset;
  if (column === 'c') { style.left = '50%'; moves.push('translateX(-50%)'); }
  if (row === 't') style.top = offset;
  if (row === 'b') style.bottom = offset;
  if (row === 'c') { style.top = '50%'; moves.push('translateY(-50%)'); }
  style.transform = `${moves.join(' ')}${rotate}`.trim();
  return style;
};

export const getWatermarkPreviewStyle = (settings) => {
  const size = settings.size ?? 20;
  const style = {
    position: 'absolute',
    opacity: (settings.opacity ?? 80) / 100,
    transformOrigin: 'center',
    maxWidth: '100%',
    maxHeight: '100%',
    ...getPositionStyle(settings),
  };

  if (settings.type === 'image') {
    style.width = `${size * 0.35}cqw`;
    style.height = 'auto';
    return style;
  }

  style.fontSize = `${size * 0.2}cqw`;
  style.color = settings.textColor || '#FFFFFF';
  style.fontFamily = settings.fontFamily || 'system-ui';
  style.fontWeight = 'bold';
  style.lineHeight = '1.2';
  style.whiteSpace = 'nowrap';

  if (settings.hasBackground !== false) {
    const padding = settings.bgPadding ?? 10;
    style.backgroundColor = settings.bgColor || '#000000';
    style.padding = `${padding / 25}em ${padding / 12}em`;
    style.borderRadius = '0.2em';
  }

  if (settings.hasStroke) {
    style.WebkitTextStroke = `${(settings.strokeWidth || 2) * 0.1}cqw ${settings.strokeColor || '#000000'}`;
    style.paintOrder = 'stroke fill';
  }

  return style;
};

// Знак без текста или без логотипа на фото не попадёт, поэтому такой лучше не сохранять.
export const getWatermarkProblem = (settings) => {
  if (settings.type === 'image') return settings.image ? null : 'Загрузите логотип или выберите текстовый знак.';
  return settings.text?.trim() ? null : 'Введите текст знака.';
};

// Уменьшает логотип перед сохранением. PNG сохраняет прозрачный фон.
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Не удалось открыть логотип.'));
  img.src = src;
});

// Насколько цвет пикселя отличается от цвета фона (0 — тот же цвет, 441 — противоположный).
const colorDistance = (data, i, bg) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
const BG_SAME = 60;   // Ближе этого — точно фон
const BG_EDGE = 130;  // До этого — край логотипа, смешанный с фоном: становится полупрозрачным

// Убирает однотонный фон вокруг логотипа. Фон «заливается» от краёв картинки, поэтому
// такие же по цвету детали внутри логотипа (белые буквы на синей плашке) остаются.
// Возвращает { image } с прозрачным фоном или { reason }, если убирать нечего или фон не однотонный.
export const removeLogoBackground = async (dataUrl) => {
  const img = await loadImage(dataUrl);
  const { width, height } = img;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height);
  const { data } = pixels;

  const border = [];
  for (let x = 0; x < width; x += 1) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) border.push(y * width, y * width + width - 1);

  // PNG, у которого фона уже нет
  const transparentBorder = border.filter((p) => data[p * 4 + 3] < 200).length;
  if (transparentBorder > border.length * 0.2) return { reason: 'transparent' };

  // Цвет фона — самый частый цвет по краям. Если он занимает меньше 60% краёв, фон не однотонный.
  const buckets = new Map();
  for (const p of border) {
    const i = p * 4;
    const key = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`;
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1; bucket.r += data[i]; bucket.g += data[i + 1]; bucket.b += data[i + 2];
    buckets.set(key, bucket);
  }
  const main = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  const sameAsMain = border.filter((p) => colorDistance(data, p * 4, [main.r / main.count, main.g / main.count, main.b / main.count]) < BG_SAME).length;
  if (sameAsMain < border.length * 0.6) return { reason: 'not-plain' };
  const bg = [main.r / main.count, main.g / main.count, main.b / main.count];

  // Заливка от краёв по всем пикселям, похожим на фон
  const isBackground = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (const p of border) {
    if (!isBackground[p] && colorDistance(data, p * 4, bg) < BG_SAME) { isBackground[p] = 1; queue[tail++] = p; }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
    for (const n of neighbours) {
      if (n < 0 || n >= width * height || isBackground[n]) continue;
      if (colorDistance(data, n * 4, bg) < BG_SAME) { isBackground[n] = 1; queue[tail++] = n; }
    }
  }

  const removedShare = tail / (width * height);
  if (removedShare < 0.02) return { reason: 'not-plain' };
  if (removedShare > 0.97) return { reason: 'empty' }; // Логотип того же цвета, что и фон: убирать нельзя

  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4;
    if (isBackground[p]) { data[i + 3] = 0; continue; }
    // Край логотипа рядом с фоном: делаем полупрозрачным и убираем примесь цвета фона, чтобы не было светлой каймы
    const x = p % width;
    const touchesBackground = (x > 0 && isBackground[p - 1]) || (x < width - 1 && isBackground[p + 1])
      || (p >= width && isBackground[p - width]) || (p + width < width * height && isBackground[p + width]);
    if (!touchesBackground) continue;
    const distance = colorDistance(data, i, bg);
    if (distance >= BG_EDGE) continue;
    const alpha = Math.max(0.05, (distance - BG_SAME) / (BG_EDGE - BG_SAME));
    for (let c = 0; c < 3; c += 1) data[i + c] = Math.max(0, Math.min(255, (data[i + c] - bg[c] * (1 - alpha)) / alpha));
    data[i + 3] = Math.round(data[i + 3] * alpha);
  }

  ctx.putImageData(pixels, 0, 0);
  return { image: canvas.toDataURL('image/png') };
};

export const compressLogo = (file, maxSide = 400) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Не удалось прочитать файл логотипа.'));
  reader.onload = (event) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Этот файл не похож на картинку. Выберите другой логотип.'));
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});
