const axios = require("axios");
const db = require("../db");
const { deriveWallet } = require("./hdWallet");
const { sendTransaction, provider, getBalance } = require("./harmonyService");
const { HARMONY_RPC_URL, HOT_WALLET_PRIVATE_KEY, HOT_WALLET_ADDRESS } = require("../config/env");
const { ethers } = require("ethers");

// تنظیم زمان انقضای قفل (مثلا 10 دقیقه به میلی‌ثانیه)
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

async function getIncomingTxs(addressOne) {
    // همان کد قبلی شما بدون تغییر
    const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "hmy_getTransactionsHistory",
        params: [{
            address: addressOne,
            pageIndex: 0,
            pageSize: 50, // کاهش پیج سایز برای سرعت
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

async function sendGasToChild(childWallet, amountToSweep) {
    // محاسبه دقیق‌تر گس برای انتقال نهایی
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits("100", "gwei"); // Fallback
    const gasLimit = 21000n; // استاندارد انتقال ONE
    
    // هزینه تراکنش به Wei
    const requiredGasWei = gasPrice * gasLimit;
    // تبدیل به ONE و اضافه کردن کمی بافر اطمینان (مثلا 2 برابر برای نوسان)
    const requiredGasONE = Number(ethers.formatEther(requiredGasWei * 2n));

    // چک کنیم شاید Child از قبل گس داشته باشد
    const currentChildBalance = await getBalance(childWallet.oneAddress);
    
    // موجودی Child باید برابر باشد با (مبلغی که می‌خواهیم برداریم + هزینه گس)
    // اما چون Child خودش فقط توکن دریافت کرده، موجودی‌اش برابر amountToSweep است.
    // ما باید `requiredGasONE` را به آن اضافه کنیم تا بتواند کل `amountToSweep` را بفرستد
    // یا اینکه از `amountToSweep` هزینه گس را کم کنیم؟
    // روش شما: gas را واریز می‌کنید تا کل موجودی sweep شود.
    
    // اگر موجودی Child کمتر از چیزی است که بتواند گس را پرداخت کند، ما گس می‌فرستیم
    // در روش "Sweep کامل"، Child موجودی مثلا 100 دارد. ما باید Gas بفرستیم تا موجودی بشود 100 + GasFee
    // سپس Child مبلغ 100 را می‌فرستد (و GasFee صرف شبکه می‌شود).
    
    console.log(`[Gas] Sending ~${requiredGasONE} ONE for gas fees.`);
    
    return await sendTransaction(
        HOT_WALLET_PRIVATE_KEY,
        childWallet.oneAddress,
        requiredGasONE
    );
}

async function sweepUserDeposits(user) {
    console.log(`\n===== Checking deposits for USER ${user.id} =====`);

    // 1. بررسی قفل با Time Check
    // ستون last_sweep_start را باید به دیتابیس اضافه کنیم یا از منطق زیر استفاده کنیم:
    // فرض: اگر lock=1 است اما زمان زیادی گذشته، یعنی قفل گیر کرده.
    const now = Date.now();
    
    // برای سادگی از همان فیلد sweep_lock استفاده می‌کنیم ولی اگر نیاز بود فیلد زمانی اضافه کنید.
    // اینجا فرض می‌کنیم اگر قفل است، چک می‌کنیم چقدر گذشته (نیاز به فیلد جدید در DB دارد).
    // فعلا با همان منطق ساده + باز کردن قفل در finally پیش می‌رویم.
    
    if (user.sweep_lock === 1) {
        // اگر فیلد lock_timestamp داشتید می‌توانستید اینجا چک کنید.
        console.log(`User ${user.id} is locked.`);
        return { ok: false, error: "SWEEP_IN_PROGRESS" };
    }

    await db.query("UPDATE users SET sweep_lock = 1 WHERE id = ?", [user.id]);

    try {
        const incoming = await getIncomingTxs(user.deposit_address);
        const newTxs = [];

        for (const tx of incoming) {
            // چک تکراری بودن
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

        // محاسبه موجودی واقعی در شبکه
        const childWallet = deriveWallet(user.id);
        const totalBalance = await getBalance(childWallet.oneAddress);

        if (totalBalance < 0.001) { // حداقل موجودی برای ارزش داشتن Sweep
             console.log("Balance too low to sweep.");
             // فقط TX ها را به عنوان "ثبت شده ولی برداشت نشده" نگه می‌داریم؟ 
             // یا بهتر است وضعیت آنها را به 'SKIPPED' تغییر دهیم.
             return newTxs;
        }

        // ارسال گس
        await sendGasToChild(childWallet, totalBalance);

        // کمی صبر برای نشستن گس
        await new Promise(r => setTimeout(r, 2000));

        // انجام Sweep
        // نکته: برای جلوگیری از خطای 'insufficient funds'، باید موجودی دقیق جدید را بگیریم
        // و هزینه گس تراکنش برگشت را از آن کم کنیم.
        const newBalance = await getBalance(childWallet.oneAddress);
        const feeData = await provider.getFeeData();
        const gasLimit = 21000n;
        const gasCost = feeData.gasPrice * gasLimit;
        
        // مبلغ قابل برداشت = موجودی کل - هزینه گس
        const amountToSendWei = ethers.parseEther(String(newBalance)) - gasCost;
        const amountToSend = ethers.formatEther(amountToSendWei);

        if (Number(amountToSend) <= 0) {
            throw new Error("Gas calculation error, negative amount to send");
        }

        const childSigner = new ethers.Wallet(childWallet.privateKey, provider);
        const sweepTx = await childSigner.sendTransaction({
            to: HOT_WALLET_ADDRESS,
            value: amountToSendWei,
            gasLimit: gasLimit,
            gasPrice: feeData.gasPrice
        });
        
        await sweepTx.wait();
        console.log(`[Sweep] SUCCESS: ${sweepTx.hash}`);

        // آپدیت دیتابیس
        const sumDeposits = newTxs.reduce((a, t) => a + t.amount, 0);

        // استفاده از Atomic Update برای اضافه کردن به بالانس
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
        // باز کردن قفل در هر شرایطی
        await db.query("UPDATE users SET sweep_lock = 0 WHERE id = ?", [user.id]);
    }
}

module.exports = {
    sweepUserDeposits
};