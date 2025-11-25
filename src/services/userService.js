const db = require('../db');
const { deriveWallet } = require('./hdWallet');

async function findOrCreateUserByTelegram(telegramUser) {
  const existing = await db.query(
    'SELECT * FROM users WHERE telegram_id = ? LIMIT 1',
    [telegramUser.id]
  );
  if (existing.length > 0) return existing[0];

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

  const rows = await db.query(
    'SELECT * FROM users WHERE telegram_id = ? LIMIT 1',
    [telegramUser.id]
  );
  const newUser = rows[0];

  const wallet = deriveWallet(newUser.id);

  await db.query(
    'UPDATE users SET deposit_address = ? WHERE id = ?',
    [wallet.address, newUser.id]
  );

  newUser.deposit_address = wallet.address;
  return newUser;
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
