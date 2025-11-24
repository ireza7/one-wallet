# Harmony Telegram Wallet Bot

ربات تلگرام با Node.js که مثل یک ولت تجمیعی برای شبکه Harmony ONE عمل می‌کند:

- هر کاربر یک آدرس اختصاصی برای واریز دریافت می‌کند
- واریزها به صورت **خودکار** روی بلاک‌چین شناسایی می‌شوند
- مبلغ واریز شده به **موجودی داخلی** کاربر اضافه می‌شود
- سپس موجودی آدرس کاربر به صورت خودکار به **هات‌ولت** منتقل (sweep) می‌شود
- کاربر می‌تواند:
  - انتقال داخلی به کاربران دیگر انجام دهد
  - برداشت به هر آدرس Harmony انجام دهد

## راه‌اندازی

1. ساخت دیتابیس و جداول:

```sql
SOURCE sql/schema.sql;
```

2. تنظیم `.env` (بر اساس `.env.example`)

3. اجرای لوکال:

```bash
npm install
npm run dev
```

4. اجرای با Docker:

```bash
docker build -t harmony-telegram-wallet-bot .

docker run -d \
  --name harmony-bot \
  -e BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN \
  -e DB_HOST=your-db-host \
  -e DB_PORT=3306 \
  -e DB_USER=youruser \
  -e DB_PASSWORD=yourpass \
  -e DB_NAME=harmony_bot \
  -e HARMONY_RPC_URL=https://api.harmony.one \
  -e HOT_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
  -e HOT_WALLET_ADDRESS=0xYOUR_HOT_WALLET_ADDRESS \
  -e PROXY_URL="socks5://user:pass@host:port" \
  harmony-telegram-wallet-bot
```

> ⚠️ **هشدار امنیتی:** این پروژه یک نمونه‌ی آموزشی است. برای استفاده در محیط واقعی حتماً:
> - Private Key ها را رمزگذاری و در secret manager نگه‌داری کنید
> - دسترسی دیتابیس و سرور را محدود کنید
> - محدودیت برداشت، لاگ‌گیری و مانیتورینگ امنیتی اضافه کنید.
