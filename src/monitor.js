const { web3, sweepToHotWallet } = require('./harmony');
const db = require('./db');

let lastBlock = 0;

function toNumberBlock(value) {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) {
    throw new Error('Invalid block number received from RPC');
  }
  return asNumber;
}


async function scan() {
  try {
    const currentBlock = toNumberBlock(await web3.eth.getBlockNumber());

    if (lastBlock === 0) {
      // دفعه اول از آخرین بلاک شروع می‌کنیم
      lastBlock = currentBlock;
      console.log('Monitor initial block:', lastBlock);
      return;
    }

    for (let i = lastBlock; i <= currentBlock; i++) {
      const block = await web3.eth.getBlock(i, true);
      if (!block || !block.transactions) continue;

      console.log('Scanning block', i, 'tx count:', block.transactions.length);

      for (const tx of block.transactions) {
        await processTx(tx);
      }
    }

    lastBlock = currentBlock + 1;
  } catch (err) {
    console.error('Monitor scan error:', err.message);
  }
}

async function processTx(tx) {
  if (!tx.to || !tx.value) return;

  try {
    const toAddress = tx.to.toLowerCase();

    const user = await db.getUserByHarmonyAddress(toAddress);
    if (!user) return;

    const amountOne = Number(web3.utils.fromWei(tx.value, 'ether'));

    if (amountOne <= 0) return;

    console.log(
      `Deposit detected -> userId=${user.id} address=${toAddress} amount=${amountOne}`
    );

    // افزایش موجودی داخلی و ثبت در لجر
    await db.pool.query(
      'UPDATE users SET internal_balance = internal_balance + ? WHERE id = ?',
      [amountOne, user.id]
    );

    await db.pool.query(
      'INSERT INTO wallet_ledger (user_id, type, amount, tx_hash, meta) VALUES (?, ?, ?, ?, ?)',
      [user.id, 'deposit', amountOne, tx.hash, JSON.stringify({ from: tx.from })]
    );

    // حالا sweep از ولت کاربر به هات‌ولت
    await sweepUserWallet(user, amountOne);
  } catch (err) {
    console.error('processTx error:', err.message);
  }
}

async function sweepUserWallet(user, amountOne) {
  try {
    // برای ساده‌سازی: کل مبلغ را سوییپ می‌کنیم
    const txHash = await sweepToHotWallet(
      user.harmony_address,
      user.harmony_private_key,
      amountOne
    );

    console.log(
      `Sweep done for userId=${user.id} amount=${amountOne} tx=${txHash}`
    );

    await db.pool.query(
      'INSERT INTO wallet_ledger (user_id, type, amount, tx_hash, meta) VALUES (?, ?, ?, ?, ?)',
      [
        user.id,
        'deposit_sweep',
        amountOne,
        txHash,
        JSON.stringify({ toHotWallet: true }),
      ]
    );
  } catch (err) {
    console.error('sweepUserWallet error:', err.message);
  }
}

// اجرای دوره‌ای
setInterval(scan, 7000);

console.log('Harmony deposit monitor started...');
