const API = {
  async authWithTelegram(initData) {
    const res = await fetch('/api/user/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    return res.json();
  },

  async withdraw(amount) {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    return res.json();
  },

  // Manual deposit check + auto sweep
  async checkDeposit() {
    const res = await fetch('/api/wallet/check-deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.__INIT_DATA })
    });
    return res.json();
  },
};
