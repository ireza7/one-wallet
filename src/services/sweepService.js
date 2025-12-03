const axios = require("axios");
const db = require("../db");
const { deriveWallet } = require("./hdWallet");
const { sendTransaction, provider, getBalance } = require("./harmonyService");
const { HARMONY_RPC_URL, HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS } = require("../config/env");
const { ethers } = require("ethers");

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

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

async function sendGasToChild(childWallet) {
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("100", "gwei");
  const gasLimit = 21000n;

  const requiredGasWei = gasPrice * gasLimit;
  const requiredGasONE = Number(ethers.formatEther(requiredGasWei * 2n));

  return await sendTransaction(
    HOT_WALLET_PRIVATE_KEY,
    childWallet.oneAddress,
    requiredGasONE
  );
}

async function sweepUserDeposits(user) {
  const [freshUserRows] = await db.query(
    "SELECT sweep_lock, sweep_lock_ts FROM users WHERE id = ? LIMIT 1",
    [user.id]
  );
  const freshUser = freshUserRows[0] || user;

  const now = Date.now();
  const isLocked = freshUser.sweep_lock === 1;
  const lockTime = Number(freshUser.sweep_lock_ts || 0);

  if (isLocked && (now - lockTime < LOCK_TIMEOUT_MS)) {
    return { ok: false, error: "SWEEP_IN_PROGRESS" };
  }

  await db.query(
    "UPDATE users SET sweep_lock = 1, sweep_lock_ts = ? WHERE id = ?",
    [now, user.id]
  );

  try {
    const incoming = await getIncomingTxs(user.deposit_address);
    const newTxs = [];

    for (const tx of incoming) {
      const exists = await db.query(
        "SELECT id FROM deposit_txs WHERE tx_hash = ? LIMIT 1",
        [tx.hash]
      );
      if (exists.length === 0) {
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

    const childWallet = deriveWallet(user.id);
    const totalBalance = await getBalance(childWallet.oneAddress);

    if (totalBalance < 0.001) {
      return newTxs;
    }

    await sendGasToChild(childWallet);

    await new Promise(r => setTimeout(r, 2000));

    const newBalance = await getBalance(childWallet.oneAddress);
    const feeData = await provider.getFeeData();
    const gasLimit = 21000n;
    const gasPrice = feeData.gasPrice || ethers.parseUnits("100", "gwei");
    const gasCost = gasPrice * gasLimit;

    const amountToSendWei = ethers.parseEther(String(newBalance)) - gasCost;

    if (amountToSendWei <= 0n) {
      return newTxs;
    }

    const childSigner = new ethers.Wallet(childWallet.privateKey, provider);
    const sweepTx = await childSigner.sendTransaction({
      to: HOT_WALLET_ADDRESS,
      value: amountToSendWei,
      gasLimit: gasLimit,
      gasPrice: gasPrice
    });

    await sweepTx.wait();

    const sumDeposits = newTxs.reduce((a, t) => a + t.amount, 0);

    await db.query(
      "UPDATE users SET balance = balance + ? WHERE id = ?",
      [sumDeposits, user.id]
    );

    for (const tx of newTxs) {
      await db.query(
        "UPDATE deposit_txs SET status = 'SWEEPED' WHERE tx_hash = ?",
        [tx.hash]
      );
    }

    await db.query(
      `INSERT INTO transactions 
       (user_id, tx_hash, tx_type, amount, from_address, to_address, status)
       VALUES (?, ?, 'DEPOSIT', ?, ?, ?, 'CONFIRMED')`,
      [user.id, sweepTx.hash, sumDeposits, user.deposit_address, HOT_WALLET_ADDRESS]
    );

    return newTxs;

  } catch (err) {
    console.error("[Sweep ERROR]:", err);
    return { ok: false, error: err.message };

  } finally {
    await db.query(
      "UPDATE users SET sweep_lock = 0, sweep_lock_ts = 0 WHERE id = ?",
      [user.id]
    );
  }
}

module.exports = {
  sweepUserDeposits
};