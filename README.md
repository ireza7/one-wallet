# Harmony ONE Telegram Mini App Wallet

Mini app بک‌اند + فرانت‌اند برای مدیریت ولت‌های Harmony ONE بر پایه HD Wallet و هات‌ولت تجمیعی.

## ویژگی‌ها

- تولید ولت اختصاصی برای هر کاربر بر اساس HD Wallet (مسیر `m/44'/1023'/0'/0/index`)
- عدم ذخیره private key کاربران در دیتابیس
- هات‌ولت تجمیعی
- بررسی واریز بر اساس تاریخچه تراکنش‌ها و ثبت در جدول `deposit_txs`
- Sweep خودکار موجودی ولت کاربر به هات‌ولت
- برداشت از موجودی داخلی کاربر
- Dockerfile برای اجرا در کانتینر

## راه‌اندازی

1. ساخت دیتابیس MySQL و اجرای:

   ```sql
   SOURCE schema.sql;
   ```

2. ساخت فایل `.env` بر اساس `.env.example` و پر کردن مقادیر:

3. نصب وابستگی‌ها:

   ```bash
   npm install
   ```

4. اجرای توسعه:

   ```bash
   npm run dev
   ```

5. اجرای پروDUCTION (خارج از Docker):

   ```bash
   NODE_ENV=production npm start
   ```

## اجرای Docker

```bash
docker build -t harmony-one-telegram-miniapp .
docker run -d --name harmony-miniapp -p 3000:3000 --env-file .env harmony-one-telegram-miniapp
```

## Telegram Mini App

- فرانت‌اند در پوشه `web/`
- برای استفاده به عنوان Mini App، URL سرویس (مثلاً `https://your-domain.com/`) را در BotFather برای WebApp تعریف کنید.
- سمت کلاینت مقادیر `Telegram.WebApp.initDataUnsafe` به سرور ارسال می‌شود تا کاربر شناسایی شود (در پروداکشن امضا را باید verify کنید).
