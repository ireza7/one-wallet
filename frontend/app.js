const tg = window.Telegram.WebApp;
tg.expand();

const statusEl = document.getElementById('status');
const walletEl = document.getElementById('wallet');
const addressEl = document.getElementById('address');
const balanceEl = document.getElementById('balance');
const msgEl = document.getElementById('message');

const toUserInput = document.getElementById('toUser');
const amountTransferInput = document.getElementById('amountTransfer');
const btnTransfer = document.getElementById('btnTransfer');

const toAddressInput = document.getElementById('toAddress');
const amountWithdrawInput = document.getElementById('amountWithdraw');
const btnWithdraw = document.getElementById('btnWithdraw');

let currentUser = null;

async function init() {
  try {
    const user = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (!user) {
      statusEl.innerText = 'خطا: اطلاعات کاربر تلگرام در دسترس نیست.';
      return;
    }

    statusEl.innerText = 'در حال دریافت اطلاعات کیف‌پول...';

    const res = await fetch('/api/user/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: user.id,
        username: user.username || null,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      statusEl.innerText = 'خطا در init: ' + (data.error || 'unknown');
      return;
    }

    currentUser = data.user;

    addressEl.innerText = currentUser.harmony_address;
    balanceEl.innerText = currentUser.internal_balance + ' ONE';

    statusEl.classList.add('hidden');
    walletEl.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    statusEl.innerText = 'خطای اتصال به سرور';
  }
}

async function refreshBalance() {
  if (!currentUser) return;
  try {
    const res = await fetch(
      '/api/wallet/me?telegram_id=' + encodeURIComponent(currentUser.telegram_id)
    );
    const data = await res.json();
    if (data.ok) {
      currentUser = data.user;
      balanceEl.innerText = currentUser.internal_balance + ' ONE';
    }
  } catch (err) {
    console.error('refreshBalance error', err);
  }
}

btnTransfer.addEventListener('click', async () => {
  msgEl.innerText = '';
  try {
    const toUsername = toUserInput.value.trim().replace(/^@/, '');
    const amount = Number(amountTransferInput.value);
    if (!toUsername || !amount) {
      msgEl.innerText = 'گیرنده و مبلغ را وارد کنید.';
      return;
    }

    const res = await fetch('/api/wallet/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_telegram_id: currentUser.telegram_id,
        to_username: toUsername,
        amount,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      msgEl.innerText = 'خطا در انتقال: ' + (data.error || 'unknown');
      return;
    }

    msgEl.innerText = '✅ انتقال انجام شد.';
    amountTransferInput.value = '';
    toUserInput.value = '';

    await refreshBalance();
  } catch (err) {
    console.error(err);
    msgEl.innerText = 'خطای اتصال به سرور.';
  }
});

btnWithdraw.addEventListener('click', async () => {
  msgEl.innerText = '';
  try {
    const addr = toAddressInput.value.trim();
    const amount = Number(amountWithdrawInput.value);
    if (!addr || !amount) {
      msgEl.innerText = 'آدرس و مبلغ را وارد کنید.';
      return;
    }

    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: currentUser.telegram_id,
        to_address: addr,
        amount,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      msgEl.innerText = 'خطا در برداشت: ' + (data.error || 'unknown');
      return;
    }

    msgEl.innerText = '✅ برداشت ثبت شد. TX: ' + data.tx_hash;
    amountWithdrawInput.value = '';
    toAddressInput.value = '';

    await refreshBalance();
  } catch (err) {
    console.error(err);
    msgEl.innerText = 'خطای اتصال به سرور.';
  }
});

setInterval(refreshBalance, 10000);

init();
