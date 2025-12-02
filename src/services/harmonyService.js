const { ethers } = require('ethers');
const { HARMONY_RPC_URL } = require('../config/env');
const { oneToHex } = require('../utils/harmonyAddress');

// تنظیمات Provider با Timeout (اختیاری اگر نسخه ethers ساپورت کند، اما خود axios در لایه زیرین دارد)
const provider = new ethers.JsonRpcProvider(HARMONY_RPC_URL);

// تابع کمکی برای تلاش مجدد (Retry)
async function withRetry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    console.warn(`RPC Error. Retrying in ${delay}ms...`, err.message);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
  }
}

async function getBalance(addressOne) {
  return withRetry(async () => {
    const hex = oneToHex(addressOne);
    const balance = await provider.getBalance(hex);
    return Number(ethers.formatEther(balance));
  });
}

async function sendTransaction(fromPrivateKey, toAddressOneOrHex, amountOne) {
  return withRetry(async () => {
    const wallet = new ethers.Wallet(fromPrivateKey, provider);
    const toHex = oneToHex(toAddressOneOrHex);
    const valueWei = ethers.parseEther(String(amountOne));

    // 1. محاسبه دقیق Gas Limit
    let gasLimit;
    try {
      gasLimit = await wallet.estimateGas({
        to: toHex,
        value: valueWei
      });
      // کمی بافر اضافه می‌کنیم (مثلا 20%)
      gasLimit = (gasLimit * 120n) / 100n; 
    } catch (e) {
      // اگر تخمین خطا داد (مثلا موجودی کافی نیست)، fallback به مقدار ثابت
      console.warn("Gas estimate failed, using default 25000");
      gasLimit = 25000n;
    }

    // 2. دریافت Fee Data (برای شبکه‌های EIP-1559 یا Legacy)
    const feeData = await provider.getFeeData();
    
    // ارسال تراکنش
    const tx = await wallet.sendTransaction({
      to: toHex,
      value: valueWei,
      gasLimit: gasLimit,
      gasPrice: feeData.gasPrice // استفاده از قیمت لحظه‌ای شبکه
    });

    // منتظر ماندن برای کانفرم (1 بلاک)
    const receipt = await tx.wait(1);
    
    return {
      txHash: tx.hash,
      confirmation: receipt
    };
  });
}

module.exports = {
  provider,
  getBalance,
  sendTransaction
};