const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require("../db/index");
const { findOrCreateUserByTelegram, getUserByTelegramId } = require('../services/userService');
const { sweepUserDeposits } = require('../services/sweepService');
const { requestWithdraw } = require('../services/withdrawService');

const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const MAX_INITDATA_AGE = 24 * 60 * 60;

function isHex64(str) {
  return typeof str === 'string' && /^[0-9a-f]{64}$/i.test(str);
}

function safeEqualHex(aHex, bHex) {
  if (!isHex64(aHex) || !isHex64(bHex)) return false;
  const aBuf = Buffer.from(aHex, 'hex');
  const bBuf = Buffer.from(bHex, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isValidOneAddress(addr) {
  if (!addr || typeof addr !== 'string') return false;
  return /^one1[a-z0-9]{38}$/i.test(addr);
}

function isValidAmount(amt) {
  return typeof amt === 'number' && isFinite(amt) && amt > 0;
}

function validateTelegramInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;

  let params;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');

  const dataCheckArr = [];
  for (const [key, value] of params.entries()) {
    dataCheckArr.push(`${key}=${value}`);
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (!safeEqualHex(hmac, hash)) return null;

  const authDateStr = params.get('auth_date');
  const authDate = authDateStr ? Number(authDateStr) : 0;
  const nowSec = Math.floor(Date.now() / 1000);

  if (!authDate || !Number.isFinite(authDate)) return null;
  if (nowSec - authDate > MAX_INITDATA_AGE) return null;

  const userJson = params.get('user');
  if (!userJson) return null;

  let user;
  try {
    user = JSON.parse(userJson);
  } catch {
    return null;
  }

  if (!user || !user.id) return null;

  return user;
}

function telegramAuth(req, res, next) {
  try {
    let initData = (req.body && (req.body.initData || req.body.init_data || req.body.init)) ||
      (typeof req.query.initData === 'string' ? req.query.initData : null);

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

router.post('/init', telegramAuth, async (req, res) => {
  try {
    const user = await findOrCreateUserByTelegram(req.telegramUser);
    return res.json({ ok: true, user });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'internal_error' });
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
    return res.json({
      ok: true,
      count: newTxs.length,
      txs: newTxs,
      message: newTxs.length === 0
        ? 'واریز جدیدی یافت نشد'
        : `${newTxs.length} واریز جدید شناسایی شد`
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/balance', telegramAuth, async (req, res) => {
  try {
    const user = await getUserByTelegramId(req.telegramUser.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });
    return res.json({ ok: true, balance: user.balance });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/withdraw', telegramAuth, async (req, res) => {
  try {
    let { address, amount } = req.body;
    amount = Number(amount);

    if (!isValidAmount(amount)) {
      return res.status(400).json({ ok: false, error: 'مبلغ وارد شده معتبر نیست' });
    }

    if (!isValidOneAddress(address)) {
      return res.status(400).json({ ok: false, error: 'آدرس گیرنده معتبر نیست (باید با one1 شروع شود)' });
    }

    const user = await getUserByTelegramId(req.telegramUser.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });

    if (address.toLowerCase() === user.deposit_address.toLowerCase()) {
      return res.status(400).json({ ok: false, error: 'نمی‌توانید به آدرس واریز خودتان برداشت کنید' });
    }

    const result = await requestWithdraw(user, address, amount);
    return res.json({ ok: true, requestId: result.requestId, txHash: result.txHash });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'خطا در انجام عملیات' });
  }
});

router.post('/history', telegramAuth, async (req, res) => {
  try {
    const user = await getUserByTelegramId(req.telegramUser.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });

    const rows = await db.query(
      "SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50",
      [user.id]
    );

    return res.json({ ok: true, history: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

module.exports = router;