const express = require('express');
const router = express.Router();
const db = require('../db');

// init: از طرف مینی‌اپ، اطلاعات تلگرام کاربر را می‌گیریم
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
