const Web3 = require('web3');
const { fromBech32, toChecksumAddress, toBech32 } = require('@harmony-js/crypto');
const config = require('./config');

const web3 = new Web3(new Web3.providers.HttpProvider(config.harmony.rpcUrl));

/**
 * تبدیل آدرس Harmony به hex
 * ورودی می‌تواند bech32 (one1..) یا hex (0x..) باشد
 */
function normalizeToHex(address) {
  if (!address) {
    throw new Error('آدرس نامعتبر است');
  }

  const addr = address.trim();

  // اگر آدرس با 0x شروع می‌شود، همان را برمی‌گردانیم
  if (addr.startsWith('0x')) {
    return toChecksumAddress(addr);
  }

  // اگر فرمت Harmony باشد → تبدیل به 0x
  if (addr.startsWith('one1')) {
    try {
      const hex = fromBech32(addr);
      return toChecksumAddress(hex);
    } catch (err) {
      throw new Error(`تبدیل آدرس bech32 به hex ناموفق بود: ${err.message}`);
    }
  }

  throw new Error(`فرمت آدرس قابل تشخیص نیست: ${address}`);
}

/**
 * تبدیل ایمن آدرس هات‌ولت
 * تضمین می‌کند همیشه به hex تبدیل شود
 */
function getHotWalletHex() {
  if (!config.harmony.hotWalletAddress) {
    throw new Error('هات‌ولت تنظیم نشده است (HOT_WALLET_ADDRESS)');
  }
  return normalizeToHex(config.harmony.hotWalletAddress);
}

/**
 * ارسال از هات‌ولت به یک آدرس دیگر
 */
async function sendFromHotWallet(toAddressInput, amountOne) {
  if (!config.harmony.hotWalletPrivateKey) {
    throw new Error('کلید خصوصی هات‌ولت تنظیم نشده است');
  }

  const hotHex = getHotWalletHex();
  const toHex = normalizeToHex(toAddressInput);

  const amountWei = web3.utils.toWei(amountOne.toString(), 'ether');
  const gasPrice = await web3.eth.getGasPrice();
  const nonce = await web3.eth.getTransactionCount(hotHex, 'pending');

  const tx = {
    from: hotHex,
    to: toHex,
    value: amountWei,
    gas: 21000,
    gasPrice,
    nonce,
    chainId: config.harmony.chainId,
  };

  const signedTx = await web3.eth.accounts.signTransaction(
    tx,
    config.harmony.hotWalletPrivateKey
  );

  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  return receipt.transactionHash;
}

/**
 * Sweep (انتقال از کیف کاربر به هات‌ولت)
 */
async function sweepToHotWallet(fromAddress, privateKey, amountOne) {
  const hotHex = getHotWalletHex();
  const fromHex = normalizeToHex(fromAddress);

  const amountWei = web3.utils.toWei(amountOne.toString(), 'ether');
  const gasPrice = await web3.eth.getGasPrice();
  const nonce = await web3.eth.getTransactionCount(fromHex, 'pending');

  const tx = {
    from: fromHex,
    to: hotHex,
    value: amountWei,
    gas: 21000,
    gasPrice,
    nonce,
    chainId: config.harmony.chainId,
  };

  const signedTx = await web3.eth.accounts.signTransaction(
    tx,
    privateKey
  );

  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  return receipt.transactionHash;
}


/**
 * ایجاد کیف پول جدید برای کاربر
 * خروجی شامل آدرس bech32، آدرس hex و کلید خصوصی است
 */
function generateUserWallet() {
  const account = web3.eth.accounts.create();

  const hexAddress = toChecksumAddress(account.address);

  let bech32Address;
  try {
    bech32Address = toBech32(hexAddress);
  } catch (err) {
    console.error('convert hex to bech32 failed, fallback to hex address:', err.message);
    bech32Address = hexAddress;
  }

  return {
    address: bech32Address,
    hexAddress,
    privateKey: account.privateKey,
  };
}

/**
 * دریافت موجودی (hex یا bech32)
 */
async function getBalance(address) {
  const hex = normalizeToHex(address);
  const balanceWei = await web3.eth.getBalance(hex);
  return web3.utils.fromWei(balanceWei, 'ether');
}

module.exports = {
  web3,
  normalizeToHex,
  getHotWalletHex,
  sweepToHotWallet,
  sendFromHotWallet,
  getBalance,
  generateUserWallet,
};
