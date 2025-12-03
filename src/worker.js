require('dotenv').config(); // بارگذاری متغیرهای محیطی
const db = require('./db');
const { sweepUserDeposits } = require('./services/sweepService');
const { provider } = require('./services/harmonyService');

const SWEEP_INTERVAL = 60 * 1000; // هر 1 دقیقه
const CONFIRM_INTERVAL = 30 * 1000; // هر 30 ثانیه

async function runAutoSweep() {
  try {
    console.log('[Worker] Starting Auto-Sweep...');
    // دریافت تمام کاربران (در سیستم‌های بزرگ، فقط کاربران فعال یا صفحه‌بندی شده را بگیرید)
    const [users] = await db.query("SELECT * FROM users");

    for (const user of users) {
      try {
        // فراخوانی سرویس Sweep که قبلاً نوشتیم (شامل قفل و بررسی زمان است)
        await sweepUserDeposits(user);
      } catch (err) {
        if (err.message !== 'SWEEP_IN_PROGRESS') {
          console.error(`[Worker] Sweep error for user ${user.id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[Worker] Global sweep error:', err);
  }
}

async function checkPendingWithdrawals() {
  try {
    console.log('[Worker] Checking pending withdrawals...');
    
    // دریافت تراکنش‌هایی که ارسال شده‌اند اما هنوز تایید نهایی در دیتابیس نخورده‌اند
    // (فرض: ما وضعیتی به نام 'SENT' برای برداشت‌های ارسال شده داریم)
    const [requests] = await db.query(
      "SELECT * FROM withdraw_requests WHERE status = 'SENT' LIMIT 20"
    );

    for (const req of requests) {
      if (!req.tx_hash) continue;

      try {
        const receipt = await provider.getTransactionReceipt(req.tx_hash);

        if (receipt) {
          if (receipt.status === 1) {
            // موفقیت آمیز
            console.log(`[Worker] TX Confirmed: ${req.tx_hash}`);
            
            // آپدیت جدول درخواست‌ها
            await db.query(
              "UPDATE withdraw_requests SET status = 'APPROVED' WHERE id = ?",
              [req.id]
            );

            // آپدیت جدول تراکنش‌های اصلی (transactions)
            // نکته: ما در withdrawService تراکنش را PENDING ثبت کردیم
            await db.query(
              "UPDATE transactions SET status = 'CONFIRMED', confirmed_at = NOW() WHERE tx_hash = ?",
              [req.tx_hash]
            );

          } else {
            // شکست خورده در شبکه (Reverted)
            console.warn(`[Worker] TX Failed on-chain: ${req.tx_hash}`);
            
            await db.query(
              "UPDATE withdraw_requests SET status = 'FAILED' WHERE id = ?",
              [req.id]
            );
            
            await db.query(
              "UPDATE transactions SET status = 'FAILED' WHERE tx_hash = ?",
              [req.tx_hash]
            );

            // مهم: برگشت پول به حساب کاربر (Refund)
            await db.query(
              "UPDATE users SET balance = balance + ? WHERE id = ?",
              [req.amount, req.user_id]
            );
            console.log(`[Worker] User ${req.user_id} refunded ${req.amount} ONE`);
          }
        } else {
          // هنوز در ممپول است یا ماین نشده -> کاری نمی‌کنیم تا دور بعد
        }
      } catch (e) {
        console.error(`[Worker] Error checking tx ${req.tx_hash}:`, e.message);
      }
    }
  } catch (err) {
    console.error('[Worker] Check pending error:', err);
  }
}

function startWorker() {
  console.log('🚀 Worker started successfully.');

  // زمان‌بندی وظایف
  setInterval(runAutoSweep, SWEEP_INTERVAL);
  setInterval(checkPendingWithdrawals, CONFIRM_INTERVAL);

  // اجرای اولیه
  runAutoSweep();
  checkPendingWithdrawals();
}

// اگر فایل مستقیم اجرا شد
if (require.main === module) {
    // اتصال به دیتابیس و شروع
    db.initDB().then(startWorker).catch(err => {
        console.error('Failed to connect to DB:', err);
        process.exit(1);
    });
}

module.exports = { startWorker };