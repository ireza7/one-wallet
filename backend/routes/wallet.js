const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const { sendFromHotWallet, normalizeToHex, getBalance, sweepToHotWallet } = require('../harmony');
const { verifyTelegramWebAppData } = require('../utils/telegramAuth');
const botToken = process.env.TELEGRAM_BOT_TOKEN;

function parseAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error('مبلغ نامعتبر');
  if (n > 1e12) throw new Error('مبلغ بیش از حد بزرگ است');
  return n;
}

function getUserFromInitData(req) {
  const initData = req.body.initData;
  if (!initData) {
    const err = new Error('initData لازم است');
    err.statusCode = 401;
    throw err;
  }
  const { user } = verifyTelegramWebAppData(initData, botToken);
  if (!user || !user.id) {
    const err = new Error('احراز هویت نامعتبر');
    err.statusCode = 401;
    throw err;
  }
  return user;
}

router.get('/me', async (req, res) => {
  try {
    const userData = getUserFromInitData(req);
    const user = await db.getUserByTelegramId(userData.id);
    if (!user) return res.status(404).json({ ok: false, error: 'کاربر پیدا نشد' });
    return res.json({
      ok: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        harmony_address: user.harmony_address,
        internal_balance: Number(user.internal_balance)
      }
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ ok: false, error: status === 401 ? 'unauthorized' : 'internal error' });
  }
});

router.post('/transfer', async (req, res) => {
  try {
    const userData = getUserFromInitData(req);
    const { to_username, amount } = req.body || {};
    if (!to_username || amount === undefined || amount === null)
      return res.status(400).json({ ok: false, error: 'پارامترها ناقص است' });

    let amt;
    try {
      amt = parseAmount(amount);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }

    const fromUser = await db.getUserByTelegramId(userData.id);
    if (!fromUser) return res.status(404).json({ ok: false, error: 'فرستنده پیدا نشد' });

    const username = String(to_username).replace(/^@/, '').trim();
    if (!username) return res.status(400).json({ ok: false, error: 'نام کاربری گیرنده نامعتبر است' });

    const toUser = await db.getUserByUsername(username);
    if (!toUser) return res.status(404).json({ ok: false, error: 'گیرنده پیدا نشد' });

    if (toUser.id === fromUser.id)
      return res.status(400).json({ ok: false, error: 'نمی‌توانید به خودتان انتقال دهید' });

    await db.internalTransfer(fromUser.id, toUser.id, amt);
    return res.json({ ok: true });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ ok: false, error: status === 401 ? 'unauthorized' : 'internal error' });
  }
});

router.post('/withdraw', async (req, res) => {
  try {
    const userData = getUserFromInitData(req);
    const { to_address, amount } = req.body || {};
    if (!to_address || amount === undefined || amount === null)
      return res.status(400).json({ ok: false, error: 'پارامترها ناقص است' });

    let normalizedAddress;
    try {
      normalizedAddress = normalizeToHex(to_address);
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'آدرس مقصد نامعتبر است' });
    }

    let amt;
    try {
      amt = parseAmount(amount);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }

    if (amt < config.business.minWithdrawAmount)
      return res.status(400).json({
        ok: false,
        error: `حداقل برداشت ${config.business.minWithdrawAmount} ${config.business.currencySymbol} است`
      });

    const user = await db.getUserByTelegramId(userData.id);
    if (!user) return res.status(404).json({ ok: false, error: 'کاربر پیدا نشد' });

    const withdrawalId = await db.createWithdrawal(user.id, amt, to_address);

    try {
      const txHash = await sendFromHotWallet(normalizedAddress, amt);
      await db.markWithdrawalSent(withdrawalId, txHash);
      return res.json({ ok: true, tx_hash: txHash });
    } catch (chainErr) {
      await db.markWithdrawalFailed(withdrawalId, chainErr.message || 'chain error');
      return res.status(500).json({ ok: false, error: 'خطا در ارسال تراکنش روی شبکه' });
    }
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ ok: false, error: status === 401 ? 'unauthorized' : 'internal error' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const userData = getUserFromInitData(req);
    const user = await db.getUserByTelegramId(userData.id);
    if (!user) return res.status(404).json({ ok: false, error: 'کاربر پیدا نشد' });

    const [rows] = await db.pool.query(
      `SELECT id, created_at, type, amount, tx_hash, meta, label, note
       FROM wallet_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 200`,
      [user.id]
    );

    return res.json({ ok: true, history: rows });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ ok: false, error: status === 401 ? 'unauthorized' : 'internal error' });
  }
});

router.post('/annotate', async (req, res) => {
  try {
    const userData = getUserFromInitData(req);
    const { ledger_id, label, note } = req.body || {};
    if (!ledger_id) return res.status(400).json({ ok: false, error: 'پارامتر ناقص' });

    const user = await db.getUserByTelegramId(userData.id);
    if (!user) return res.status(404).json({ ok: false, error: 'کاربر پیدا نشد' });

    await db.pool.query(
      `UPDATE wallet_ledger SET label = ?, note = ? WHERE id = ? AND user_id = ?`,
      [label || null, note || null, ledger_id, user.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ ok: false, error: status === 401 ? 'unauthorized' : 'internal error' });
  }
});

router.post('/check-deposit', async (req, res) => {
  try {
    const userData = getUserFromInitData(req);

    const [rows] = await db.pool.query(
      'SELECT * FROM users WHERE id = ?',
      [userData.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });

    const u = rows[0];
    const balanceStr = await getBalance(u.harmony_address);
    const chainBalance = Number(balanceStr);
    const lastBalance = Number(u.last_onchain_balance || 0);

    if (chainBalance > lastBalance) {
      const diff = chainBalance - lastBalance;

      await db.pool.query(
        'UPDATE users SET last_onchain_balance = ?, internal_balance = internal_balance + ? WHERE id = ?',
        [chainBalance, diff, userData.id]
      );

      await db.pool.query(
        'INSERT INTO wallet_ledger (user_id, type, amount, note) VALUES (?, "deposit", ?, "Manual check deposit")',
        [userData.id, diff]
      );

      const sweepTx = await sweepToHotWallet(u);

      return res.json({
        success: true,
        deposit: true,
        amount: diff,
        sweepTx,
        balance: chainBalance
      });
    }

    return res.json({
      success: true,
      deposit: false,
      balance: chainBalance
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
