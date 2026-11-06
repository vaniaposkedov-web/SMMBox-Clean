const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
};

const signUserToken = (user, expiresIn = '7d') =>
  jwt.sign({ userId: user.id, role: user.role }, getJwtSecret(), { expiresIn });

const PRIVATE_USER_FIELDS = [
  'password',
  'emailVerificationCode',
  'emailVerificationExpires',
  'resetPasswordToken',
  'resetPasswordExpires',
];

const sanitizeUser = (user) => {
  if (!user) return user;
  const safe = { ...user, hasPassword: Boolean(user.password) };
  for (const field of PRIVATE_USER_FIELDS) delete safe[field];
  return safe;
};

const generateVerificationCode = () => String(crypto.randomInt(100000, 1000000));

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// https://core.telegram.org/widgets/login#checking-authorization
const verifyTelegramLogin = (data, botToken, maxAgeSeconds = 24 * 60 * 60) => {
  if (!botToken || !data || !data.hash || !data.auth_date) return false;
  const checkString = Object.keys(data)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  if (!safeEqual(expected, data.hash)) return false;
  const age = Math.floor(Date.now() / 1000) - Number(data.auth_date);
  return Number.isFinite(age) && age >= -60 && age <= maxAgeSeconds;
};

// The VK user is taken only from VK's own answer for this token, never from what the browser sent.
const fetchVkIdUser = async (accessToken) => {
  const clientId = process.env.VK_APP_ID;
  if (!clientId) throw new Error('VK_APP_ID is not set');
  if (!accessToken) return null;
  const response = await axios.post(
    `https://id.vk.ru/oauth2/user_info?client_id=${encodeURIComponent(clientId)}`,
    new URLSearchParams({ access_token: accessToken }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, validateStatus: (s) => s < 500, timeout: 10000 }
  );
  const user = response.data && response.data.user;
  return user && user.user_id ? user : null;
};

const getBotToken = () => (process.env.TELEGRAM_BOT_TOKEN || '').replace(/['"]/g, '').trim();

// Telegram file links contain the bot token, so the picture is embedded instead of sharing the link.
const telegramFileToDataUri = async (botToken, fileId) => {
  const file = await axios.get(`https://api.telegram.org/bot${botToken}/getFile`, { params: { file_id: fileId } });
  const image = await axios.get(`https://api.telegram.org/file/bot${botToken}/${file.data.result.file_path}`, { responseType: 'arraybuffer' });
  return `data:image/jpeg;base64,${Buffer.from(image.data).toString('base64')}`;
};

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

module.exports = {
  getJwtSecret,
  signUserToken,
  sanitizeUser,
  generateVerificationCode,
  sha256,
  safeEqual,
  verifyTelegramLogin,
  fetchVkIdUser,
  getBotToken,
  telegramFileToDataUri,
  escapeXml,
};
