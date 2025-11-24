const TelegramBot = require('node-telegram-bot-api');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('./config');
const registerCommands = require('./commands');

function createAgentFromProxyUrl(proxyUrl) {
  if (!proxyUrl) return null;

  if (proxyUrl.startsWith('socks')) {
    // socks:// or socks5://
    return new SocksProxyAgent(proxyUrl);
  }

  if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
    return new HttpsProxyAgent(proxyUrl);
  }

  console.warn('PROXY_URL scheme not recognized, skipping proxy.');
  return null;
}

const agent = createAgentFromProxyUrl(config.proxyUrl);

const botOptions = {
  polling: true,
};

if (agent) {
  botOptions.request = { agent };
  console.log('Proxy enabled for Telegram bot:', config.proxyUrl);
}

const bot = new TelegramBot(config.botToken, botOptions);

// ثبت کامندها
registerCommands(bot);

console.log('Harmony Telegram Wallet bot started...');
