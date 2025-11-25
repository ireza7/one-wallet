const tg = window.Telegram?.WebApp;

let currentUser = null;

const loading = document.getElementById('loading');
const walletShell = document.getElementById('walletShell');

const walletView = document.getElementById('walletView');
const historyView = document.getElementById('historyView');
const qrView = document.getElementById('qrView');
const settingsView = document.getElementById('settingsView');

const tabWallet = document.getElementById('tabWallet');
const tabHistory = document.getElementById('tabHistory');
const tabQR = document.getElementById('tabQR');
const tabSettings = document.getElementById('tabSettings');

const addressEl = document.getElementById('address');
const balanceEl = document.getElementById('balance');
const msgEl = document.getElementById('message');
const qrAddressEl = document.getElementById('qrAddress');

const annotateModal = document.getElementById('annotateModal');
const annotateLabelInput = document.getElementById('annotateLabel');
const annotateNoteInput = document.getElementById('annotateNote');
const annotateSaveBtn = document.getElementById('annotateSave');
const annotateCancelBtn = document.getElementById('annotateCancel');

let currentLedgerId = null;

function hideAllViews() {
  walletView.classList.add('hidden');
  historyView.classList.add('hidden');
  qrView.classList.add('hidden');
  settingsView.classList.add('hidden');

  tabWallet.classList.remove('active');
  tabHistory.classList.remove('active');
  tabQR.classList.remove('active');
  tabSettings.classList.remove('active');
}

async function initApp() {
  try {
    const res = await API.me();
    if (!res.ok) {
      loading.textContent = 'خطا در دریافت اطلاعات کیف‌پول';
      return;
    }

    currentUser = res.user;
    addressEl.textContent = currentUser.harmony_address || '(آدرس تنظیم نشده است)';
    balanceEl.textContent = `${currentUser.internal_balance} ONE`;
    qrAddressEl.textContent = currentUser.harmony_address || '';

    loading.classList.add('hidden');
    walletShell.classList.remove('hidden');

    generateQR();
  } catch (err) {
    console.error(err);
    loading.textContent = 'خطا در اتصال به سرور';
  }
}

function generateQR() {
  const canvas = document.getElementById('qrCanvas');
  if (!currentUser || !currentUser.harmony_address || !window.qrcode) return;

  const qr = window.qrcode(0, 'L');
  qr.addData(currentUser.harmony_address);
  qr.make();

  const tileW = 4;
  const tileH = 4;
  const size = qr.getModuleCount() * tileW;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#22c55e';
  for (let r = 0; r < qr.getModuleCount(); r++) {
    for (let c = 0; c < qr.getModuleCount(); c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(c * tileW, r * tileH, tileW, tileH);
      }
    }
  }
}

tabWallet.onclick = () => {
  hideAllViews();
  tabWallet.classList.add('active');
  walletView.classList.remove('hidden');
};

tabHistory.onclick = () => {
  hideAllViews();
  tabHistory.classList.add('active');
  historyView.classList.remove('hidden');
  loadHistory();
};

tabQR.onclick = () => {
  hideAllViews();
  tabQR.classList.add('active');
  qrView.classList.remove('hidden');
};

tabSettings.onclick = () => {
  hideAllViews();
  tabSettings.classList.add('active');
  settingsView.classList.remove('hidden');
};

document.getElementById('copyAddress').onclick = () => {
  if (!addressEl.textContent) return;
  navigator.clipboard.writeText(addressEl.textContent);
  tg?.showPopup?.({
    title: 'کپی شد',
    message: 'آدرس با موفقیت کپی شد!'
  });
};

document.getElementById('refreshBtn').onclick = refreshBalance;

document.getElementById('btnTransfer').onclick = async () => {
  msgEl.textContent = '';
  const toUser = document.getElementById('toUser').value.trim();
  const amt = Number(document.getElementById('amountTransfer').value);

  try {
    const data = await API.transfer(toUser, amt);
    msgEl.textContent = data.ok ? '✔ انتقال انجام شد' : '❌ ' + (data.error || 'خطا');
    refreshBalance();
  } catch (err) {
    console.error(err);
    msgEl.textContent = '❌ خطا در اتصال به سرور';
  }
};

document.getElementById('btnWithdraw').onclick = async () => {
  msgEl.textContent = '';
  const addr = document.getElementById('toAddress').value.trim();
  const amt = Number(document.getElementById('amountWithdraw').value);

  try {
    const data = await API.withdraw(addr, amt);
    msgEl.textContent = data.ok ? '✔ برداشت ثبت شد' : '❌ ' + (data.error || 'خطا');
    refreshBalance();
  } catch (err) {
    console.error(err);
    msgEl.textContent = '❌ خطا در اتصال به سرور';
  }
};

document.getElementById('btnCheckDeposit').onclick = async () => {
  const statusEl = document.getElementById('depositStatus');
  if (statusEl) {
    statusEl.textContent = 'در حال بررسی واریز روی شبکه...';
  }
  try {
    const res = await API.checkDeposit();
    if (res.success) {
      if (res.deposit) {
        if (statusEl) statusEl.textContent = '✅ واریز جدید شناسایی شد و اعمال شد';
        refreshBalance();
      } else {
        if (statusEl) statusEl.textContent = 'هیچ واریز جدیدی یافت نشد';
      }
    } else {
      if (statusEl) statusEl.textContent = res.message || 'بررسی واریز ناموفق بود';
    }
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = 'خطا در اتصال به سرور';
  }
};


async function refreshBalance() {
  if (!currentUser) return;
  try {
    const data = await API.me();
    if (data.ok) {
      currentUser = data.user;
      balanceEl.textContent = `${currentUser.internal_balance} ONE`;
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadHistory() {
  const box = document.getElementById('historyList');
  box.innerHTML = "<p class='text-slate-400 text-sm'>در حال بارگذاری...</p>";

  try {
    const data = await API.history();
    if (!data.ok) {
      box.innerHTML = "<p class='text-red-400'>خطا در دریافت تاریخچه</p>";
      return;
    }

    if (!data.history.length) {
      box.innerHTML = "<p class='text-slate-400'>بدون تراکنش</p>";
      return;
    }

    box.innerHTML = '';
    data.history.forEach(h => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <p class="font-bold mb-1">${mapType(h.type)}</p>
        <p class="balance">${h.amount} ONE</p>
        ${h.tx_hash ? `<p class="text-xs mono break-all">tx: ${h.tx_hash}</p>` : ''}
        ${h.label ? `<p class="text-blue-300 text-sm">برچسب: ${h.label}</p>` : ''}
        ${h.note ? `<p class="text-slate-300 text-sm">توضیح: ${h.note}</p>` : ''}
        <button class="btn-edit" data-id="${h.id}">ویرایش برچسب/توضیح</button>
        <p class="text-xs mt-2 text-slate-500">${new Date(h.created_at).toLocaleString('fa-IR')}</p>
      `;
      box.appendChild(div);
    });

    initializeAnnotateButtons();
  } catch (err) {
    console.error(err);
    box.innerHTML = "<p class='text-red-400'>خطا در اتصال به سرور</p>";
  }
}

function mapType(t) {
  switch (t) {
    case 'deposit': return 'واریز';
    case 'deposit_sweep': return 'انتقال به هات‌ولت';
    case 'withdraw': return 'برداشت';
    case 'internal_in': return 'دریافت داخلی';
    case 'internal_out': return 'ارسال داخلی';
    default: return t;
  }
}

function initializeAnnotateButtons() {
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.onclick = () => openAnnotateModal(btn.dataset.id);
  });
}

function openAnnotateModal(ledgerId) {
  currentLedgerId = ledgerId;
  annotateLabelInput.value = '';
  annotateNoteInput.value = '';
  annotateModal.classList.remove('hidden');
}

annotateCancelBtn.onclick = () => {
  annotateModal.classList.add('hidden');
};

annotateSaveBtn.onclick = async () => {
  if (!currentLedgerId) return;
  const label = annotateLabelInput.value.trim();
  const note = annotateNoteInput.value.trim();

  try {
    const res = await API.annotate(currentLedgerId, label, note);
    if (res.ok) {
      tg?.showPopup?.({ title: 'ذخیره شد', message: 'تغییرات با موفقیت ذخیره شد' });
      annotateModal.classList.add('hidden');
      loadHistory();
    } else {
      tg?.showPopup?.({ title: 'خطا', message: res.error || 'خطا در ذخیره' });
    }
  } catch (err) {
    console.error(err);
    tg?.showPopup?.({ title: 'خطا', message: 'خطا در اتصال به سرور' });
  }
};

// auto refresh balance
setInterval(refreshBalance, 7000);

window.initApp = initApp;
