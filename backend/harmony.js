
const { Web3 } = require('web3');
const config = require('./config');
const { hexToBech32, bech32ToHex } = require('./utils/harmonyAddress');

const web3 = new Web3(config.harmony.rpcUrl);

async function generateUserWallet() {
  const account = web3.eth.accounts.create();
  const hexAddress = account.address.toLowerCase();
  const bech32Address = hexToBech32(hexAddress);

  return {
    address: bech32Address,
    hexAddress: hexAddress,
    privateKey: account.privateKey,
  };
}

function normalizeToHex(address) {
  if (!address) throw new Error('empty address');
  const lower = address.trim().toLowerCase();

  if (lower.startsWith('0x')) return lower;
  if (lower.startsWith('one1')) return bech32ToHex(lower);

  throw new Error('unsupported address format');
}

async function sendFromHotWallet(toAddressInput, amountOne) {
  if (!config.harmony.hotWalletPrivateKey || !config.harmony.hotWalletAddress) {
    throw new Error('هات ولت تنظیم نشده است');
  }

  const toHex = normalizeToHex(toAddressInput);
  const amountWei = web3.utils.toWei(amountOne.toString(), 'ether');
  const gasPrice = await web3.eth.getGasPrice();
  const nonce = await web3.eth.getTransactionCount(
    config.harmony.hotWalletAddress,
    'pending'
  );

  const tx = {
    from: config.harmony.hotWalletAddress,
    to: toHex,
    value: amountWei,
    gas: 21000,
    gasPrice,
    nonce,
    chainId: config.harmony.chainId,
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

async function sweepToHotWallet(fromHex, privateKey, amountOne) {
  if (!config.harmony.hotWalletAddress) {
    throw new Error('هات ولت تنظیم نشده است');
  }

  const amountWei = web3.utils.toWei(amountOne.toString(), 'ether');
  const gasPrice = await web3.eth.getGasPrice();
  const nonce = await web3.eth.getTransactionCount(fromHex, 'pending');

  const tx = {
    from: fromHex,
    to: config.harmony.hotWalletAddress,
    value: amountWei,
    gas: 21000,
    gasPrice,
    nonce,
    chainId: config.harmony.chainId,
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
  normalizeToHex,
};
