const db = require('../db');
const { sendTransaction } = require('./harmonyService');
const { HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS } = require('../config/env');

async function requestWithdraw(user, targetAddressOne, amount) {
  if (amount <= 0) throw new Error('مبلغ نامعتبر است');

  // 1. Atomic Update:
  // همزمان چک می‌کنیم موجودی کافی باشد و همان لحظه کسر می‌کنیم.
  // اگر موجودی کافی نباشد، affectedRows برابر 0 خواهد بود.
  const result = await db.query(
    'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
    [amount, user.id, amount]
  );

  // چک کردن اینکه آیا آپدیت انجام شد یا نه
  if (result.affectedRows === 0) {
    throw new Error('موجودی ناکافی یا خطای کاربری');
  }

  try {
    // 2. ثبت درخواست در دیتابیس
    const insert = await db.query(
      `INSERT INTO withdraw_requests (user_id, target_address, amount, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [user.id, targetAddressOne, amount]
    );

    const requestId = insert.insertId;

    // 3. ارسال تراکنش به بلاکچین
    // نکته: در سیستم‌های بزرگ بهتر است این بخش در یک Worker جداگانه انجام شود،
    // اما برای اینجا ما مکانیزم بازگشت وجه (Refund) در صورت خطا را اضافه می‌کنیم.
    let txRes;
    try {
      txRes = await sendTransaction(
        HOT_WALLET_PRIVATE_KEY,
        targetAddressOne,
        amount
      );
    } catch (txError) {
      // اگر ارسال تراکنش خطا داد، باید پول کاربر را برگردانیم (Rollback دستی)
      console.error('Withdraw failed, refunding user...', txError);
      await db.query(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [amount, user.id]
      );
      await db.query(
        'UPDATE withdraw_requests SET status = "FAILED" WHERE id = ?',
        [requestId]
      );
      throw new Error('خطا در شبکه بلاکچین. مبلغ به کیف پول برگشت.');
    }

    // 4. موفقیت آمیز
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

  } catch (err) {
    // اگر خطایی بعد از کسر پول رخ داد که هندل نشده بود (خیلی نادر)
    console.error('Critical Withdraw Error:', err);
    throw err;
  }
}

module.exports = {
  requestWithdraw
};