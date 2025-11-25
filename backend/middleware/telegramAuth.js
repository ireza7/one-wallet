
const crypto = require('crypto');
const config = require('../config');

/**
 * parse Telegram WebApp initData (query-string like) into object
 */
function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const data = {};
  for (const [key, value] of params.entries()) {
    data[key] = value;
  }
  return data;
}

/**
 * Verify Telegram WebApp initData according to Telegram docs.
 * Returns { telegramId, username, rawData } on success, throws Error on failure.
 */
function verifyTelegramInitData(initData) {
  if (!initData || typeof initData !== 'string') {
    throw new Error('initData لازم است');
  }

  if (!config.telegram || !config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN تنظیم نشده است');
  }

  const data = parseInitData(initData);
  const hash = data.hash;
  if (!hash) {
    throw new Error('hash در initData موجود نیست');
  }

  const authDate = Number(data.auth_date || 0);
  if (!authDate || Number.isNaN(authDate)) {
    throw new Error('auth_date در initData نامعتبر است');
  }

  const now = Math.floor(Date.now() / 1000);
  const maxAge = Number(config.telegram.authMaxAgeSeconds || 86400);
  if (now - authDate > maxAge) {
    throw new Error('نشست تلگرام منقضی شده است');
  }

  // Build data_check_string
  const dataCheckArr = [];
  for (const key of Object.keys(data).sort()) {
    if (key === 'hash') continue;
    dataCheckArr.push(`${key}=${data[key]}`);
  }
  const dataCheckString = dataCheckArr.join('\n');

  // Create secret key = HMAC_SHA256(bot_token, "WebAppData")
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(config.telegram.botToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    throw new Error('امضای تلگرام معتبر نیست');
  }

  let user;
  try {
    user = JSON.parse(data.user);
  } catch (err) {
    throw new Error('فیلد user در initData نامعتبر است');
  }

  if (!user || !user.id) {
    throw new Error('اطلاعات کاربر تلگرام در initData ناقص است');
  }

  return {
    telegramId: String(user.id),
    username: user.username || null,
    rawData: data,
  };
}

function telegramAuthMiddleware(req, res, next) {
  try {
    const initData =
      req.headers['x-telegram-init-data'] ||
      req.body?.initData ||
      req.query?.initData;

    const { telegramId, username, rawData } = verifyTelegramInitData(initData);

    req.telegramUser = {
      telegramId,
      username,
      rawData,
    };

    return next();
  } catch (err) {
    console.error('Telegram WebApp auth failed:', err.message);
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
}

module.exports = {
  telegramAuthMiddleware,
  verifyTelegramInitData,
};
