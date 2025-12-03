const db = require('../db');
const { deriveWallet } = require('./hdWallet');
const { subscribeToAddress } = require('./tatumService');

async function findOrCreateUserByTelegram(telegramUser) {
  // 1. چک کردن وجود کاربر
  let rows = await db.query(
    'SELECT * FROM users WHERE telegram_id = ? LIMIT 1',
    [telegramUser.id]
  );
  
  if (rows.length > 0) {
    // کاربر قبلا بوده، محض اطمینان چکش می‌کنیم که سابسکرایب شده باشه (اختیاری ولی خوبه)
    // subscribeToAddress(rows[0].deposit_address); 
    return rows[0];
  }

  // 2. ساخت کاربر جدید
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

  // دریافت ID کاربر جدید
  rows = await db.query(
    'SELECT * FROM users WHERE telegram_id = ? LIMIT 1',
    [telegramUser.id]
  );
  const user = rows[0];

  // 3. ساخت آدرس کیف پول
  const wallet = deriveWallet(user.id);
  
  await db.query(
    'UPDATE users SET deposit_address = ? WHERE id = ?',
    [wallet.oneAddress, user.id]
  );
  user.deposit_address = wallet.oneAddress;

  // 4. === ثبت نام در Tatum (آسنکرون) ===
  // لازم نیست کاربر منتظر بماند، در پس‌زمینه انجام شود
  subscribeToAddress(wallet.oneAddress).catch(err => console.error(err));

  return user;
}

async function getUserByTelegramId(telegramId) {
  const rows = await db.query(
    'SELECT * FROM users WHERE telegram_id = ? LIMIT 1',
    [telegramId]
  );
  return rows[0] || null;
}

// تابع جدید برای پیدا کردن کاربر از روی آدرس (مخصوص وب‌هوک)
async function getUserByDepositAddress(address) {
  const rows = await db.query(
    'SELECT * FROM users WHERE deposit_address = ? LIMIT 1',
    [address]
  );
  return rows[0] || null;
}

module.exports = {
  findOrCreateUserByTelegram,
  getUserByTelegramId,
  getUserByDepositAddress
};