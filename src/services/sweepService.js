const axios = require("axios");
const db = require("../db");
const { deriveWallet } = require("./hdWallet");
const { sendTransaction, provider } = require("./harmonyService");
const { HARMONY_RPC_URL, HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS } = require("../config/env");
const { ethers } = require("ethers");


// =====================================
// گرفتن تراکنش‌های ورودی Deposit
// =====================================
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


// ==========================================================
// ارسال گس کافی به child wallet قبل از Sweep (Dynamic Gas)
// ==========================================================
async function sendGasToChild(childWallet) {
    try {
        const gasPrice = await provider.getGasPrice(); // BigInt
        const gasLimit = 21000n;

        const requiredGasWei = gasPrice * gasLimit;
        const requiredGasONE = Number(ethers.formatEther(requiredGasWei));

        // اضافه کردن 0.001 ONE به عنوان بافر امن
        const gasToSend = requiredGasONE + 0.001;

        console.log("------------------------------------------------------------");
        console.log("[Gas Transfer] GasPrice:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("[Gas Transfer] Required gas:", requiredGasONE, "ONE");
        console.log("[Gas Transfer] Sending:", gasToSend, "ONE");
        console.log("[Gas Transfer] To child wallet:", childWallet.oneAddress);
        console.log("------------------------------------------------------------");

        const tx = await sendTransaction(
            HOT_WALLET_PRIVATE_KEY,
            childWallet.oneAddress,
            gasToSend
        );

        console.log("[Gas Transfer] TX Hash:", tx.txHash);

        return tx;
    } catch (err) {
        console.error("ERROR sending gas to child wallet:", err);
        throw new Error("خطا در ارسال گس به ولت کاربر");
    }
}


// =====================================
// Sweep انجام تراکنش
// =====================================
async function sweepUserDeposits(user) {

    console.log(`\n===== Checking deposits for USER ${user.id} @ ${user.deposit_address} =====\n`);

    const incoming = await getIncomingTxs(user.deposit_address);
    const newTxs = [];

    // 1) شناسایی تراکنش‌های جدید
    for (const tx of incoming) {
        const exists = await db.query(
            "SELECT id FROM deposit_txs WHERE tx_hash = ? LIMIT 1",
            [tx.hash]
        );

        if (exists.length > 0) continue;

        await db.query(
            `INSERT INTO deposit_txs (user_id, tx_hash, amount, from_address, to_address, block_number, status)
             VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
            [user.id, tx.hash, tx.amount, tx.from, user.deposit_address, tx.blockNumber]
        );

        newTxs.push(tx);
    }


    if (newTxs.length === 0) {
        console.log("No new deposits found.");
        return [];
    }

    console.log(`Found ${newTxs.length} NEW deposit(s). Starting sweep process...`);

    // 2) Sweep هر تراکنش جدید
    for (const tx of newTxs) {
        try {
            const childWallet = deriveWallet(user.id);

            console.log(`\n--- Processing TX ${tx.hash} for user ${user.id} ---`);
            console.log("Child wallet:", childWallet.oneAddress);

            // مرحله 1 → ارسال گس کافی
            await sendGasToChild(childWallet);

            // مرحله 2 → Sweep واقعی
            const sweepRes = await sendTransaction(
                childWallet.privateKey,
                HOT_WALLET_ADDRESS,
                tx.amount
            );

            console.log("[Sweep] Success TX Hash:", sweepRes.txHash);

            // مرحله 3 → بروزرسانی دیتابیس
            await db.query(
                "UPDATE deposit_txs SET status = 'SWEEPED' WHERE tx_hash = ?",
                [tx.hash]
            );

            await db.query(
                "UPDATE users SET balance = balance + ? WHERE id = ?",
                [tx.amount, user.id]
            );

            await db.query(
                `INSERT INTO transactions (user_id, tx_hash, tx_type, amount, from_address, to_address, status)
                 VALUES (?, ?, 'DEPOSIT', ?, ?, ?, 'CONFIRMED')`,
                [user.id, sweepRes.txHash, tx.amount, user.deposit_address, HOT_WALLET_ADDRESS]
            );

        } catch (err) {
            console.error("\n[Sweep ERROR]:", err);

            await db.query(
                "UPDATE deposit_txs SET status = 'FAILED' WHERE tx_hash = ?",
                [tx.hash]
            );
        }
    }

    return newTxs;
}


// =====================================
module.exports = {
    sweepUserDeposits
};
