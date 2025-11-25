// Unified API wrapper with Telegram WebApp auth

function getInitData() {
  const initData = window.__INIT_DATA;
  if (!initData) {
    throw new Error('Telegram initData هنوز ست نشده است');
  }
  return initData;
}

async function authedPost(url, body = {}) {
  const initData = getInitData();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData
    },
    body: JSON.stringify({
      ...body,
      initData
    })
  });

  return res.json();
}

const API = {
  async authWithTelegram(initDataFromCall) {
    if (initDataFromCall) {
      window.__INIT_DATA = initDataFromCall;
    }
    return authedPost('/api/user/auth');
  },

  async withdraw(to_address, amount) {
    return authedPost('/api/wallet/withdraw', { to_address, amount });
  },

  async checkDeposit() {
    return authedPost('/api/wallet/check-deposit');
  },

  async transfer(to_username, amount) {
    return authedPost('/api/wallet/transfer', { to_username, amount });
  },

  async history() {
    return authedPost('/api/wallet/history');
  },

  async annotate(ledger_id, label, note) {
    return authedPost('/api/wallet/annotate', { ledger_id, label, note });
  },

  async me() {
    const initData = getInitData();
    const res = await fetch('/api/wallet/me', {
      headers: {
        'X-Telegram-Init-Data': initData
      }
    });
    return res.json();
  }
};

window.API = API;
