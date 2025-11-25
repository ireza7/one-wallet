const { ethers } = require('ethers');
const { HARMONY_RPC_URL } = require('../config/env');
const { oneToHex } = require('../utils/harmonyAddress');

const provider = new ethers.JsonRpcProvider(HARMONY_RPC_URL);

async function getBalance(addressOne) {
  const hex = oneToHex(addressOne);
  const balance = await provider.getBalance(hex);
  return Number(ethers.formatEther(balance));
}

async function sendTransaction(fromPrivateKey, toAddressOneOrHex, amountOne) {
  const wallet = new ethers.Wallet(fromPrivateKey, provider);
  const toHex = oneToHex(toAddressOneOrHex);

  const tx = await wallet.sendTransaction({
    to: toHex,
    value: ethers.parseEther(String(amountOne)),
    gasLimit: 21000n
  });

  const receipt = await tx.wait();
  return {
    txHash: tx.hash,
    confirmation: receipt
  };
}

module.exports = {
  provider,
  getBalance,
  sendTransaction
};
