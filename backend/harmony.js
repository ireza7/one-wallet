const { Web3 } = require("web3");
const config = require("./config");

const web3 = new Web3(config.harmony.rpcUrl);

// ساخت ولت
async function generateUserWallet() {
  const account = web3.eth.accounts.create();
  return account;
}

// سوییپ از ولت کاربر به هات ولت
async function sweepToHotWallet(fromHex, privateKey, amountOne) {
  const gasPrice = await web3.eth.getGasPrice();   // ← نکته مهم
  const amountWei = web3.utils.toWei(amountOne.toString(), "ether");

  const nonce = await web3.eth.getTransactionCount(fromHex, "pending");

  const tx = {
    from: fromHex,
    to: config.harmony.hotWalletAddress,
    value: amountWei,
    gas: 21000,
    gasPrice: gasPrice,             // ← ضروری برای Harmony
    nonce: nonce,
    chainId: 1666600000             // Harmony Mainnet
  };

  const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  return receipt.transactionHash;
}

// برداشت از هات ولت
async function sendFromHotWallet(toAddress, amountOne) {
  const gasPrice = await web3.eth.getGasPrice();
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
    gasPrice: gasPrice,
    nonce: nonce,
    chainId: 1666600000
  };

  const signedTx = await web3.eth.accounts.signTransaction(
    tx,
    config.harmony.hotWalletPrivateKey
  );

  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  return receipt.transactionHash;
}

module.exports = {
  web3,
  generateUserWallet,
  sweepToHotWallet,
  sendFromHotWallet
};
