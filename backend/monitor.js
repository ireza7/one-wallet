const { web3, sweepToHotWallet, normalizeToHex } = require('./harmony');
const db = require('./db');

async function monitorDepositDifferences() {
  try {
    const [users] = await db.pool.query(
      'SELECT id, harmony_address, harmony_private_key, last_onchain_balance FROM users'
    );

    for (const u of users) {
      try {
        // همیشه آدرس ONE را به HEX تبدیل کن
        const fromHex = normalizeToHex(u.harmony_address);

        // موجودی فعلی شبکه
        const balanceWei = await web3.eth.getBalance(fromHex);
        const chainBalance = Number(web3.utils.fromWei(balanceWei, 'ether'));

        const lastBalance = Number(u.last_onchain_balance || 0);

        // اگر موجودی زیاد شده → دیپازیت جدید
        if (chainBalance > lastBalance) {
          const diff = chainBalance - lastBalance;

          console.log(`Deposit detected for user ${u.id}: ${diff} ONE`);

          // آپدیت دیتابیس
          await db.pool.query(
            'UPDATE users SET internal_balance = internal_balance + ?, last_onchain_balance = ? WHERE id = ?',
            [diff, chainBalance, u.id]
          );

          await db.pool.query(
            'INSERT INTO wallet_ledger (user_id, type, amount, meta) VALUES (?, ?, ?, ?)',
            [u.id, 'deposit', diff, JSON.stringify({ monitor: true })]
          );

          // تلاش برای سوییپ کامل مقدار به هات ولت
          try {
            const txHash = await sweepToHotWallet(
              u.harmony_address,        // ← فقط آدرس ONE
              u.harmony_private_key,    // ← کلید خصوصی صحیح
              diff                       // مقدار سوییپ
            );

            console.log(`Sweep done for user ${u.id}: ${diff} ONE | tx = ${txHash}`);

            await db.pool.query(
              'INSERT INTO wallet_ledger (user_id, type, amount, tx_hash, meta) VALUES (?, ?, ?, ?, ?)',
              [
                u.id,
                'deposit_sweep',
                diff,
                txHash,
                JSON.stringify({ toHotWallet: true }),
              ]
            );

          } catch (sweepErr) {
            console.error(`sweepToHotWallet error for user ${u.id}:`, sweepErr);
          }

        } else if (chainBalance !== lastBalance) {
          // فقط اگر تغییری رخ داده باشد ذخیره می‌کنیم
          await db.pool.query(
            'UPDATE users SET last_onchain_balance = ? WHERE id = ?',
            [chainBalance, u.id]
          );
        }

      } catch (userErr) {
        console.error(`Monitor error for user ${u.id}:`, userErr.message);
      }
    }

  } catch (err) {
    console.error('monitorDepositDifferences error:', err.message);
  }
}

function startMonitor() {
  console.log('Harmony wallet monitor started (unified process)...');

  // هر ۷ ثانیه چک کن
  setInterval(monitorDepositDifferences, 7000);
}

module.exports = startMonitor;
