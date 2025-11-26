const express = require('express');
const crypto = require('crypto');

const router = express.Router();
const db = require("../db/index");
const { findOrCreateUserByTelegram, getUserByTelegramId } = require('../services/userService');
const { sweepUserDeposits } = require('../services/sweepService');
const { requestWithdraw } = require('../services/withdrawService');

const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const MAX_INITDATA_AGE = 24 * 60 * 60; // 24 ساعت

function safeEqual(a, b) {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function validateTelegramInitData(initData) {
  console.log("RAW initData:", initData);
  console.log("BOT_TOKEN:", BOT_TOKEN);
  console.log("params:", [...params.entries()]);
  console.log("expected hmac:", hmac);
  console.log("received hash:", hash);

  if (!initData || !BOT_TOKEN) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');

  const dataCheckArr = [];
  for (const [key, value] of params.entries()) {
    const decoded = decodeURIComponent(value);
    dataCheckArr.push(`${key}=${decoded}`);
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (!safeEqual(hmac, hash)) return null;

  const authDateStr = params.get('auth_date');
  const authDate = authDateStr ? Number(authDateStr) : 0;
  const nowSec = Math.floor(Date.now() / 1000);

  if (!authDate || nowSec - authDate > MAX_INITDATA_AGE) return null;

  const userJson = params.get('user');
  if (!userJson) return null;

  let user;
  try {
    user = JSON.parse(userJson);
  } catch {
    return null;
  }

  if (!user.id) return null;

  return user;
}

function telegramAuth(req, res, next) {
  try {
    const initData = req.body.initData;
    const user = validateTelegramInitData(initData);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'invalid telegram auth' });
    }

    req.telegramUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'invalid telegram auth' });
  }
}

/* ========================= API ROUTES ========================= */

router.post('/init', telegramAuth, async (req, res) => {
  try {
    const user = await findOrCreateUserByTelegram(req.telegramUser);
    res.json({ ok: true, user });
  } catch {
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/check-deposit', telegramAuth, async (req, res) => {
  try {
    const user = await getUserByTelegramId(req.telegramUser.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });

    const now = Date.now();
    const last = Number(user.last_check_deposit || 0);
    const RATE_LIMIT_MS = 15000;

    if (now - last < RATE_LIMIT_MS) {
      const wait = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
      return res.json({
        ok: false,
        rate_limited: true,
        wait,
        error: `لطفاً ${wait} ثانیه صبر کنید`
      });
    }

    await db.query("UPDATE users SET last_check_deposit = ? WHERE id = ?", [now, user.id]);

    const newTxs = await sweepUserDeposits(user);
    res.json({
      ok: true,
      count: newTxs.length,
      txs: newTxs,
      message: newTxs.length === 0
        ? 'واریز جدیدی یافت نشد'
        : `${newTxs.length} واریز جدید شناسایی شد`
    });
  } catch {
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/balance', telegramAuth, async (req, res) => {
  try {
    const user = await getUserByTelegramId(req.telegramUser.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });
    res.json({ ok: true, balance: user.balance });
  } catch {
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/withdraw', telegramAuth, async (req, res) => {
  try {
    const { address, amount } = req.body;
    const user = await getUserByTelegramId(req.telegramUser.id);

    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });

    const result = await requestWithdraw(user, address, Number(amount));
    res.json({ ok: true, requestId: result.requestId, txHash: result.txHash });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post('/history', telegramAuth, async (req, res) => {
  try {
    const user = await getUserByTelegramId(req.telegramUser.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });

    const rows = await db.query(
      "SELECT * FROM tx_history WHERE user_id = ? ORDER BY id DESC LIMIT 50",
      [user.id]
    );

    res.json({ ok: true, history: rows });
  } catch {
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

module.exports = router;
