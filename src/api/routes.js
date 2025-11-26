const express = require('express');
const router = express.Router();
const db = require("../db/index");
const { findOrCreateUserByTelegram, getUserByTelegramId } = require('../services/userService');
const { sweepUserDeposits } = require('../services/sweepService');
const { requestWithdraw } = require('../services/withdrawService');

function parseTelegramData(req, res, next) {
  const tg = req.body.telegramData;
  if (!tg || !tg.user || !tg.user.id) {
    return res.status(401).json({ ok: false, error: 'invalid telegram data' });
  }
  req.telegramUser = tg.user;
  next();
}

router.post('/init', parseTelegramData, async (req, res) => {
  try {
    const user = await findOrCreateUserByTelegram(req.telegramUser);
    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
});

router.post('/check-deposit', parseTelegramData, async (req, res) => {
  try {
    const user = await getUserByTelegramId(req.telegramUser.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });

    // ===============================
    // Rate Limit: 1 request per 15 sec
    // ===============================
    const now = Date.now();
    const last = Number(user.last_check_deposit || 0);

    const RATE_LIMIT_MS = 15000; // 15 ثانیه

    if (now - last < RATE_LIMIT_MS) {
      const wait = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
      return res.json({
        ok: false,
        rate_limited: true,
        wait,
        error: `لطفاً ${wait} ثانیه صبر کنید`
      });
    }

    // به‌روزرسانی زمان آخرین درخواست
    await db.query(
      "UPDATE users SET last_check_deposit = ? WHERE id = ?",
      [now, user.id]
    );

    // ===============================
    // ادامه فرایند sweep
    // ===============================
    const newTxs = await sweepUserDeposits(user);

    res.json({
      ok: true,
      count: newTxs.length,
      txs: newTxs,
      message: newTxs.length === 0
        ? 'واریز جدیدی یافت نشد'
        : `${newTxs.length} واریز جدید شناسایی شد`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/balance', parseTelegramData, async (req, res) => {
  try {
    const user = await getUserByTelegramId(req.telegramUser.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });
    res.json({ ok: true, balance: user.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
});

router.post('/withdraw', parseTelegramData, async (req, res) => {
  try {
    const { address, amount } = req.body;
    const user = await getUserByTelegramId(req.telegramUser.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });

    const result = await requestWithdraw(user, address, Number(amount));
    res.json({ ok: true, requestId: result.requestId, txHash: result.txHash });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
