const db = require('./db');
const config = require('./config');
const { sendFromHotWallet } = require('./harmony');

function numberOrNull(s) {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatBalance(amount) {
  return `${amount} ${config.business.currencySymbol}`;
}

module.exports = function registerCommands(bot) {
  // /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || null;

    try {
      const user = await db.getOrCreateUser(msg.from.id, username);

      const text =
        '👋 خوش اومدی!\n\n' +
        'این ربات مثل یه ولت داخلی برای تو عمل می‌کنه.\n\n' +
        'آدرس واریز اختصاصی تو (شبکه Harmony ONE):\n' +
        '`' + user.harmony_address + '`\n\n' +
        'دستورات:\n' +
        '/deposit – دریافت آدرس واریز\n' +
        '/balance – مشاهده موجودی داخلی\n' +
        '/transfer – انتقال به کاربر دیگر داخل ربات\n' +
        '/withdraw – برداشت به ولت خارجی\n';

      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, 'خطا در راه‌اندازی حساب. بعداً دوباره امتحان کن.');
    }
  });

  // /deposit
  bot.onText(/\/deposit/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await db.getOrCreateUser(
        msg.from.id,
        msg.from.username || null
      );

      const text =
        'آدرس اختصاصی واریز تو روی شبکه Harmony ONE:\n' +
        '`' + user.harmony_address + '`\n\n' +
        'هر مقدار ONE که به این آدرس ارسال کنی، بعد از تأیید روی بلاک‌چین،\n' +
        'به صورت خودکار به موجودی داخلی‌ات اضافه می‌شه و به هات‌ولت منتقل می‌شه.';

      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, 'خطایی رخ داد.');
    }
  });

  // /balance
  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const user = await db.getUserByTelegramId(msg.from.id);
      if (!user) {
        await bot.sendMessage(chatId, 'ابتدا /start رو بزن تا حساب برات ساخته بشه.');
        return;
      }

      const balance = await db.getBalance(user.id);
      await bot.sendMessage(
        chatId,
        `موجودی داخلی تو:\n${formatBalance(balance)}`
      );
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, 'خطا در دریافت موجودی.');
    }
  });

  // /transfer <username> <amount>
  bot.onText(/\/transfer (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match[1].trim().split(/\s+/);
    if (args.length < 2) {
      await bot.sendMessage(chatId, 'فرمت درست:\n/transfer <username بدون @> <amount>');
      return;
    }

    const targetUsername = args[0].replace(/^@/, '');
    const amount = numberOrNull(args[1]);

    if (!amount || amount <= 0) {
      await bot.sendMessage(chatId, 'مبلغ معتبر وارد کن.');
      return;
    }

    try {
      const fromUser = await db.getUserByTelegramId(msg.from.id);
      if (!fromUser) {
        await bot.sendMessage(chatId, 'ابتدا /start رو بزن.');
        return;
      }

      // پیدا کردن گیرنده بر اساس username
      const [rows] = await db.pool.query(
        'SELECT * FROM users WHERE username = ?',
        [targetUsername]
      );
      if (rows.length === 0) {
        await bot.sendMessage(chatId, 'کاربر مقصد پیدا نشد. مطمئنی قبلاً /start رو زده؟');
        return;
      }

      const toUser = rows[0];

      if (toUser.id === fromUser.id) {
        await bot.sendMessage(chatId, 'نمی‌تونی به خودت ارسال کنی 😅');
        return;
      }

      await db.internalTransfer(fromUser.id, toUser.id, amount);
      await bot.sendMessage(
        chatId,
        `✅ انتقال انجام شد.\n` +
        `گیرنده: @${targetUsername}\n` +
        `مبلغ: ${formatBalance(amount)}`
      );
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, `خطا در انتقال: ${err.message}`);
    }
  });

  // /withdraw <address> <amount>
  bot.onText(/\/withdraw (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match[1].trim().split(/\s+/);
    if (args.length < 2) {
      await bot.sendMessage(chatId, 'فرمت درست:\n/withdraw <harmony_address> <amount>');
      return;
    }

    const toAddress = args[0];
    const amount = numberOrNull(args[1]);

    if (!amount || amount <= 0) {
      await bot.sendMessage(chatId, 'مبلغ معتبر وارد کن.');
      return;
    }

    if (amount < config.business.minWithdrawAmount) {
      await bot.sendMessage(
        chatId,
        `حداقل برداشت: ${config.business.minWithdrawAmount} ${config.business.currencySymbol}`
      );
      return;
    }

    try {
      const user = await db.getUserByTelegramId(msg.from.id);
      if (!user) {
        await bot.sendMessage(chatId, 'ابتدا /start رو بزن.');
        return;
      }

      // ثبت برداشت در دیتابیس و کم کردن موجودی داخلی
      const withdrawalId = await db.createWithdrawal(user.id, amount, toAddress);

      await bot.sendMessage(chatId, '⏳ در حال ارسال تراکنش روی شبکه Harmony...');

      try {
        const txHash = await sendFromHotWallet(toAddress, amount);
        await db.markWithdrawalSent(withdrawalId, txHash);

        await bot.sendMessage(
          chatId,
          `✅ برداشت انجام شد.\n` +
          `مبلغ: ${formatBalance(amount)}\n` +
          `آدرس مقصد: ${toAddress}\n` +
          `TX Hash: \`${txHash}\``,
          { parse_mode: 'Markdown' }
        );
      } catch (chainErr) {
        console.error(chainErr);
        await db.markWithdrawalFailed(withdrawalId, chainErr.message);
        await bot.sendMessage(chatId, `خطا در ارسال روی شبکه: ${chainErr.message}`);
      }
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, `خطا در ثبت برداشت: ${err.message}`);
    }
  });
};
