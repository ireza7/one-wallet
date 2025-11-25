const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const { verifyTelegramWebAppData } = require('../utils/telegramAuth');

router.post('/auth', async (req, res) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      console.error('Telegram WebApp auth failed: initData لازم است');
      return res.status(400).json({ ok: false, error: 'initData لازم است' });
    }

    if (!config.telegram || !config.telegram.botToken) {
      console.error('Telegram WebApp auth failed: TELEGRAM_BOT_TOKEN تنظیم نشده است');
      return res.status(500).json({ ok: false, error: 'server misconfigured' });
    }

    const { user: tgUser } = verifyTelegramWebAppData(
      initData,
      config.telegram.botToken
    );

    if (!tgUser || !tgUser.id) {
      console.error('Telegram WebApp auth failed: user data نامعتبر است');
      return res.status(400).json({ ok: false, error: 'telegram user invalid' });
    }

    const user = await db.getOrCreateUser(String(tgUser.id), tgUser.username || null);

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
    console.error('Telegram WebApp auth failed:', err);
    return res.status(401).json({ ok: false, error: 'auth_failed' });
  }
});

router.post('/init', async (req, res) => {
  try {
    const { telegram_id, username } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ ok: false, error: 'telegram_id لازم است' });
    }

    const user = await db.getOrCreateUser(telegram_id, username || null);

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
    console.error('user/init error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

module.exports = router;
