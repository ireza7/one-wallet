
const tg = window.Telegram.WebApp;
tg.expand();

const statusEl = document.getElementById('status');
const walletShellEl = document.getElementById('walletShell');

const tabWalletBtn = document.getElementById('tabWallet');
const tabHistoryBtn = document.getElementById('tabHistory');
const tabWalletView = document.getElementById('tabWalletView');
const tabHistoryView = document.getElementById('tabHistoryView');

const addressEl = document.getElementById('address');
const balanceEl = document.getElementById('balance');
const msgEl = document.getElementById('message');

const toUserInput = document.getElementById('toUser');
const amountTransferInput = document.getElementById('amountTransfer');
const btnTransfer = document.getElementById('btnTransfer');

const toAddressInput = document.getElementById('toAddress');
const amountWithdrawInput = document.getElementById('amountWithdraw');
const btnWithdraw = document.getElementById('btnWithdraw');

const historyListEl = document.getElementById('historyList');

let currentUser = null;

function showTab(name) {
  if (name === 'wallet') {
    tabWalletBtn.classList.add('active');
    tabHistoryBtn.classList.remove('active');
    tabWalletView.classList.remove('hidden');
    tabHistoryView.classList.add('hidden');
  } else {
    tabWalletBtn.classList.remove('active');
    tabHistoryBtn.classList.add('active');
    tabWalletView.classList.add('hidden');
    tabHistoryView.classList.remove('hidden');
    loadHistory();
  }
}

tabWalletBtn.addEventListener('click', () => showTab('wallet'));
tabHistoryBtn.addEventListener('click', () => showTab('history'));

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
    walletShellEl.classList.remove('hidden');
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

    msgEl.innerText = '✅ انتقال داخلی انجام شد.';
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

async function loadHistory() {
  if (!currentUser) return;
  try {
    historyListEl.innerHTML = '<p class="label">در حال بارگذاری...</p>';

    const res = await fetch(
      '/api/wallet/history?telegram_id=' + encodeURIComponent(currentUser.telegram_id)
    );
    const data = await res.json();

    if (!data.ok) {
      historyListEl.innerHTML = '<p class="label">خطا در دریافت تاریخچه.</p>';
      return;
    }

    if (!data.history.length) {
      historyListEl.innerHTML = '<p class="label">تراکنشی ثبت نشده است.</p>';
      return;
    }

    historyListEl.innerHTML = '';

    data.history.forEach(item => {
      const div = document.createElement('div');
      div.className = 'tx-card';

      const typeClass = 'tx-type ' + item.type;

      const labelBadge = item.label
        ? `<span class="badge badge-label">${item.label}</span>`
        : '';

      const noteHtml = item.note
        ? `<div class="tx-note"><span>توضیح:</span> ${escapeHtml(item.note)}</div>`
        : '';

      const hashShort = item.tx_hash
        ? item.tx_hash.slice(0, 10) + '...'
        : '';

      div.innerHTML = `
        <div class="tx-header">
          <div class="${typeClass}">${mapType(item.type)}</div>
          <div class="tx-amount">${item.amount} ONE</div>
        </div>
        <div class="tx-meta">
          ${labelBadge}
          ${item.tx_hash ? `<span class="badge">TX: ${hashShort}</span>` : ''}
        </div>
        ${noteHtml}
        <div class="tx-date">
          ${new Date(item.created_at).toLocaleString('fa-IR')}
        </div>
        <div class="tx-actions">
          <button class="edit-btn" data-id="${item.id}">ویرایش / توضیح</button>
        </div>
      `;

      const btn = div.querySelector('.edit-btn');
      btn.addEventListener('click', () => editTx(item.id, item.label, item.note));

      historyListEl.appendChild(div);
    });
  } catch (err) {
    console.error('loadHistory error', err);
    historyListEl.innerHTML = '<p class="label">خطا در دریافت تاریخچه.</p>';
  }
}

function mapType(type) {
  switch (type) {
    case 'deposit': return 'واریز';
    case 'deposit_sweep': return 'انتقال به هات‌ولت';
    case 'withdraw': return 'برداشت';
    case 'internal_in': return 'دریافت داخلی';
    case 'internal_out': return 'ارسال داخلی';
    case 'admin_adjust': return 'اصلاح مدیر';
    default: return type;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function editTx(id, currentLabel, currentNote) {
  const label = prompt('برچسب (مثلاً: خرید، تست، برداشت روزانه):', currentLabel || '');
  if (label === null) return;
  const note = prompt('توضیحات برای این تراکنش:', currentNote || '');
  if (note === null) return;

  try {
    const res = await fetch('/api/wallet/annotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: currentUser.telegram_id,
        ledger_id: id,
        label,
        note,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      alert('خطا در ذخیره توضیح/برچسب');
      return;
    }

    await loadHistory();
  } catch (err) {
    console.error('annotate error', err);
    alert('خطا در اتصال به سرور');
  }
}

setInterval(refreshBalance, 10000);

init();
