
# Harmony ONE Telegram Mini App Wallet – Full Version

- Unified backend (API + monitor) in a single Node.js process
- MySQL database: `targo`
- Harmony ONE wallet per user (bech32 one1... + 0x hex)
- Auto-detect on-chain deposits, credit internal balance, sweep to hot wallet
- Internal transfers between users
- Withdraw to external Harmony address (one1... or 0x...)
- Transaction history + ledger with labels and notes
- Stylish Telegram Mini App frontend

## Setup

1. Create tables in MySQL:

```sql
USE targo;
SOURCE sql/schema.sql;
```

2. Copy `.env.example` to `.env` and fill in values.

3. Run locally:

```bash
npm install
npm start
```

4. Or via Docker:

```bash
docker build -t harmony-miniapp-wallet-full .
docker run -d \
  --name harmony-miniapp-wallet-full \
  -p 3000:3000 \
  -e DB_HOST=test-botdb-c8qmua \
  -e DB_PORT=3306 \
  -e DB_USER=targo \
  -e DB_PASSWORD=YOUR_PASSWORD_HERE \
  -e DB_NAME=targo \
  -e HARMONY_RPC_URL=https://api.harmony.one \
  -e HARMONY_CHAIN_ID=1666600000 \
  -e HOT_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
  -e HOT_WALLET_ADDRESS=0xYOUR_HOT_WALLET_ADDRESS \
  harmony-miniapp-wallet-full
```
