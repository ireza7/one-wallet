const axios = require("axios");
const db = require("../db");
const { deriveWallet } = require("./hdWallet");
const { sendTransaction, provider, getBalance } = require("./harmonyService");
const { HARMONY_RPC_URL, HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS } = require("../config/env");
const { DEPOSIT } = require("../config/fees"); // تنظیمات کارمزد
const { ethers } = require("ethers");

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

// دریافت تراکنش‌های ورودی از RPC
async function getIncomingTxs(addressOne) {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "hmy_getTransactionsHistory",
    params: [{
      address: addressOne,
      pageIndex: 0,
      pageSize: 50,
      fullTx: true,
      txType: "RECEIVED"
    }]
  };

  try {
    const res = await axios.post(HARMONY_RPC_URL, payload);
    const txs = res.data.result?.transactions || [];

    return txs
      .filter(tx => tx.to && tx.to.toLowerCase() === addressOne.toLowerCase())
      .map(tx => ({
        hash: tx.hash,
        from: tx.from,
        amount: Number(tx.value) / 1e18,
        blockNumber: parseInt(tx.blockNumber, 16)
      }));
  } catch (e) {
    console.error("getIncomingTxs Error:", e.message);
    return [];
  }
}

// ارسال گس به ولت کاربر برای انجام تراکنش Sweep
async function sendGasToChild(childWallet) {
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("100", "gwei");
  const gasLimit = 21000n;

  // محاسبه گس مورد نیاز با ضریب اطمینان (2x)
  const requiredGasWei = gasPrice * gasLimit * 2n;
  const requiredGasONE = Number(ethers.formatEther(requiredGasWei));

  return await sendTransaction(
    HOT_WALLET_PRIVATE_KEY,
    childWallet.oneAddress,
    requiredGasONE
  );
}

// تابع اصلی: بررسی واریز و انتقال به هات‌ولت
async function sweepUserDeposits(user) {
  // 1. بررسی قفل (برای جلوگیری از تداخل درخواست‌ها)
  const [freshUserRows] = await db.query(
    "SELECT sweep_lock, sweep_lock_ts FROM users WHERE id = ? LIMIT 1",
    [user.id]
  );
  const freshUser = freshUserRows[0] || user;

  const now = Date.now();
  const isLocked = freshUser.sweep_lock === 1;
  const lockTime = Number(freshUser.sweep_lock_ts || 0);

  // اگر قفل فعال است و هنوز منقضی نشده (کمتر از 10 دقیقه گذشته)، خطا بده
  if (isLocked && (now - lockTime < LOCK_TIMEOUT_MS)) {
    return { ok: false, error: "SWEEP_IN_PROGRESS" };
  }

  // فعال‌سازی قفل
  await db.query(
    "UPDATE users SET sweep_lock = 1, sweep_lock_ts = ? WHERE id = ?",
    [now, user.id]
  );

  try {
    // 2. دریافت واریزی‌های جدید از شبکه
    const incoming = await getIncomingTxs(user.deposit_address);
    const newTxs = [];

    for (const tx of incoming) {
      // فیلتر حداقل واریز (Min Deposit)
      if (tx.amount < DEPOSIT.MIN_AMOUNT) {
        console.log(`Deposit ignored (Below Min): ${tx.amount} < ${DEPOSIT.MIN_AMOUNT}`);
        continue;
      }

      // چک کردن تکراری نبودن تراکنش در دیتابیس
      const exists = await db.query(
        "SELECT id FROM deposit_txs WHERE tx_hash = ? LIMIT 1",
        [tx.hash]
      );
      
      if (exists.length === 0) {
        // ثبت اولیه تراکنش در دیتابیس (وضعیت PENDING)
        await db.query(
          `INSERT INTO deposit_txs 
          (user_id, tx_hash, amount, from_address, to_address, block_number, status)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
          [user.id, tx.hash, tx.amount, tx.from, user.deposit_address, tx.blockNumber]
        );
        newTxs.push(tx);
      }
    }

    if (newTxs.length === 0) {
      return [];
    }

    // 3. شروع عملیات Sweep (انتقال موجودی به هات‌ولت)
    const childWallet = deriveWallet(user.id);
    const totalBalance = await getBalance(childWallet.oneAddress);

    // اگر موجودی برای انتقال خیلی کم است، فقط دیتابیس را آپدیت می‌کنیم (بدون انتقال واقعی)
    // اما چون فیلتر Min Deposit داریم، معمولاً موجودی کافی خواهد بود.
    if (totalBalance < 0.001) {
       // اینجا می‌توانیم لاجیک خاصی داشته باشیم، فعلاً رد می‌شویم
       // (در واقعیت باید txها را CONFIRMED کنیم حتی اگر Sweep نشود، یا صبر کنیم جمع شوند)
       // اما برای سادگی فرض می‌کنیم موجودی هست.
    }

    // ارسال گس
    await sendGasToChild(childWallet);

    // تاخیر کوتاه برای نشستن گس در شبکه
    await new Promise(r => setTimeout(r, 2000));

    // محاسبه دقیق مبلغ قابل انتقال (موجودی کل - هزینه گس)
    const newBalance = await getBalance(childWallet.oneAddress);
    const feeData = await provider.getFeeData();
    const gasLimit = 21000n;
    const gasPrice = feeData.gasPrice || ethers.parseUnits("100", "gwei");
    const gasCost = gasPrice * gasLimit;

    const amountToSendWei = ethers.parseEther(String(newBalance)) - gasCost;

    // انجام انتقال (Sweep)
    if (amountToSendWei > 0n) {
        const childSigner = new ethers.Wallet(childWallet.privateKey, provider);
        const sweepTx = await childSigner.sendTransaction({
            to: HOT_WALLET_ADDRESS,
            value: amountToSendWei,
            gasLimit: gasLimit,
            gasPrice: gasPrice
        });
        await sweepTx.wait();
        console.log(`[Sweep] Swept ${ethers.formatEther(amountToSendWei)} ONE to Hot Wallet. TX: ${sweepTx.hash}`);
    }

    // 4. محاسبه و اعمال کارمزد واریز و آپدیت نهایی
    let totalCredited = 0;

    for (const tx of newTxs) {
      // محاسبه کارمزد
      let fee = (tx.amount * DEPOSIT.FEE_PERCENT) / 100;
      
      // اعمال کف و سقف کارمزد
      if (fee < DEPOSIT.MIN_FEE) fee = DEPOSIT.MIN_FEE;
      if (DEPOSIT.MAX_FEE > 0 && fee > DEPOSIT.MAX_FEE) fee = DEPOSIT.MAX_FEE;

      const finalAmount = tx.amount - fee;
      
      // اگر بعد از کسر کارمزد چیزی نماند، صفر در نظر می‌گیریم
      const amountToCredit = finalAmount > 0 ? finalAmount : 0;
      
      totalCredited += amountToCredit;

      // آپدیت وضعیت تراکنش داخلی به SWEEPED
      await db.query(
        "UPDATE deposit_txs SET status = 'SWEEPED' WHERE tx_hash = ?",
        [tx.hash]
      );

      // ثبت تراکنش نهایی در تاریخچه کاربر (قابل نمایش)
      await db.query(
        `INSERT INTO transactions 
         (user_id, tx_hash, tx_type, amount, from_address, to_address, status)
         VALUES (?, ?, 'DEPOSIT', ?, ?, ?, 'CONFIRMED')`,
        [user.id, tx.hash, amountToCredit, tx.from, user.deposit_address]
      );
    }

    // افزایش موجودی کاربر در جدول users
    if (totalCredited > 0) {
        await db.query(
          "UPDATE users SET balance = balance + ? WHERE id = ?",
          [totalCredited, user.id]
        );
    }

    return newTxs;

  } catch (err) {
    console.error("[Sweep ERROR]:", err);
    return { ok: false, error: err.message };

  } finally {
    // باز کردن قفل در هر شرایطی
    await db.query(
      "UPDATE users SET sweep_lock = 0, sweep_lock_ts = 0 WHERE id = ?",
      [user.id]
    );
  }
}

module.exports = {
  sweepUserDeposits
};