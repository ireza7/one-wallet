
const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const { sendFromHotWallet, normalizeToHex } = require('../harmony');

/**
 * Helper: parse and validate a positive numeric amount.
 * Throws on invalid input.
 */
function parseAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('مبلغ نامعتبر');
  }
  // simple sanity limit to avoid absurd values (can be tuned)
  if (n > 1e12) {
    throw new Error('مبلغ بیش از حد بزرگ است');
  }
  return n;
}

/**
 * Ensure we have an authenticated Telegram user.
 */
function requireTelegramUser(req) {
  const telegramId = req.telegramUser && req.telegramUser.telegramId;
  if (!telegramId) {
    const err = new Error('عدم احراز هویت تلگرام');
    err.statusCode = 401;
    throw err;
  }
  return telegramId;
}

/**
 * GET /api/wallet/me
 * Return wallet info for authenticated user.
 */
router.get('/me', async (req, res) => {
  try {
    const telegramId = requireTelegramUser(req);

    const user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'کاربر پیدا نشد' });
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        harmony_address: user.harmony_address,
        internal_balance: Number(user.internal_balance),
      },
    });
  } catch (err) {
    console.error('/wallet/me error:', err);
    const status = err.statusCode || 500;
    const errorMessage = status === 401 ? 'unauthorized' : 'internal error';
    return res.status(status).json({ ok: false, error: errorMessage });
  }
});

/**
 * POST /api/wallet/transfer
 * Body: { to_username, amount }
 * From-user is derived from Telegram auth, not body.
 */
router.post('/transfer', async (req, res) => {
  try {
    const telegramId = requireTelegramUser(req);
    const { to_username, amount } = req.body || {};

    if (!to_username || amount === undefined || amount === null) {
      return res.status(400).json({ ok: false, error: 'پارامترها ناقص است' });
    }

    let amt;
    try {
      amt = parseAmount(amount);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }

    const fromUser = await db.getUserByTelegramId(telegramId);
    if (!fromUser) {
      return res.status(404).json({ ok: false, error: 'فرستنده پیدا نشد' });
    }

    const username = String(to_username).replace(/^@/, '').trim();
    if (!username) {
      return res.status(400).json({ ok: false, error: 'نام کاربری گیرنده نامعتبر است' });
    }

    const toUser = await db.getUserByUsername(username);
    if (!toUser) {
      return res.status(404).json({ ok: false, error: 'گیرنده پیدا نشد' });
    }

    if (toUser.id === fromUser.id) {
      return res.status(400).json({ ok: false, error: 'نمی‌توانید به خودتان انتقال دهید' });
    }

    await db.internalTransfer(fromUser.id, toUser.id, amt);

    return res.json({ ok: true });
  } catch (err) {
    console.error('/wallet/transfer error:', err);
    const status = err.statusCode || 500;
    const errorMessage = status === 401 ? 'unauthorized' : 'internal error';
    return res.status(status).json({ ok: false, error: errorMessage });
  }
});

/**
 * POST /api/wallet/withdraw
 * Body: { to_address, amount }
 * User is taken from Telegram auth.
 */
router.post('/withdraw', async (req, res) => {
  try {
    const telegramId = requireTelegramUser(req);
    const { to_address, amount } = req.body || {};

    if (!to_address || amount === undefined || amount === null) {
      return res.status(400).json({ ok: false, error: 'پارامترها ناقص است' });
    }

    // Validate and normalize address first
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

    if (amt < config.business.minWithdrawAmount) {
      return res.status(400).json({
        ok: false,
        error: `حداقل برداشت ${config.business.minWithdrawAmount} ${config.business.currencySymbol} است`,
      });
    }

    const user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'کاربر پیدا نشد' });
    }

    // ایجاد رکورد برداشت با آدرس اصلی (to_address)؛ آدرس نرمال شده برای اعتبارسنجی استفاده شد
    const withdrawalId = await db.createWithdrawal(user.id, amt, to_address);

    try {
      const txHash = await sendFromHotWallet(normalizedAddress, amt);
      await db.markWithdrawalSent(withdrawalId, txHash);

      return res.json({
        ok: true,
        tx_hash: txHash,
      });
    } catch (chainErr) {
      console.error('/wallet/withdraw chain error:', chainErr);
      await db.markWithdrawalFailed(withdrawalId, chainErr.message || 'chain error');
      return res.status(500).json({ ok: false, error: 'خطا در ارسال تراکنش روی شبکه' });
    }
  } catch (err) {
    console.error('/wallet/withdraw error:', err);
    const status = err.statusCode || 500;
    const errorMessage = status === 401 ? 'unauthorized' : 'internal error';
    return res.status(status).json({ ok: false, error: errorMessage });
  }
});

/**
 * GET /api/wallet/history
 * Returns user's ledger/history.
 */
router.get('/history', async (req, res) => {
  try {
    const telegramId = requireTelegramUser(req);

    const user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'کاربر پیدا نشد' });
    }

    const [rows] = await db.pool.query(
      `SELECT id, created_at, type, amount, tx_hash, meta, label, note
       FROM wallet_ledger
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 200`,
      [user.id]
    );

    return res.json({ ok: true, history: rows });
  } catch (err) {
    console.error('/wallet/history error:', err);
    const status = err.statusCode || 500;
    const errorMessage = status === 401 ? 'unauthorized' : 'internal error';
    return res.status(status).json({ ok: false, error: errorMessage });
  }
});

/**
 * POST /api/wallet/annotate
 * Body: { ledger_id, label, note }
 */
router.post('/annotate', async (req, res) => {
  try {
    const telegramId = requireTelegramUser(req);
    const { ledger_id, label, note } = req.body || {};

    if (!ledger_id) {
      return res.status(400).json({ ok: false, error: 'پارامتر ناقص' });
    }

    const user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'کاربر پیدا نشد' });
    }

    await db.pool.query(
      `UPDATE wallet_ledger SET label = ?, note = ?
       WHERE id = ? AND user_id = ?`,
      [label || null, note || null, ledger_id, user.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('/wallet/annotate error:', err);
    const status = err.statusCode || 500;
    const errorMessage = status === 401 ? 'unauthorized' : 'internal error';
    return res.status(status).json({ ok: false, error: errorMessage });
  }
});



// Manual deposit check with auto sweep
router.post('/check-deposit', async (req, res) => {
  try {
    const user = req.user;
    const [rows] = await db.pool.query(
      'SELECT * FROM users WHERE id = ?',
      [user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const u = rows[0];
    const { getBalance, sweepToHotWallet } = require('../harmony');

    const balanceStr = await getBalance(u.harmony_address);
    const chainBalance = Number(balanceStr);
    const lastBalance = Number(u.last_onchain_balance || 0);

    if (chainBalance > lastBalance) {
      const diff = chainBalance - lastBalance;

      await db.pool.query(
        'UPDATE users SET last_onchain_balance = ?, internal_balance = internal_balance + ? WHERE id = ?',
        [chainBalance, diff, user.id]
      );

      await db.pool.query(
        'INSERT INTO wallet_ledger (user_id, type, amount, note) VALUES (?, "deposit", ?, "Manual check")',
        [user.id, diff]
      );

      const sweepTx = await sweepToHotWallet(u);

      return res.json({ success: true, deposit: true, amount: diff, sweepTx, balance: chainBalance });
    }

    return res.json({ success: true, deposit: false, balance: chainBalance });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
