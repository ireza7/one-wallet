require('dotenv').config();

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Missing required env variable: ${name}`);
    process.exit(1);
  }
  return process.env[name];
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,

  DB_HOST: requireEnv('DB_HOST'),
  DB_USER: requireEnv('DB_USER'),
  DB_PASS: requireEnv('DB_PASS'),
  DB_NAME: requireEnv('DB_NAME'),

  MASTER_MNEMONIC: requireEnv('MASTER_MNEMONIC'),
  HARMONY_RPC_URL: requireEnv('HARMONY_RPC_URL'),

  HOT_WALLET_PRIVATE_KEY: requireEnv('HOT_WALLET_PRIVATE_KEY'),
  HOT_WALLET_ADDRESS: requireEnv('HOT_WALLET_ADDRESS'),

  // === موارد جدید برای Tatum ===
  TATUM_API_KEY: requireEnv('TATUM_API_KEY'),
  WEBHOOK_URL: requireEnv('WEBHOOK_URL'),       // آدرس سرور شما
  WEBHOOK_SECRET: requireEnv('WEBHOOK_SECRET')  // رمز امنیتی دلخواه
};