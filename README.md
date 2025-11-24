# Harmony ONE Telegram Mini App Wallet (Fixed Addresses)

این پروژه یک **Telegram Mini App** است که به عنوان کیف‌پول Harmony ONE عمل می‌کند:

- برای هر کاربر یک ولت اختصاصی ساخته می‌شود
- دو نوع آدرس برای هر کاربر نگه‌داری می‌شود:
  - `harmony_address` → فرمت Harmony (bech32) مثل: `one1...` (برای نمایش به کاربر)
  - `harmony_hex` → فرمت hex مثل: `0x...` (برای کار با Web3 و شبکه)
- فقط ولت‌های کاربران مانیتور می‌شود (نه کل شبکه)
- هر زمان موجودی on-chain آدرس کاربر افزایش پیدا کند:
  - اختلاف (`diff`) به `internal_balance` کاربر اضافه می‌شود
  - همان مقدار از ولت کاربر به هات ولت منتقل (sweep) می‌شود
- کاربران می‌توانند:
  - موجودی داخلی خود را ببینند
  - به کاربران دیگر (بر اساس username) انتقال داخلی انجام دهند
  - به آدرس دلخواه Harmony برداشت بزنند (`one1...` یا `0x...`)

## ساختار پروژه

- `backend/`
  - `app.js` → Express API + سرو کردن frontend
  - `config.js` → تنظیمات محیطی (env)
  - `db.js` → اتصال MySQL و منطق کاربران/تراکنش‌ها
  - `harmony.js` → اتصال به Harmony (Web3 v4)، ساخت ولت، سوییپ، برداشت
  - `monitor.js` → مانیتورینگ فقط ولت‌های کاربران، تشخیص واریز و سوییپ خودکار
  - `routes/user.js` → API مربوط به کاربر (`/api/user/init`)
  - `routes/wallet.js` → API ولت (`/api/wallet/me`, `/transfer`, `/withdraw`)
  - `utils/harmonyAddress.js` → تبدیل HEX ↔ bech32 (بدون نیاز به پکیج اضافه)
- `frontend/`
  - `index.html` → UI Mini App (درون Telegram WebApp)
  - `style.css` → استایل تیره
  - `app.js` → اتصال به Telegram WebApp + فراخوانی APIها
- `sql/schema.sql` → ساخت جدول‌های لازم در دیتابیس موجود شما
- `Dockerfile`
- `.env.example`

## راه‌اندازی

### 1. ساخت جداول در دیتابیس خودت

در MySQL، دیتابیس خودت را انتخاب کن:

```sql
USE yourdbname;
SOURCE sql/schema.sql;
```

یا محتوای `sql/schema.sql` را در دیتابیس فعلی اجرا کن.

### 2. تنظیم متغیرهای محیطی

یک فایل `.env` بساز (کنار `package.json`) و مقادیر را مثل `.env.example` پر کن:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `HARMONY_RPC_URL`
- `HARMONY_CHAIN_ID` (Mainnet: 1666600000, Testnet: 1666700000)
- `HOT_WALLET_PRIVATE_KEY`, `HOT_WALLET_ADDRESS`

### 3. اجرای لوکال

```bash
npm install
npm run dev
```

Backend روی `http://localhost:3000` اجرا می‌شود و frontend هم از همانجا سرو می‌شود.

### 4. اجرای با Docker

```bash
docker build -t harmony-miniapp-wallet-fixed .

docker run -d \
  --name harmony-miniapp-wallet-fixed \
  -p 3000:3000 \
  -e DB_HOST=your-db-host \
  -e DB_PORT=3306 \
  -e DB_USER=youruser \
  -e DB_PASSWORD=yourpass \
  -e DB_NAME=yourdbname \
  -e HARMONY_RPC_URL=https://api.harmony.one \
  -e HARMONY_CHAIN_ID=1666600000 \
  -e HOT_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
  -e HOT_WALLET_ADDRESS=0xYOUR_HOT_WALLET_ADDRESS \
  harmony-miniapp-wallet-fixed
```

### 5. تنظیم Mini App در BotFather

در BotFather، URL Mini App را روی آدرس دامنه‌ای که backend را سرو می‌کند تنظیم کن، مثلاً:

```
https://your-domain.com/
```

(در این پروژه، روت (`/`) همان `frontend/index.html` را برمی‌گرداند.)

### 6. مانیتورینگ ولت‌ها

فایل `backend/monitor.js` هر ۷ ثانیه:

1. لیست کاربران را از جدول `users` می‌خواند
2. موجودی on-chain آدرس hex هر کاربر (`harmony_hex`) را از Harmony RPC می‌گیرد
3. اگر موجودی جدید > آخرین موجودی ذخیره‌شده (`last_onchain_balance`):
   - اختلاف (`diff`) به `internal_balance` اضافه می‌شود
   - رکورد `deposit` در `wallet_ledger` ثبت می‌شود
   - به اندازه‌ی `diff` از ولت کاربر به هات ولت سوییپ می‌شود
   - رکورد `deposit_sweep` در `wallet_ledger` ثبت می‌شود
   - مقدار `last_onchain_balance` به موجودی جدید به‌روزرسانی می‌شود

به این شکل فقط **ولت‌های کاربران** مانیتور می‌شوند و نیازی به اسکن کل بلاک‌چین نیست.
