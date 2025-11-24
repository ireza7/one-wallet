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

// ساخت یا دریافت کاربر (با ساخت ولت اختصاصی در صورت نبود)
async function getOrCreateUser(telegramId, username) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegramId]
    );

    if (rows.length > 0) {
      await conn.commit();
      return rows[0];
    }

    const wallet = await generateUserWallet();

    const [result] = await conn.query(
      'INSERT INTO users (telegram_id, username, harmony_address, harmony_private_key) VALUES (?, ?, ?, ?)',
      [telegramId, username || null, wallet.address.toLowerCase(), wallet.privateKey]
    );

    const [createdRows] = await conn.query(
      'SELECT * FROM users WHERE id = ?',
      [result.insertId]
    );

    await conn.commit();
    return createdRows[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getUserByTelegramId(telegramId) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE telegram_id = ?',
    [telegramId]
  );
  return rows[0] || null;
}

async function getUserByUsername(username) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE username = ?',
    [username]
  );
  return rows[0] || null;
}

async function getUserById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

async function getBalance(userId) {
  const [rows] = await pool.query(
    'SELECT internal_balance FROM users WHERE id = ?',
    [userId]
  );
  return rows[0] ? Number(rows[0].internal_balance) : 0;
}

// انتقال داخلی (دو طرفه و لجر)
async function internalTransfer(fromUserId, toUserId, amount) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [fromRows] = await conn.query(
      'SELECT internal_balance FROM users WHERE id = ? FOR UPDATE',
      [fromUserId]
    );
    if (fromRows.length === 0) throw new Error('فرستنده پیدا نشد');

    const balance = Number(fromRows[0].internal_balance);
    if (balance < amount) throw new Error('موجودی کافی نیست');

    await conn.query(
      'UPDATE users SET internal_balance = internal_balance - ? WHERE id = ?',
      [amount, fromUserId]
    );

    await conn.query(
      'UPDATE users SET internal_balance = internal_balance + ? WHERE id = ?',
      [amount, toUserId]
    );

    await conn.query(
      'INSERT INTO wallet_ledger (user_id, type, amount, meta) VALUES (?, ?, ?, ?)',
      [fromUserId, 'internal_out', amount, JSON.stringify({ toUserId })]
    );

    await conn.query(
      'INSERT INTO wallet_ledger (user_id, type, amount, meta) VALUES (?, ?, ?, ?)',
      [toUserId, 'internal_in', amount, JSON.stringify({ fromUserId })]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ثبت برداشت و کم کردن موجودی
async function createWithdrawal(userId, amount, toAddress) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT internal_balance FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (rows.length === 0) throw new Error('کاربر پیدا نشد');

    const balance = Number(rows[0].internal_balance);
    if (balance < amount) throw new Error('موجودی کافی نیست');

    await conn.query(
      'UPDATE users SET internal_balance = internal_balance - ? WHERE id = ?',
      [amount, userId]
    );

    const [result] = await conn.query(
      'INSERT INTO withdrawals (user_id, amount, to_address) VALUES (?, ?, ?)',
      [userId, amount, toAddress.toLowerCase()]
    );

    await conn.query(
      'INSERT INTO wallet_ledger (user_id, type, amount, meta) VALUES (?, ?, ?, ?)',
      [userId, 'withdraw', amount, JSON.stringify({ toAddress, withdrawalId: result.insertId })]
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

async function markWithdrawalSent(withdrawalId, txHash) {
  await pool.query(
    'UPDATE withdrawals SET status = ?, tx_hash = ? WHERE id = ?',
    ['sent', txHash, withdrawalId]
  );
}

async function markWithdrawalFailed(withdrawalId, errorMessage) {
  await pool.query(
    'UPDATE withdrawals SET status = ?, error_message = ? WHERE id = ?',
    ['failed', errorMessage, withdrawalId]
  );
}

module.exports = {
  pool,
  getOrCreateUser,
  getUserByTelegramId,
  getUserByUsername,
  getUserById,
  getBalance,
  internalTransfer,
  createWithdrawal,
  markWithdrawalSent,
  markWithdrawalFailed,
};
