# ONE Wallet – Telegram MiniApp (ethers.js version)

این پروژه یک کیف‌پول Harmony ONE برای Telegram WebApp است که شامل:

- بک‌اند Node.js (Express + MySQL)
- فرانت‌اند Telegram MiniApp (HTML/JS)
- سرویس مانیتورینگ واریزهای آن‌چین
- پیاده‌سازی بر پایه **ethers.js + bech32** (بدون web3 و بدون Harmony SDK)

## ویژگی‌ها

- احراز هویت امن Telegram WebApp (با `initData` امضاشده تلگرام)
- یک کیف‌پول Harmony برای هر کاربر (آدرس one1... + hex)
- تشخیص خودکار واریزهای آن‌چین، افزایش موجودی داخلی و sweep به هات‌ولت
- انتقال داخلی بین کاربران با username
- برداشت به آدرس‌های Harmony (one1... یا 0x...)
- تاریخچه تراکنش‌ها (ledger) با:
  - نوع تراکنش
  - مبلغ
  - `tx_hash` برای تراکنش‌های روی زنجیره
  - برچسب (label) و توضیح (note)
- Frontend سبک و بدون Build، مناسب Telegram MiniApp

## تکنولوژی‌ها

- Node.js + Express
- MySQL (`mysql2/promise`)
- ethers.js + bech32 برای اتصال به Harmony RPC
- Telegram WebApp JS SDK
- Rate limiting با `express-rate-limit`
- لاگ ساخت‌یافته با `pino`

## راه‌اندازی

### ۱. نصب وابستگی‌ها

```bash
npm install
```

### ۲. تنظیم دیتابیس

فایل `sql/schema.sql` را روی دیتابیس MySQL خود اجرا کنید تا جداول `users`, `wallet_ledger`, `withdrawals` ساخته شوند.

### ۳. ساخت فایل `.env`

یک فایل `.env` در ریشه پروژه با مقادیر مشابه زیر ایجاد کنید:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=wallet_db

HARMONY_RPC_URL=https://api.harmony.one
HARMONY_CHAIN_ID=1666600000

HOT_WALLET_PRIVATE_KEY=0xYOUR_HOT_WALLET_PRIVATE_KEY
HOT_WALLET_ADDRESS=one1YOUR_HOT_WALLET_ADDRESS

TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_AUTH_MAX_AGE=86400

MIN_WITHDRAW_AMOUNT=1
BOT_BASE_CURRENCY=ONE
```

### ۴. اجرای API

```bash
node backend/index.js
```

### ۵. اجرای مانیتور واریزها

در یک ترمینال جداگانه:

```bash
node backend/monitor-runner.js
```

API روی `PORT` تعریف‌شده اجرا می‌شود و frontend از مسیر `/frontend` سرو می‌شود.

## ساختار پروژه

```text
backend/
  app.js                 # Express app + rate limiting + logger + Telegram auth middleware
  index.js               # اجرای فقط API + frontend
  monitor.js             # مانیتور واریزهای آن‌چین
  monitor-runner.js      # اجرای مانیتور به‌صورت پروسه جدا
  harmony.js             # منطق بلاک‌چین با ethers.js + bech32
  db.js                  # اتصال MySQL و منطق داده
  middleware/
    telegramAuth.js      # اعتبارسنجی initData تلگرام روی سرور
  routes/
    user.js              # /api/user/init
    wallet.js            # /api/wallet/*
frontend/
  index.html             # UI MiniApp
  app.js                 # منطق front و ارتباط با API
sql/
  schema.sql             # اسکیماهای MySQL
```

## نحوه احراز هویت Telegram WebApp

- فرانت‌اند در تمام درخواست‌ها هدر زیر را ارسال می‌کند:

```http
X-Telegram-Init-Data: <initData>
```

- روی سرور، middleware `telegramAuthMiddleware`:
  - `initData` را parse می‌کند
  - signature را با استفاده از `TELEGRAM_BOT_TOKEN` verify می‌کند
  - سن `auth_date` را با `TELEGRAM_AUTH_MAX_AGE` بررسی می‌کند
  - `req.telegramUser = { telegramId, username, rawData }` را ست می‌کند

تمام endpointهای `/api` فقط بر اساس `req.telegramUser` کار می‌کنند. دیگر نیازی به ارسال `telegram_id` در body/query نیست.

## endpointها

### `POST /api/user/init`

- ورودی: از هدر تلگرام (`X-Telegram-Init-Data`)
- خروجی: ایجاد/دریافت کاربر و کیف پول

### `GET /api/wallet/me`

- بر اساس Telegram auth، اطلاعات کیف فعلی را برمی‌گرداند.

### `POST /api/wallet/transfer`

```json
{
  "to_username": "username",
  "amount": 10
}
```

### `POST /api/wallet/withdraw`

```json
{
  "to_address": "one1....",
  "amount": 5
}
```

### `GET /api/wallet/history`

- لیست آخرین تراکنش‌های ledger (شامل `tx_hash` برای واریز/برداشت‌های روی زنجیره).

### `POST /api/wallet/annotate`

- افزودن `label` و `note` به رکوردهای ledger.

## نکات امنیتی

- همیشه از HTTPS استفاده کنید.
- از مقداردهی امن به envها (خصوصاً کلید خصوصی هات‌ولت) اطمینان حاصل کنید.
- پروسه `monitor` را فقط در یک instance اجرا کنید.
- rate limiting در `/api` فعال است (۶۰ درخواست در دقیقه به‌ازای هر IP).
- پیام‌های خطای داخلی در log ذخیره می‌شوند و به کلاینت فقط پیام عمومی داده می‌شود.

## لایسنس

MIT
