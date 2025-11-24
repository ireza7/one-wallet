
const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const { sendFromHotWallet } = require('../harmony');

router.get('/me', async (req, res) => {
  try {
    const telegramId = req.query.telegram_id;
    if (!telegramId) {
      return res.status(400).json({ ok: false, error: 'telegram_id لازم است' });
    }

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
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

router.post('/transfer', async (req, res) => {
  try {
    const { from_telegram_id, to_username, amount } = req.body;

    if (!from_telegram_id || !to_username || !amount) {
      return res.status(400).json({ ok: false, error: 'پارامترها ناقص است' });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ ok: false, error: 'مبلغ نامعتبر' });
    }

    const fromUser = await db.getUserByTelegramId(from_telegram_id);
    if (!fromUser) {
      return res.status(404).json({ ok: false, error: 'فرستنده پیدا نشد' });
    }

    const username = to_username.replace(/^@/, '');
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
    return res.status(500).json({ ok: false, error: err.message || 'internal error' });
  }
});

router.post('/withdraw', async (req, res) => {
  try {
    const { telegram_id, to_address, amount } = req.body;

    if (!telegram_id || !to_address || !amount) {
      return res.status(400).json({ ok: false, error: 'پارامترها ناقص است' });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ ok: false, error: 'مبلغ نامعتبر' });
    }

    if (amt < config.business.minWithdrawAmount) {
      return res.status(400).json({
        ok: false,
        error: `حداقل برداشت ${config.business.minWithdrawAmount} ${config.business.currencySymbol} است`,
      });
    }

    const user = await db.getUserByTelegramId(telegram_id);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'کاربر پیدا نشد' });
    }

    const withdrawalId = await db.createWithdrawal(user.id, amt, to_address);

    try {
      const txHash = await sendFromHotWallet(to_address, amt);
      await db.markWithdrawalSent(withdrawalId, txHash);

      return res.json({
        ok: true,
        tx_hash: txHash,
      });
    } catch (chainErr) {
      console.error('/wallet/withdraw chain error:', chainErr);
      await db.markWithdrawalFailed(withdrawalId, chainErr.message);
      return res.status(500).json({ ok: false, error: 'خطا در ارسال تراکنش روی شبکه' });
    }
  } catch (err) {
    console.error('/wallet/withdraw error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'internal error' });
  }
});

module.exports = router;
