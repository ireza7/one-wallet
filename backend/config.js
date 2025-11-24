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
    hotWalletPrivateKey: process.env.HOT_WALLET_PRIVATE_KEY,
    hotWalletAddress: process.env.HOT_WALLET_ADDRESS,
  },

  business: {
    minWithdrawAmount: Number(process.env.MIN_WITHDRAW_AMOUNT || 1),
    currencySymbol: process.env.BOT_BASE_CURRENCY || 'ONE',
  },
};

if (!config.db.host) {
  console.warn('DB_HOST not set – remember to configure database connection via env.');
}

module.exports = config;
