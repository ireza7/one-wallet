const { getPool } = require('./db');
const Wallet = require('./wallet');

async function checkAndSweep() {
  const pool = getPool();
  const [addrs] = await pool.query('SELECT a.*, u.id as user_id FROM addresses a JOIN users u ON a.user_id = u.id');
  for (const a of addrs) {
    try {
      const bal = await Wallet.getBalance(a.address);
      if (BigInt(bal) > 0n) {
        const derived = Wallet.deriveAddress(a.derivation_index);
        const txHash = await Wallet.sweepAddress(derived.privateKey, a.address, Wallet.hotWallet.address);
        if (txHash) {
          await pool.query('INSERT INTO txs (txid, from_address, to_address, amount_wei, kind, user_id) VALUES (?,?,?,?,?,?)',
            [txHash, a.address, Wallet.hotWallet.address, bal, 'sweep', a.user_id]);
          await pool.query('UPDATE accounts SET balance_wei = CAST(balance_wei AS DECIMAL(38,0)) + ? WHERE user_id = ?', [bal, a.user_id]);
          console.log(`swept ${a.address} => hot (${txHash})`);
        }
      }
    } catch (e) {
      console.error('Error sweep:', e && e.message ? e.message : e);
    }
  }
}

module.exports = { checkAndSweep };
