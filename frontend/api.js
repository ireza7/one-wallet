const authHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Telegram-Init-Data': window.__INIT_DATA || ''
});

const withInitData = (payload = {}) => ({
  initData: window.__INIT_DATA,
  ...payload,
});

const API = {
  async authWithTelegram(initData) {
    const res = await fetch('/api/user/auth', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ initData }),
    });
    return res.json();
  },

  async me() {
    const qs = window.__INIT_DATA
      ? `?initData=${encodeURIComponent(window.__INIT_DATA)}`
      : '';
    const res = await fetch(`/api/wallet/me${qs}`, { headers: authHeaders() });
    return res.json();
  },

  async transfer(toUsername, amount) {
    const res = await fetch('/api/wallet/transfer', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(withInitData({ to_username: toUsername, amount })),
    });
    return res.json();
  },

  async withdraw(toAddress, amount) {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(withInitData({ to_address: toAddress, amount })),
    });
    return res.json();
  },

  async history() {
    const qs = window.__INIT_DATA
      ? `?initData=${encodeURIComponent(window.__INIT_DATA)}`
      : '';
    const res = await fetch(`/api/wallet/history${qs}`, { headers: authHeaders() });
    return res.json();
  },

  async annotate(ledgerId, label, note) {
    const res = await fetch('/api/wallet/annotate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(withInitData({ ledger_id: ledgerId, label, note })),
    });
    return res.json();
  },

  // Manual deposit check + auto sweep
  async checkDeposit() {
    const res = await fetch('/api/wallet/check-deposit', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(withInitData())
    });
    return res.json();
  },
};
