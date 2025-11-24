# Harmony ONE Telegram Mini App Wallet

این پروژه یک **Telegram Mini App** به عنوان کیف‌پول Harmony ONE است که:

- برای هر کاربر یک آدرس اختصاصی Harmony ایجاد می‌کند
- فقط **ولت‌های کاربران** را مانیتور می‌کند (نه کل شبکه)
- هر زمان موجودی آدرس کاربر روی زنجیره زیاد شود:
  - آن مقدار به **موجودی داخلی** کاربر اضافه می‌شود
  - همان مقدار از ولت کاربر به **هات‌ولت** منتقل (sweep) می‌شود
- کاربران می‌توانند:
  - موجودی داخلی خود را ببینند
  - به کاربران دیگر (با username) انتقال داخلی بدهند
  - به آدرس دلخواه Harmony برداشت بزنند

این پروژه شامل:

- Backend: Node.js + Express + MySQL + Web3
- Frontend: Telegram WebApp (Mini App) ساده با HTML/JS
- اسکریپت مانیتورینگ: `backend/monitor.js`
- Dockerfile برای اجرا در یک کانتینر

> ⚠️ این پروژه نمونه‌ی آموزشی است؛ قبل از استفاده در محیط واقعی حتماً به امنیت، مدیریت Private Keyها و محدودیت‌ها توجه کنید.

## راه‌اندازی

### 1. دیتابیس

فایل `sql/schema.sql` را روی دیتابیس MySQL خارجی خود اجرا کنید:

```sql
SOURCE sql/schema.sql;
```

یا محتوایش را در یک ابزار مثل phpMyAdmin / DBeaver اجرا کنید.

### 2. تنظیم متغیرهای محیطی

یک فایل `.env` در روت پروژه بسازید (کنار `package.json`) و مقادیر را از روی `.env.example` پر کنید:

```bash
cp .env.example .env
```

مقادیر مهم:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `HARMONY_RPC_URL`
- `HOT_WALLET_PRIVATE_KEY`, `HOT_WALLET_ADDRESS`

### 3. اجرای لوکال

```bash
npm install
npm run dev
```

Backend روی `http://localhost:3000` اجرا می‌شود و frontend از پوشه `frontend/` به صورت استاتیک سرو می‌شود.

### 4. اجرای با Docker

```bash
docker build -t harmony-miniapp-wallet .

docker run -d \
  --name harmony-miniapp-wallet \
  -p 3000:3000 \
  -e DB_HOST=your-db-host \
  -e DB_PORT=3306 \
  -e DB_USER=youruser \
  -e DB_PASSWORD=yourpass \
  -e DB_NAME=harmony_miniapp \
  -e HARMONY_RPC_URL=https://api.harmony.one \
  -e HOT_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
  -e HOT_WALLET_ADDRESS=0xYOUR_HOT_WALLET_ADDRESS \
  harmony-miniapp-wallet
```

### 5. تنظیم Mini App در BotFather

در BotFather:

1. یک Bot بسازید (اگر نداری)
2. دستور `/setdomain` یا `/setmenubutton` (بسته به حالت Mini App)
3. URL وب‌اپ را بدهید، مثلاً:

```
https://your-domain.com/
```

این URL باید `frontend/index.html` را سرو کند (در این پروژه Express همین کار را انجام می‌دهد).

### 6. نحوه کار مانیتورینگ ولت‌ها

اسکریپت `backend/monitor.js` هر چند ثانیه:

- لیست تمام کاربران را از جدول `users` می‌گیرد
- موجودی زنجیره‌ای (`on-chain`) آدرس هر کاربر را با `web3.eth.getBalance` می‌خواند
- اگر `chainBalance > last_onchain_balance` بود:
  - `diff = chainBalance - last_onchain_balance` به عنوان **واریز جدید** در نظر گرفته می‌شود
  - `internal_balance` کاربر به اندازه `diff` افزایش می‌یابد
  - در `wallet_ledger` یک رکورد `deposit` ثبت می‌شود
  - سپس همان `diff` از ولت کاربر به `HOT_WALLET_ADDRESS` سوییپ می‌شود
  - `deposit_sweep` در لجر ثبت می‌شود
  - مقدار `last_onchain_balance` به موجودی جدید شبکه آپدیت می‌شود

به این شکل فقط **ولت‌های کاربران** مانیتور می‌شوند و نیازی به اسکن کل بلاک‌چین نیست.
