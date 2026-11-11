// Время округляется вверх: лучше пообещать чуть больше и уложиться.
export const formatWait = (seconds) => {
  const rounded = Math.max(5, Math.ceil(seconds / 5) * 5);
  if (rounded < 60) return `${rounded} секунд`;
  const minutes = Math.ceil(rounded / 60);
  return `${minutes} ${minutes % 10 === 1 && minutes % 100 !== 11 ? 'минуты' : 'минут'}`;
};

export const getDeliveryMessage = (result, partners) => {
  const failed = result.failed || [];
  if (failed.length === 0) return 'Пост дошёл до партнёров!';
  const names = failed.map((id) => partners.find((partner) => partner.id === id)?.name || 'партнёр').join(', ');
  return `Дошло: ${result.delivered?.length || 0} из ${(result.delivered?.length || 0) + failed.length}. Не удалось отправить: ${names}.`;
};

// Зелёным с галочкой показывается только настоящий успех.
export const isSuccessNotice = (message) => String(message || '').startsWith('Пост дошёл');
