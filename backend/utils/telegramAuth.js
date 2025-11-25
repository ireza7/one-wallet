const crypto = require('crypto');

/**
 * Verify Telegram WebApp initData according to official docs:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 *
 * @param {string} initData
 * @param {string} botToken
 * @returns {{ user: any, authDate: number | null, queryId: string | null }}
 */
function verifyTelegramWebAppData(initData, botToken) {
  if (!initData) {
    throw new Error('initData missing');
  }
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN missing');
  }

  const params = new URLSearchParams(initData);

  const hash = params.get('hash');
  if (!hash) {
    throw new Error('hash missing in initData');
  }

  const dataCheckArr = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    dataCheckArr.push(`${key}=${value}`);
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto.createHash('sha256')
    .update(botToken)
    .digest();

  const hmac = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (hmac !== hash) {
    throw new Error('invalid initData hash');
  }

  const rawUser = params.get('user');
  let user = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch (err) {
      throw new Error('cannot parse Telegram user JSON');
    }
  }

  const authDate = params.get('auth_date')
    ? Number(params.get('auth_date'))
    : null;
  const queryId = params.get('query_id') || null;

  return { user, authDate, queryId };
}

module.exports = {
  verifyTelegramWebAppData,
};
