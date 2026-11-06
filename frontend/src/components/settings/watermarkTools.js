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
