
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Initialize or fetch user based on verified Telegram WebApp identity.
 * Telegram identity is provided by telegramAuthMiddleware via req.telegramUser.
 */
router.post('/init', async (req, res) => {
  try {
    const telegramId = req.telegramUser && req.telegramUser.telegramId;
    const usernameFromAuth = req.telegramUser && req.telegramUser.username;

    if (!telegramId) {
      return res.status(400).json({ ok: false, error: 'عدم احراز هویت تلگرام' });
    }

    // Allow optional username override from body, but prefer Telegram username
    const username = (req.body && req.body.username) || usernameFromAuth || null;

    const user = await db.getOrCreateUser(telegramId, username);

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
