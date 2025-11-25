# Harmony ONE Telegram Mini App Wallet (ethers.js version)

این پروژه یک بک‌اند + وب‌اپ (Telegram Mini App) برای ولت هارمونی ONE است:

- ولت اختصاصی برای هر کاربر با HD Wallet (مسیر `m/44'/1023'/0'/0/index`)
- فقط **یک** MASTER_MNEMONIC در `.env`
- Sweep واقعی از ولت کاربر به هات‌ولت
- آدرس‌هایی که به کاربر نمایش داده می‌شوند همگی به صورت `one1...`
- استفاده از `ethers.js` + RPC هارمونی (بدون SDKهای قدیمی)

## راه‌اندازی

1. دیتابیس MySQL بساز و `schema.sql` را اجرا کن.
2. یک فایل `.env` بر اساس `.env.example` بساز و مقادیر واقعی را وارد کن.
3. نصب وابستگی‌ها:

   ```bash
   npm install
   ```

4. اجرای توسعه:

   ```bash
   npm run dev
   ```

5. اجرای پروداکشن:

   ```bash
   NODE_ENV=production npm start
   ```

## Docker

```bash
docker build -t harmony-one-wallet-ethers .
docker run -d --name harmony-wallet -p 3000:3000 --env-file .env harmony-one-wallet-ethers
```

## تولید MASTER_MNEMONIC

```bash
npm run generate:mnemonic
```

خروجی را در `.env` در متغیر `MASTER_MNEMONIC` ذخیره کن (هرگز در گیت نگذار).
