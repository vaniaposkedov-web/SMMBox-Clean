// One place for tariff rules. The admin panel stores the plan as "Базовый" or "Расширенный",
// older records may hold BASIC or PRO.
const PLAN_LIMITS = {
  ADVANCED: { name: 'Расширенный', vk: 20, tg: 8, total: 28 },
  BASIC: { name: 'Базовый', vk: 15, tg: 5, total: 20 },
};

const isSubscriptionActive = (user) => {
  if (!user || !user.isPro) return false;
  return !user.proExpiresAt || new Date(user.proExpiresAt) > new Date();
};

const getPlan = (user) => {
  if (!isSubscriptionActive(user)) return null;
  const type = String(user.proPlanType || '').toUpperCase();
  if (type.includes('РАСШИРЕН') || type === 'PRO') return PLAN_LIMITS.ADVANCED;
  if (type.includes('БАЗОВ') || type === 'BASIC') return PLAN_LIMITS.BASIC;
  return null;
};

const getUserLimits = (user) => {
  const plan = getPlan(user);
  if (!plan) return { active: false, vk: 0, tg: 0, total: 0 };
  return { active: true, vk: plan.vk, tg: plan.tg, total: plan.total };
};

const NO_SUBSCRIPTION_ERROR = 'Нет активной подписки. Оформите тариф, чтобы подключать аккаунты и публиковать посты.';

// The interface blocks the accounts past the limit in the same order: newest first, per network.
const getAllowedAccountIds = (accounts, limits) => {
  const allowed = new Set();
  const newestFirst = [...accounts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let vk = 0;
  let tg = 0;
  for (const account of newestFirst) {
    if (account.provider === 'VK' && vk < limits.vk) { allowed.add(account.id); vk += 1; }
    if (account.provider === 'TELEGRAM' && tg < limits.tg) { allowed.add(account.id); tg += 1; }
  }
  return allowed;
};

module.exports = { isSubscriptionActive, getUserLimits, getAllowedAccountIds, NO_SUBSCRIPTION_ERROR };
