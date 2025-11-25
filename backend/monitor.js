const { getBalance, sweepToHotWallet, normalizeToHex } = require('./harmony');
const db = require('./db');

/**
 * این تابع به‌صورت دوره‌ای موجودی آن‌چین کاربران را بررسی می‌کند
 * و افزایش موجودی را به‌عنوان «واریز» (deposit) ثبت می‌کند و سپس
 * در صورت امکان آن را به هات‌ولت sweep می‌کند.
 */
async function monitorDepositDifferences() {
  try {
    const [users] = await db.pool.query(
      'SELECT id, harmony_address, harmony_private_key, last_onchain_balance FROM users'
    );

    for (const u of users) {
      try {
        // دریافت موجودی فعلی آن‌چین به واحد ONE
        const balanceStr = await getBalance(u.harmony_address);
        const chainBalance = Number(balanceStr);
        const lastBalance = Number(u.last_onchain_balance || 0);

        if (!Number.isFinite(chainBalance)) {
          console.error(`chainBalance NaN for user ${u.id}:`, balanceStr);
          continue;
        }

        // اگر افزایش موجودی داشتیم → واریز جدید
        if (chainBalance > lastBalance + 1e-12) {
          const diff = chainBalance - lastBalance;

          console.log(
            `User ${u.id} deposit detected: +${diff} (from ${lastBalance} to ${chainBalance})`
          );

          await db.pool.query(
            `UPDATE users SET last_onchain_balance = ?, internal_balance = internal_balance + ?
             WHERE id = ?`,
            [chainBalance, diff, u.id]
          );

          await db.pool.query(
            `INSERT INTO wallet_ledger (user_id, type, amount, tx_hash, meta)
             VALUES (?, 'deposit', ?, NULL, JSON_OBJECT('from', ?))`,
            [u.id, diff, u.harmony_address]
          );

          // تلاش می‌کنیم مبلغ را به هات‌ولت sweep کنیم
          try {
            const sweepTxHash = await sweepToHotWallet(
              u.harmony_address,
              u.harmony_private_key,
              diff
            );

            await db.pool.query(
              `INSERT INTO wallet_ledger (user_id, type, amount, tx_hash, meta)
               VALUES (?, 'deposit_sweep', ?, ?, JSON_OBJECT('from', ?, 'to', ?))`,
              [u.id, diff, sweepTxHash, u.harmony_address, require('./config').harmony.hotWalletAddress]
            );

            console.log(`Sweep for user ${u.id} done, tx: ${sweepTxHash}`);
          } catch (sweepErr) {
            console.error(`sweepToHotWallet failed for user ${u.id}:`, sweepErr.message);
          }
        } else if (Math.abs(chainBalance - lastBalance) > 1e-12) {
          // اگر کاهش یا تغییر دیگری بوده فقط sync می‌کنیم تا وضعیت همگام بماند
          await db.pool.query(
            `UPDATE users SET last_onchain_balance = ? WHERE id = ?`,
            [chainBalance, u.id]
          );
        }
      } catch (userErr) {
        console.error(`monitor user error: ${u.id}`, userErr.message);
      }
    }
  } catch (err) {
    console.error('monitorDepositDifferences error:', err.message);
  }
}

function startMonitor() {
  console.log('Harmony wallet monitor started (standalone process)...');
  setInterval(monitorDepositDifferences, 7000);
}

module.exports = startMonitor;
