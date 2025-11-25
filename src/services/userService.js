const db = require('../db');
const { deriveWallet } = require('./hdWallet');

async function findOrCreateUserByTelegram(telegramUser) {
  let rows = await db.query(
    'SELECT * FROM users WHERE telegram_id = ? LIMIT 1',
    [telegramUser.id]
  );
  if (rows.length > 0) return rows[0];

  await db.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name)
     VALUES (?, ?, ?, ?)`,
    [
      telegramUser.id,
      telegramUser.username || null,
      telegramUser.first_name || null,
      telegramUser.last_name || null
    ]
  );

  rows = await db.query(
    'SELECT * FROM users WHERE telegram_id = ? LIMIT 1',
    [telegramUser.id]
  );
  const user = rows[0];

  const wallet = deriveWallet(user.id);
  await db.query(
    'UPDATE users SET deposit_address = ? WHERE id = ?',
    [wallet.oneAddress, user.id]
  );

  user.deposit_address = wallet.oneAddress;
  return user;
}

async function getUserByTelegramId(telegramId) {
  const rows = await db.query(
    'SELECT * FROM users WHERE telegram_id = ? LIMIT 1',
    [telegramId]
  );
  return rows[0] || null;
}

module.exports = {
  findOrCreateUserByTelegram,
  getUserByTelegramId
};
