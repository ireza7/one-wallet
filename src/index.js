require('dotenv').config();
const { initDB, getPool } = require('./db');
const Wallet = require('./wallet');
const TelegramBot = require('node-telegram-bot-api');
const { SocksProxyAgent } = require('socks-proxy-agent');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SOCKS5_PROXY = process.env.SOCKS5_PROXY || '';

async function start() {
  await initDB();
  const pool = getPool();

  let requestOptions = {};
  if (SOCKS5_PROXY) {
    const agent = new SocksProxyAgent(SOCKS5_PROXY);
    requestOptions = { agent };
    console.log('Using SOCKS5 proxy for Telegram:', SOCKS5_PROXY);
  }

  const bot = new TelegramBot(BOT_TOKEN, {
    polling: true,
    request: requestOptions
  });

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = (msg.from && msg.from.username) ? msg.from.username : null;
    // upsert user
    await pool.query(
      `INSERT INTO users (telegram_id, username) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE username = VALUES(username)`,
      [chatId, username]
    );
    // get user id
    const [urows] = await pool.query('SELECT id FROM users WHERE telegram_id = ?', [chatId]);
    const userId = urows[0].id;
    // check address
    const [rows] = await pool.query('SELECT * FROM addresses WHERE user_id = ?', [userId]);
    if (rows.length === 0) {
      const [m] = await pool.query('SELECT COALESCE(MAX(derivation_index), -1) AS maxidx FROM addresses');
      const maxidx = m[0].maxidx === null ? -1 : m[0].maxidx;
      const nextIdx = maxidx + 1;
      const derived = Wallet.deriveAddress(nextIdx);
      await pool.query('INSERT INTO addresses (user_id, address, derivation_index) VALUES (?, ?, ?)', [userId, derived.address, nextIdx]);
      await pool.query('INSERT INTO accounts (user_id, balance_wei) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id=user_id', [userId, '0']);
      bot.sendMessage(chatId, `آدرس اختصاصی شما ایجاد شد:\n${derived.address}\nبرای واریز از این آدرس استفاده کنید.`);
    } else {
      bot.sendMessage(chatId, `شما از قبل آدرس دارید:\n${rows[0].address}`);
    }
  });

  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const [urows] = await pool.query('SELECT id FROM users WHERE telegram_id = ?', [chatId]);
    if (urows.length === 0) return bot.sendMessage(chatId, 'ابتدا /start را بزنید.');
    const userId = urows[0].id;
    const [accRows] = await pool.query('SELECT balance_wei FROM accounts WHERE user_id = ?', [userId]);
    const balanceWei = accRows.length ? accRows[0].balance_wei : '0';
    const human = (Number(balanceWei) / 1e18).toString();
    bot.sendMessage(chatId, `موجودی داخلی: ${human} ONE`);
  });

  // /pay <username> <amount>
  bot.onText(/\/pay\s+(\w+)\s+([\d.]+)/, async (msg, match) => {
    const fromTelegramId = msg.chat.id;
    const toUsername = match[1];
    const amount = match[2];
    const [fromRowArr] = await pool.query('SELECT id FROM users WHERE telegram_id = ?', [fromTelegramId]);
    if (fromRowArr.length === 0) return bot.sendMessage(fromTelegramId, 'ابتدا /start کنید.');
    const fromId = fromRowArr[0].id;
    const [toRowArr] = await pool.query('SELECT id FROM users WHERE username = ?', [toUsername]);
    if (toRowArr.length === 0) return bot.sendMessage(fromTelegramId, 'گیرنده پیدا نشد.');
    const toId = toRowArr[0].id;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [facc] = await conn.query('SELECT balance_wei FROM accounts WHERE user_id = ? FOR UPDATE', [fromId]);
      const [tacc] = await conn.query('SELECT balance_wei FROM accounts WHERE user_id = ? FOR UPDATE', [toId]);
      const fromBal = BigInt(facc[0].balance_wei || '0');
      const toBal = BigInt(tacc[0].balance_wei || '0');
      const amtWei = BigInt(Math.floor(Number(amount) * 1e18));
      if (fromBal < amtWei) {
        await conn.rollback();
        return bot.sendMessage(fromTelegramId, 'موجودی کافی نیست.');
      }
      const newFrom = (fromBal - amtWei).toString();
      const newTo = (toBal + amtWei).toString();
      await conn.query('UPDATE accounts SET balance_wei = ? WHERE user_id = ?', [newFrom, fromId]);
      await conn.query('UPDATE accounts SET balance_wei = ? WHERE user_id = ?', [newTo, toId]);
      await conn.query('INSERT INTO txs (txid, from_address, to_address, amount_wei, kind, user_id) VALUES (?,?,?,?,?,?)',
        [`internal-${Date.now()}`, null, null, amtWei.toString(), 'internal', fromId]);
      await conn.commit();
      bot.sendMessage(fromTelegramId, `انتقال موفق: ${amount} ONE به ${toUsername}`);
    } catch (e) {
      await conn.rollback();
      console.error(e);
      bot.sendMessage(fromTelegramId, 'خطا در انجام تراکنش داخلی.');
    } finally {
      conn.release();
    }
  });

  // /withdraw <amount> <toAddress>
  bot.onText(/\/withdraw\s+([\d.]+)\s+(\S+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = match[1];
    const toAddress = match[2];
    const [urows] = await pool.query('SELECT id FROM users WHERE telegram_id = ?', [chatId]);
    if (urows.length === 0) return bot.sendMessage(chatId, 'ابتدا /start کنید.');
    const userId = urows[0].id;
    const [accRows] = await pool.query('SELECT balance_wei FROM accounts WHERE user_id = ?', [userId]);
    const bal = BigInt(accRows.length ? accRows[0].balance_wei : '0');
    const amtWei = BigInt(Math.floor(Number(amount) * 1e18));
    if (bal < amtWei) return bot.sendMessage(chatId, 'موجودی کافی نیست.');
    try {
      const txHash = await Wallet.sendTx(Wallet.hotWallet, toAddress, amtWei.toString());
      await pool.query('UPDATE accounts SET balance_wei = CAST(balance_wei AS DECIMAL(38,0)) - ? WHERE user_id = ?', [amtWei.toString(), userId]);
      await pool.query('INSERT INTO txs (txid, from_address, to_address, amount_wei, kind, user_id) VALUES (?,?,?,?,?,?)',
        [txHash, Wallet.hotWallet.address, toAddress, amtWei.toString(), 'withdraw', userId]);
      bot.sendMessage(chatId, `برداشت انجام شد. TX: ${txHash}`);
    } catch (e) {
      console.error('withdraw error', e);
      bot.sendMessage(chatId, `خطا در برداشت: ${e && e.message ? e.message : e}`);
    }
  });

  // start background sweep
  const { checkAndSweep } = require('./jobs');
  const interval = parseInt(process.env.CHECK_INTERVAL_SECONDS || '60', 10) * 1000;
  setInterval(() => {
    checkAndSweep().catch(err => console.error('sweep failed', err));
  }, interval);

  console.log('Bot started.');
}

start().catch(err => {
  console.error('Fatal error:', err && err.message ? err.message : err);
  process.exit(1);
});
