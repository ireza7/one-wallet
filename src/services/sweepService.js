const axios = require('axios');
const db = require('../db');
const { deriveWallet } = require('./hdWallet');
const { sendTransaction } = require('./harmonyService');
const { HARMONY_RPC_URL, HOT_WALLET_ADDRESS } = require('../config/env');

async function getIncomingTxs(address) {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'hmy_getTransactionsHistory',
    params: [{
      address,
      pageIndex: 0,
      pageSize: 100,
      fullTx: true,
      txType: 'RECEIVED'
    }]
  };

  const res = await axios.post(HARMONY_RPC_URL, payload);
  const txs = res.data.result?.transactions || [];

  return txs
    .filter(tx => tx.to && tx.to.toLowerCase() === address.toLowerCase())
    .map(tx => ({
      hash: tx.hash,
      from: tx.from,
      amount: Number(tx.value) / 1e18,
      blockNumber: parseInt(tx.blockNumber, 16)
    }));
}

async function sweepUserDeposits(user) {
  const depositAddress = user.deposit_address;

  const depositTxs = await getIncomingTxs(depositAddress);
  const newTxs = [];

  for (const tx of depositTxs) {
    const exists = await db.query(
      'SELECT id FROM deposit_txs WHERE tx_hash = ? LIMIT 1',
      [tx.hash]
    );
    if (exists.length > 0) continue;

    await db.query(
      `INSERT INTO deposit_txs (user_id, tx_hash, amount, from_address, to_address, block_number, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [user.id, tx.hash, tx.amount, tx.from, depositAddress, tx.blockNumber]
    );

    newTxs.push(tx);
  }

  for (const tx of newTxs) {
    try {
      const childWallet = deriveWallet(user.id);
      const sweepRes = await sendTransaction(
        childWallet.privateKey,
        HOT_WALLET_ADDRESS,
        tx.amount
      );

      await db.query(
        'UPDATE deposit_txs SET status = "SWEEPED" WHERE tx_hash = ?',
        [tx.hash]
      );

      await db.query(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [tx.amount, user.id]
      );

      await db.query(
        `INSERT INTO transactions (user_id, tx_hash, tx_type, amount, from_address, to_address, status)
         VALUES (?, ?, 'DEPOSIT', ?, ?, ?, 'CONFIRMED')`,
        [user.id, sweepRes.txHash, tx.amount, depositAddress, HOT_WALLET_ADDRESS]
      );
    } catch (err) {
      console.error('Sweep error:', err);
      await db.query(
        'UPDATE deposit_txs SET status = "FAILED" WHERE tx_hash = ?',
        [tx.hash]
      );
    }
  }

  return newTxs;
}

module.exports = {
  sweepUserDeposits
};
