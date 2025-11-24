const { Web3 } = require('web3');
const config = require('./config');

const web3 = new Web3(
  new Web3.HttpProvider(config.harmony.rpcUrl)
);

// ساخت ولت جدید برای کاربر
async function generateUserWallet() {
  const account = web3.eth.accounts.create();
  return account; // { address, privateKey }
}

// ارسال ONE از هات‌ولت به آدرس کاربر (برداشت)
async function sendFromHotWallet(toAddress, amountOne) {
  if (!config.harmony.hotWalletPrivateKey || !config.harmony.hotWalletAddress) {
    throw new Error('پیکربندی هات‌ولت ناقص است');
  }

  const amountWei = web3.utils.toWei(amountOne.toString(), 'ether');

  const nonce = await web3.eth.getTransactionCount(
    config.harmony.hotWalletAddress,
    'pending'
  );

  const tx = {
    from: config.harmony.hotWalletAddress,
    to: toAddress,
    value: amountWei,
    gas: 21000,
    nonce,
  };

  const signed = await web3.eth.accounts.signTransaction(
    tx,
    config.harmony.hotWalletPrivateKey
  );

  const receipt = await web3.eth.sendSignedTransaction(
    signed.rawTransaction
  );

  return receipt.transactionHash;
}

// ارسال ONE از ولت کاربر به هات‌ولت (برای sweep)
async function sweepToHotWallet(fromAddress, privateKey, amountOne) {
  if (!config.harmony.hotWalletAddress) {
    throw new Error('هات‌ولت تنظیم نشده است');
  }

  const amountWei = web3.utils.toWei(amountOne.toString(), 'ether');

  const nonce = await web3.eth.getTransactionCount(fromAddress, 'pending');

  const tx = {
    from: fromAddress,
    to: config.harmony.hotWalletAddress,
    value: amountWei,
    gas: 21000,
    nonce,
  };

  const signed = await web3.eth.accounts.signTransaction(
    tx,
    privateKey
  );

  const receipt = await web3.eth.sendSignedTransaction(
    signed.rawTransaction
  );

  return receipt.transactionHash;
}

module.exports = {
  web3,
  generateUserWallet,
  sendFromHotWallet,
  sweepToHotWallet,
};
