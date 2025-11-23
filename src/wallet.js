const { ethers } = require('ethers');
require('dotenv').config();

const RPC = process.env.HARMONY_RPC || 'https://api.s0.b.hmny.io';
const MNEMONIC = process.env.MNEMONIC || null;
const HOT_PRIVATE_KEY = process.env.HOT_PRIVATE_KEY || null;
const GAS_PRICE_GWEI = process.env.GAS_PRICE_GWEI || '30';

const provider = new ethers.providers.JsonRpcProvider(RPC);
const hotWallet = HOT_PRIVATE_KEY ? new ethers.Wallet(HOT_PRIVATE_KEY, provider) : null;
const hdNode = MNEMONIC ? ethers.utils.HDNode.fromMnemonic(MNEMONIC) : null;

function deriveAddress(index) {
  if (!hdNode) throw new Error('MNEMONIC not set');
  const node = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
  return { address: node.address, privateKey: node.privateKey };
}

async function getBalance(address) {
  const bal = await provider.getBalance(address);
  return bal.toString(); // wei as string
}

async function sendTx(wallet, to, valueWei, gasLimit = 210000) {
  if (!wallet) throw new Error('wallet not available');
  const gasPrice = ethers.utils.parseUnits(String(GAS_PRICE_GWEI), 'gwei');
  const tx = {
    to,
    value: ethers.BigNumber.from(String(valueWei)),
    gasLimit: ethers.BigNumber.from(String(gasLimit)),
    gasPrice
  };
  const sent = await wallet.sendTransaction(tx);
  await sent.wait();
  return sent.hash;
}

async function sweepAddress(derivedPrivateKey, fromAddress, toHotAddress) {
  if (!derivedPrivateKey) throw new Error('derived private key required');
  if (!toHotAddress) throw new Error('toHotAddress required');
  const wallet = new ethers.Wallet(derivedPrivateKey, provider);
  const bal = await provider.getBalance(fromAddress);
  if (bal.isZero()) return null;
  // estimate simple gas
  const gasPrice = ethers.utils.parseUnits(String(GAS_PRICE_GWEI), 'gwei');
  const gasLimit = ethers.BigNumber.from(21000);
  const gasCost = gasPrice.mul(gasLimit);
  if (bal.lte(gasCost)) return null;
  const sendAmount = bal.sub(gasCost);
  const tx = {
    to: toHotAddress,
    value: sendAmount,
    gasLimit,
    gasPrice
  };
  const sent = await wallet.sendTransaction(tx);
  await sent.wait();
  return sent.hash;
}

module.exports = { provider, hotWallet, deriveAddress, getBalance, sendTx, sweepAddress };
