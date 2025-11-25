const db = require('../db');
const { HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS } = require('../config/env');
const { sendTransaction } = require('./harmonyService');

async function requestWithdraw(user, targetAddress, amount) {
  if (amount <= 0) {
    throw new Error('مبلغ نامعتبر است');
  }

  const [freshUser] = await db.query('SELECT * FROM users WHERE id = ?', [user.id]);
  if (!freshUser) throw new Error('کاربر یافت نشد');

  if (Number(freshUser.balance) < amount) {
    throw new Error('موجودی ناکافی');
  }

  await db.query(
    'UPDATE users SET balance = balance - ? WHERE id = ?',
    [amount, user.id]
  );

  const result = await db.query(
    `INSERT INTO withdraw_requests (user_id, target_address, amount, status)
     VALUES (?, ?, ?, 'PENDING')`,
    [user.id, targetAddress, amount]
  );

  return { requestId: result.insertId };
}

// ساده: بلافاصله درخواست ها را ارسال می‌کند (برای پروداکشن بهتر است صف و تایید ادمین داشته باشید)
async function processWithdrawRequest(requestId) {
  const rows = await db.query(
    'SELECT * FROM withdraw_requests WHERE id = ? AND status = "PENDING" LIMIT 1',
    [requestId]
  );
  if (!rows.length) {
    throw new Error('درخواست یافت نشد یا پردازش شده است');
  }

  const request = rows[0];

  const txRes = await sendTransaction(
    HOT_WALLET_PRIVATE_KEY,
    request.target_address,
    request.amount
  );

  await db.query(
    'UPDATE withdraw_requests SET status = "SENT", tx_hash = ? WHERE id = ?',
    [txRes.txHash, requestId]
  );

  await db.query(
    `INSERT INTO transactions (user_id, tx_hash, tx_type, amount, from_address, to_address, status)
     VALUES (?, ?, 'WITHDRAW', ?, ?, ?, 'PENDING')`,
    [request.user_id, txRes.txHash, request.amount, HOT_WALLET_ADDRESS, request.target_address]
  );

  return txRes;
}

module.exports = {
  requestWithdraw,
  processWithdrawRequest
};
