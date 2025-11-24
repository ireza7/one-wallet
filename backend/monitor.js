
const { web3, sweepToHotWallet, normalizeToHex } = require('./harmony');
const db = require('./db');

async function monitorDepositDifferences() {
  try {
    const [users] = await db.pool.query(
      'SELECT id, harmony_address, harmony_private_key, last_onchain_balance FROM users'
    );

    for (const u of users) {
      try {
        const fromHex = normalizeToHex(u.harmony_address);

        const balanceWei = await web3.eth.getBalance(fromHex);
        const chainBalance = Number(web3.utils.fromWei(balanceWei, 'ether'));
        const lastBalance = Number(u.last_onchain_balance || 0);

        if (chainBalance > lastBalance) {
          const diff = chainBalance - lastBalance;
          console.log(`Deposit detected for user ${u.id}: ${diff} ONE`);

          await db.pool.query(
            'UPDATE users SET internal_balance = internal_balance + ?, last_onchain_balance = ? WHERE id = ?',
            [diff, chainBalance, u.id]
          );

          await db.pool.query(
            'INSERT INTO wallet_ledger (user_id, type, amount, meta) VALUES (?, ?, ?, ?)',
            [u.id, 'deposit', diff, JSON.stringify({ monitor: true })]
          );

          try {
            const txHash = await sweepToHotWallet(
              u.harmony_address,
              u.harmony_private_key,
              diff
            );

            console.log(`Sweep done for user ${u.id}: ${diff} ONE | tx=${txHash}`);

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
          await db.pool.query(
            'UPDATE users SET last_onchain_balance = ? WHERE id = ?',
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
  console.log('Harmony wallet monitor started (unified process)...');
  setInterval(monitorDepositDifferences, 7000);
}

module.exports = startMonitor;
