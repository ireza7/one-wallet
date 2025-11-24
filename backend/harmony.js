const { Web3 } = require("web3");
const config = require("./config");

// ساخت web3 صحیح برای نسخه 4
const web3 = new Web3(config.harmony.rpcUrl);

// ساخت ولت جدید برای کاربر
async function generateUserWallet() {
  const account = web3.eth.accounts.create();
  return account; // { address, privateKey }
}

// ارسال ONE از هات ولت
async function sendFromHotWallet(toAddress, amountOne) {
  if (!config.harmony.hotWalletPrivateKey || !config.harmony.hotWalletAddress) {
    throw new Error("هات ولت تنظیم نشده");
  }

  const amountWei = web3.utils.toWei(amountOne.toString(), "ether");

  const nonce = await web3.eth.getTransactionCount(
    config.harmony.hotWalletAddress,
    "pending"
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

// سوییپ از ولت کاربر به هات ولت
async function sweepToHotWallet(fromAddress, privateKey, amountOne) {
  const amountWei = web3.utils.toWei(amountOne.toString(), "ether");

  const nonce = await web3.eth.getTransactionCount(fromAddress, "pending");

  const tx = {
    from: fromAddress,
    to: config.harmony.hotWalletAddress,
    value: amountWei,
    gas: 21000,
    nonce,
  };

  const signed = await web3.eth.accounts.signTransaction(tx, privateKey);

  const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

  return receipt.transactionHash;
}

module.exports = {
  web3,
  generateUserWallet,
  sendFromHotWallet,
  sweepToHotWallet,
};
