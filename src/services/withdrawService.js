const db = require('../db');
const { sendTransaction } = require('./harmonyService');
const { HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS } = require('../config/env');
const { WITHDRAW } = require('../config/fees'); // تنظیمات کارمزد

async function requestWithdraw(user, targetAddressOne, amount) {
  // 1. بررسی حداقل مبلغ برداشت
  if (amount < WITHDRAW.MIN_AMOUNT) {
    throw new Error(`مبلغ برداشت باید حداقل ${WITHDRAW.MIN_AMOUNT} ONE باشد.`);
  }

  // 2. محاسبه کارمزد برداشت
  let fee = (amount * WITHDRAW.FEE_PERCENT) / 100;

  // اعمال کف کارمزد
  if (fee < WITHDRAW.MIN_FEE) fee = WITHDRAW.MIN_FEE;

  // اعمال سقف کارمزد (اگر تعریف شده باشد)
  if (WITHDRAW.MAX_FEE > 0 && fee > WITHDRAW.MAX_FEE) fee = WITHDRAW.MAX_FEE;

  // مبلغ کل که باید از حساب کسر شود (مبلغ درخواستی + کارمزد)
  const totalDeduction = amount + fee;

  // 3. کسر اتمیک از دیتابیس (Atomic Update)
  // این کوئری همزمان موجودی را چک می‌کند و کسر می‌کند تا از Race Condition جلوگیری شود.
  const result = await db.query(
    'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
    [totalDeduction, user.id, totalDeduction]
  );

  // اگر رکوردی آپدیت نشد، یعنی موجودی کافی نبوده است
  if (result.affectedRows === 0) {
    // برای نمایش پیام دقیق‌تر به کاربر، موجودی فعلی را می‌گیریم (اختیاری)
    const [rows] = await db.query('SELECT balance FROM users WHERE id = ?', [user.id]);
    const currentBalance = rows[0] ? rows[0].balance : 0;
    
    throw new Error(`موجودی ناکافی. (مبلغ: ${amount} + کارمزد: ${fee.toFixed(2)} = ${totalDeduction.toFixed(2)} ONE) - موجودی شما: ${Number(currentBalance).toFixed(2)}`);
  }

  try {
    // 4. ثبت درخواست در دیتابیس (وضعیت اولیه: PENDING)
    const insert = await db.query(
      `INSERT INTO withdraw_requests (user_id, target_address, amount, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [user.id, targetAddressOne, amount]
    );

    const requestId = insert.insertId;

    // 5. ارسال تراکنش به شبکه بلاکچین
    // ما فقط "مبلغ درخواستی" را ارسال می‌کنیم، کارمزد در سیستم ما باقی می‌ماند.
    let txRes;
    try {
      txRes = await sendTransaction(
        HOT_WALLET_PRIVATE_KEY,
        targetAddressOne,
        amount
      );
    } catch (txError) {
      console.error('Blockchain Withdraw Failed:', txError);
      
      // === ROLLBACK (برگشت پول) ===
      // اگر تراکنش در شبکه فیل شد، پول (اصل + کارمزد) را به کاربر برمی‌گردانیم
      await db.query(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [totalDeduction, user.id]
      );
      
      await db.query(
        'UPDATE withdraw_requests SET status = "FAILED" WHERE id = ?',
        [requestId]
      );
      
      throw new Error('خطا در ارسال تراکنش به شبکه. مبلغ به کیف پول شما برگشت داده شد.');
    }

    // 6. موفقیت: بروزرسانی وضعیت درخواست
    await db.query(
      'UPDATE withdraw_requests SET status = "SENT", tx_hash = ? WHERE id = ?',
      [txRes.txHash, requestId]
    );

    // ثبت تراکنش در تاریخچه
    await db.query(
      `INSERT INTO transactions 
       (user_id, tx_hash, tx_type, amount, from_address, to_address, status)
       VALUES (?, ?, 'WITHDRAW', ?, ?, ?, 'PENDING')`,
      [user.id, txRes.txHash, amount, HOT_WALLET_ADDRESS, targetAddressOne]
    );

    return { 
      requestId, 
      txHash: txRes.txHash,
      fee: fee,
      totalDeducted: totalDeduction
    };

  } catch (err) {
    // خطاهای پیش‌بینی نشده
    throw err;
  }
}

module.exports = {
  requestWithdraw
};