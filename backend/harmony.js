const { ethers } = require('ethers');
const { bech32 } = require('bech32');
const config = require('./config');

// Ethers provider for Harmony RPC
const provider = new ethers.JsonRpcProvider(config.harmony.rpcUrl);

/**
 * Convert Harmony ONE address (bech32) or hex to normalized EVM hex (checksum).
 */
function normalizeToHex(address) {
  if (!address) {
    throw new Error('آدرس نامعتبر است');
  }

  const addr = String(address).trim();

  // Already hex (0x...)
  if (addr.startsWith('0x') || addr.startsWith('0X')) {
    return ethers.getAddress(addr);
  }

  // Harmony bech32 (one1...)
  if (addr.startsWith('one1')) {
    try {
      const decoded = bech32.decode(addr);
      const raw = Buffer.from(bech32.fromWords(decoded.words));
      const hex = '0x' + raw.toString('hex');
      return ethers.getAddress(hex);
    } catch (err) {
      throw new Error(`تبدیل آدرس bech32 به hex ناموفق بود: ${err.message}`);
    }
  }

  throw new Error(`فرمت آدرس قابل تشخیص نیست: ${address}`);
}

/**
 * Convert EVM hex to Harmony bech32 (one1...)
 */
function hexToOne(hexAddress) {
  const normalized = ethers.getAddress(hexAddress);
  const raw = Buffer.from(normalized.replace(/^0x/, ''), 'hex');
  return bech32.encode('one', bech32.toWords(raw));
}

/**
 * دریافت آدرس هات‌ولت به صورت hex نرمال‌شده
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

  const wallet = new ethers.Wallet(config.harmony.hotWalletPrivateKey, provider);

  // اطمینان از این‌که آدرس ولت با آدرس تنظیم‌شده هات‌ولت همخوان است
  const walletAddress = await wallet.getAddress();
  const walletHex = ethers.getAddress(walletAddress);
  if (walletHex !== hotHex) {
    throw new Error('آدرس کلید خصوصی هات‌ولت با HOT_WALLET_ADDRESS همخوان نیست');
  }

  const tx = await wallet.sendTransaction({
    to: toHex,
    value: ethers.parseEther(amountOne.toString())
  });

  return tx.hash;
}

/**
 * Sweep (انتقال از کیف کاربر به هات‌ولت)
 */
async function sweepToHotWallet(fromAddress, privateKey, amountOne) {
  const hotHex = getHotWalletHex();
  const fromHex = normalizeToHex(fromAddress);

  const wallet = new ethers.Wallet(privateKey, provider);
  const walletAddress = await wallet.getAddress();
  const walletHex = ethers.getAddress(walletAddress);

  // برای اطمینان، بررسی می‌کنیم که کلید ارائه‌شده واقعاً متعلق به همان آدرسی است که در دیتا است
  if (walletHex !== fromHex) {
    throw new Error('کلید خصوصی با آدرس کاربر همخوان نیست');
  }

  const tx = await wallet.sendTransaction({
    to: hotHex,
    value: ethers.parseEther(amountOne.toString())
  });

  return tx.hash;
}

/**
 * ایجاد کیف پول جدید برای کاربر
 * خروجی شامل آدرس bech32، آدرس hex و کلید خصوصی است
 */
function generateUserWallet() {
  const wallet = ethers.Wallet.createRandom();
  const hexAddress = ethers.getAddress(wallet.address);

  let bech32Address;
  try {
    bech32Address = hexToOne(hexAddress);
  } catch (err) {
    console.error('convert hex to bech32 failed, fallback to hex address:', err.message);
    bech32Address = hexAddress;
  }

  return {
    address: bech32Address,
    hexAddress,
    privateKey: wallet.privateKey,
  };
}

/**
 * دریافت موجودی (hex یا bech32)
 * خروجی به واحد ONE به‌صورت string
 */
async function getBalance(address) {
  const hex = normalizeToHex(address);
  const balanceWei = await provider.getBalance(hex);
  return ethers.formatEther(balanceWei);
}

module.exports = {
  provider,
  normalizeToHex,
  hexToOne,
  getHotWalletHex,
  sweepToHotWallet,
  sendFromHotWallet,
  getBalance,
  generateUserWallet,
};
