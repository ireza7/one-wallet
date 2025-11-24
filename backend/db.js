const mysql = require('mysql2/promise');
const config = require('./config');
const { generateUserWallet } = require('./harmony');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ایجاد یا دریافت کاربر + ساخت ولت Harmony
async function getOrCreateUser(telegramId, username) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT * FROM users WHERE telegram_id = ?",
      [telegramId]
    );

    if (rows.length > 0) {
      await conn.commit();
      return rows[0];
    }

    // ساخت ولت Harmony
    const wallet = await generateUserWallet();

    const [result] = await conn.query(
      `INSERT INTO users (telegram_id, username, harmony_address, harmony_hex, harmony_private_key)
       VALUES (?, ?, ?, ?, ?)`,
      [
        telegramId,
        username || null,
        wallet.address,      // bech32 (one1...)
        wallet.hexAddress,   // 0x...
        wallet.privateKey,
      ]
    );

    const [created] = await conn.query(
      "SELECT * FROM users WHERE id = ?",
      [result.insertId]
    );

    await conn.commit();
    return created[0];

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// پیدا کردن کاربر
async function getUserByTelegramId(telegramId) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE telegram_id = ?",
    [telegramId]
  );
  return rows[0] || null;
}

async function getUserByUsername(username) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );
  return rows[0] || null;
}

async function getUserById(id) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

// نکته مهم: مانیتورینگ از آدرس hex استفاده می‌کند، پس این نیاز است:
async function getUserByHexAddress(hexAddress) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE harmony_hex = ?",
    [hexAddress.toLowerCase()]
  );
  return rows[0] || null;
}

// گرفتن موجودی داخلی
async function getBalance(userId) {
  const [rows] = await pool.query(
    "SELECT internal_balance FROM users WHERE id = ?",
    [userId]
  );
  return rows[0] ? Number(rows[0].internal_balance) : 0;
}

// انتقال داخلی
async function internalTransfer(fromUserId, toUserId, amount) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [fromRows] = await conn.query(
      "SELECT internal_balance FROM users WHERE id = ? FOR UPDATE",
      [fromUserId]
    );

    if (fromRows.length === 0) throw new Error("فرستنده پیدا نشد");

    const balance = Number(fromRows[0].internal_balance);
    if (balance < amount) throw new Error("موجودی کافی نیست");

    // کم کردن از فرستنده
    await conn.query(
      "UPDATE users SET internal_balance = internal_balance - ? WHERE id = ?",
      [amount, fromUserId]
    );

    // اضافه کردن به گیرنده
    await conn.query(
      "UPDATE users SET internal_balance = internal_balance + ? WHERE id = ?",
      [amount, toUserId]
    );

    // لجر دو طرفه
    await conn.query(
      `INSERT INTO wallet_ledger (user_id, type, amount, meta)
       VALUES (?, 'internal_out', ?, ?)`,
      [fromUserId, amount, JSON.stringify({ toUserId })]
    );

    await conn.query(
      `INSERT INTO wallet_ledger (user_id, type, amount, meta)
       VALUES (?, 'internal_in', ?, ?)`,
      [toUserId, amount, JSON.stringify({ fromUserId })]
    );

    await conn.commit();

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ثبت برداشت (و کم کردن موجودی داخلی)
async function createWithdrawal(userId, amount, toAddress) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT internal_balance FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );

    if (rows.length === 0) throw new Error("کاربر پیدا نشد");

    const balance = Number(rows[0].internal_balance);
    if (balance < amount) throw new Error("موجودی کافی نیست");

    // کم کردن موجودی
    await conn.query(
      "UPDATE users SET internal_balance = internal_balance - ? WHERE id = ?",
      [amount, userId]
    );

    const [result] = await conn.query(
      `INSERT INTO withdrawals (user_id, amount, to_address)
       VALUES (?, ?, ?)`,
      [userId, amount, toAddress.toLowerCase()]
    );

    // لجر
    await conn.query(
      `INSERT INTO wallet_ledger (user_id, type, amount, meta)
       VALUES (?, 'withdraw', ?, ?)`,
      [userId, amount, JSON.stringify({ toAddress })]
    );

    await conn.commit();
    return result.insertId;

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function markWithdrawalSent(id, txHash) {
  await pool.query(
    "UPDATE withdrawals SET status = 'sent', tx_hash = ? WHERE id = ?",
    [txHash, id]
  );
}

async function markWithdrawalFailed(id, message) {
  await pool.query(
    "UPDATE withdrawals SET status = 'failed', error_message = ? WHERE id = ?",
    [message, id]
  );
}

module.exports = {
  pool,
  getOrCreateUser,
  getUserByTelegramId,
  getUserByUsername,
  getUserById,
  getUserByHexAddress,
  getBalance,
  internalTransfer,
  createWithdrawal,
  markWithdrawalSent,
  markWithdrawalFailed,
};
