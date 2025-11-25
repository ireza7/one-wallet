const db = require('../db');
const { sendTransaction } = require('./harmonyService');
const { HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS } = require('../config/env');

async function requestWithdraw(user, targetAddressOne, amount) {
  if (amount <= 0) throw new Error('مبلغ نامعتبر است');

  const rows = await db.query('SELECT * FROM users WHERE id = ?', [user.id]);
  const freshUser = rows[0];
  if (!freshUser) throw new Error('کاربر یافت نشد');

  if (Number(freshUser.balance) < amount) {
    throw new Error('موجودی ناکافی');
  }

  await db.query(
    'UPDATE users SET balance = balance - ? WHERE id = ?',
    [amount, user.id]
  );

  const insert = await db.query(
    `INSERT INTO withdraw_requests (user_id, target_address, amount, status)
     VALUES (?, ?, ?, 'PENDING')`,
    [user.id, targetAddressOne, amount]
  );

  const requestId = insert.insertId;

  // نسخه ساده: همان لحظه برداشت را ارسال می‌کنیم
  const txRes = await sendTransaction(
    HOT_WALLET_PRIVATE_KEY,
    targetAddressOne,
    amount
  );

  await db.query(
    'UPDATE withdraw_requests SET status = "SENT", tx_hash = ? WHERE id = ?',
    [txRes.txHash, requestId]
  );

  await db.query(
    `INSERT INTO transactions (user_id, tx_hash, tx_type, amount, from_address, to_address, status)
     VALUES (?, ?, 'WITHDRAW', ?, ?, ?, 'PENDING')`,
    [user.id, txRes.txHash, amount, HOT_WALLET_ADDRESS, targetAddressOne]
  );

  return { requestId, txHash: txRes.txHash };
}

module.exports = {
  requestWithdraw
};
