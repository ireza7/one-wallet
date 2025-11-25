
require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  harmony: {
    rpcUrl: process.env.HARMONY_RPC_URL || 'https://api.harmony.one',
    chainId: Number(process.env.HARMONY_CHAIN_ID || 1666600000),
    hotWalletPrivateKey: process.env.HOT_WALLET_PRIVATE_KEY,
    hotWalletAddress: process.env.HOT_WALLET_ADDRESS,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    authMaxAgeSeconds: Number(process.env.TELEGRAM_AUTH_MAX_AGE || 86400),
  },
  business: {
    minWithdrawAmount: Number(process.env.MIN_WITHDRAW_AMOUNT || 1),
    currencySymbol: process.env.BOT_BASE_CURRENCY || 'ONE',
  },
};

module.exports = config;
