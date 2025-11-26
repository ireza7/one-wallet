const axios = require("axios");
const db = require("../db");
const { deriveWallet } = require("./hdWallet");
const { sendTransaction, provider, getBalance } = require("./harmonyService");
const { HARMONY_RPC_URL, HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS } = require("../config/env");
const { ethers } = require("ethers");


// ==================================================
// دریافت تراکنش‌های ورودی
// ==================================================
async function getIncomingTxs(addressOne) {
    const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "hmy_getTransactionsHistory",
        params: [{
            address: addressOne,
            pageIndex: 0,
            pageSize: 100,
            fullTx: true,
            txType: "RECEIVED"
        }]
    };

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
}


// ==================================================
// ارسال گس کافی (Dynamic)
// ==================================================
async function sendGasToChild(childWallet) {
    const fee = await provider.getFeeData();
    const gasPrice = fee.gasPrice;
    const gasLimit = 21000n;

    const requiredGasWei = gasPrice * gasLimit;
    const requiredGasONE = Number(ethers.formatEther(requiredGasWei));

    const gasToSend = requiredGasONE + 0.001;

    console.log(`[Gas] GasPrice: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
    console.log(`[Gas] Sending: ${gasToSend} ONE`);

    return await sendTransaction(
        HOT_WALLET_PRIVATE_KEY,
        childWallet.oneAddress,
        gasToSend
    );
}


// ==================================================
// Sweep یکبار برای کل موجودی + سیستم Anti-Double-Sweep
// ==================================================
async function sweepUserDeposits(user) {

    console.log(`\n===== Checking deposits for USER ${user.id} (${user.deposit_address}) =====`);

    // -------------------------------------------------------
    // Anti-Double-Sweep: Lock check
    // -------------------------------------------------------
    const lockRow = await db.query(
        "SELECT sweep_lock FROM users WHERE id = ? LIMIT 1",
        [user.id]
    );

    if (lockRow[0].sweep_lock === 1) {
        console.log(`[Anti-Double-Sweep] User ${user.id} is already sweeping. Blocking.`);
        return { ok: false, error: "SWEEP_IN_PROGRESS" };
    }

    // SET LOCK = 1
    await db.query(
        "UPDATE users SET sweep_lock = 1 WHERE id = ?",
        [user.id]
    );

    console.log(`[Lock] Sweep lock ENABLED for user ${user.id}`);

    try {

        // 1) دریافت واریزهای جدید
        const incoming = await getIncomingTxs(user.deposit_address);
        const newTxs = [];

        for (const tx of incoming) {
            const exists = await db.query(
                "SELECT id FROM deposit_txs WHERE tx_hash = ? LIMIT 1",
                [tx.hash]
            );
            if (exists.length > 0) continue;

            await db.query(
                `INSERT INTO deposit_txs 
                (user_id, tx_hash, amount, from_address, to_address, block_number, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
                [user.id, tx.hash, tx.amount, tx.from, user.deposit_address, tx.blockNumber]
            );

            newTxs.push(tx);
        }

        if (newTxs.length === 0) {
            console.log("No new deposits.");
            return [];
        }

        console.log(`Found ${newTxs.length} NEW deposits.`);

        // 2) موجودی کل child wallet
        const childWallet = deriveWallet(user.id);
        const totalBalance = await getBalance(childWallet.oneAddress);

        console.log(`[Sweep] Child balance = ${totalBalance} ONE`);

        if (totalBalance <= 0) {
            return newTxs;
        }

        // 3) ارسال گس (فقط یک بار)
        await sendGasToChild(childWallet);

        // 4) Sweep یکجا
        const sweepTx = await sendTransaction(
            childWallet.privateKey,
            HOT_WALLET_ADDRESS,
            totalBalance
        );

        console.log(`[Sweep] SUCCESS: ${sweepTx.txHash}`);

        // 5) ثبت تمام واریزها
        const sumDeposits = newTxs.reduce((a, t) => a + t.amount, 0);

        for (const tx of newTxs) {
            await db.query(
                "UPDATE deposit_txs SET status = 'SWEEPED' WHERE tx_hash = ?",
                [tx.hash]
            );
        }

        await db.query(
            "UPDATE users SET balance = balance + ? WHERE id = ?",
            [sumDeposits, user.id]
        );

        await db.query(
            `INSERT INTO transactions 
             (user_id, tx_hash, tx_type, amount, from_address, to_address, status)
             VALUES (?, ?, 'DEPOSIT', ?, ?, ?, 'CONFIRMED')`,
            [user.id, sweepTx.txHash, sumDeposits, user.deposit_address, HOT_WALLET_ADDRESS]
        );

        return newTxs;

    } catch (err) {

        console.error("[Sweep ERROR]:", err);

        return { ok: false, error: err.message };

    } finally {

        // -------------------------------------------------------
        // Anti-Double-Sweep: Unlock
        // -------------------------------------------------------
        await db.query(
            "UPDATE users SET sweep_lock = 0 WHERE id = ?",
            [user.id]
        );

        console.log(`[Lock] Sweep lock DISABLED for user ${user.id}`);
    }
}


// ==================================================
module.exports = {
    sweepUserDeposits
};
