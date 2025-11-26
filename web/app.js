// app.js (نسخه بدون صفحه لودینگ)

const tg = window.Telegram?.WebApp || null;

function api(path, data) {
  const payload = Object.assign({}, data || {});

  if (!payload.initData && tg?.initData) {
    payload.initData = tg.initData;
  }

  return fetch("/api" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(r => r.json())
    .catch(() => {
      return { ok: false, error: 'network_error' };
    });
}

// بدون هیچ لودری
function setStatus(msg) {
  console.log(msg);
}

// حذف کامل overlay
function hideLoader() {}
function showError(msg) { alert(msg); }

async function initApp() {
  try {
    if (!tg) {
      showError("لطفاً Mini App را داخل تلگرام باز کنید.");
      return;
    }

    tg.ready?.();

    const initData = tg.initData;
    const unsafe = tg.initDataUnsafe;

    if (!unsafe?.user?.id) {
      showError("کاربر در تلگرام شناسایی نشد.");
      return;
    }

    const resp = await api('/init', { initData });

    if (!resp.ok) {
      showError(resp.error || "خطا در ورود");
      return;
    }

    const depositAddressEl = document.getElementById('deposit-address');
    if (depositAddressEl && resp.user?.deposit_address) {
      depositAddressEl.innerText = resp.user.deposit_address;
    }

    await refreshBalance();
    setInterval(refreshBalance, 15000);

  } catch (err) {
    console.log(err);
    showError("خطا در اجرای اپلیکیشن");
  }
}

async function refreshBalance() {
  try {
    const initData = tg?.initData;
    if (!initData) return;

    const res = await api('/balance', { initData });
    if (!res.ok) return;

    const balanceEl = document.getElementById('balance-one');
    if (balanceEl) balanceEl.innerText = res.balance + " ONE";
  } catch {}
}

async function checkDeposit() {
  try {
    const initData = tg?.initData;
    if (!initData) return showError("initData موجود نیست.");

    const d = await api('/check-deposit', { initData });

    if (d.rate_limited) return alert(d.error);
    if (!d.ok) return alert(d.error || "خطا");

    alert(d.message);
    await refreshBalance();

  } catch {
    alert("خطا در بررسی واریز");
  }
}

async function showBalanceAlert() {
  const initData = tg?.initData;
  if (!initData) return alert("initData موجود نیست.");

  const d = await api('/balance', { initData });
  if (d.ok) alert("موجودی شما: " + d.balance + " ONE");
}

async function withdraw() {
  try {
    const initData = tg?.initData;
    if (!initData) return alert("initData موجود نیست.");

    const addr = document.getElementById('withdrawAddress').value.trim();
    const amt = Number(document.getElementById('withdrawAmount').value);

    if (!addr || !amt) return alert("اطلاعات برداشت کامل نیست.");

    const d = await api('/withdraw', { initData, address: addr, amount: amt });
    if (!d.ok) return alert(d.error || "خطای برداشت");

    alert("برداشت انجام شد.\nTX: " + d.txHash);
    await refreshBalance();

  } catch {
    alert("خطا در برداشت");
  }
}

async function loadHistory() {
  try {
    const initData = tg?.initData;
    if (!initData) return alert("initData موجود نیست.");

    const data = await api('/history', { initData });
    if (!data.ok) return alert("خطا در دریافت تاریخچه");

    const list = document.getElementById('history-list');
    if (!list) return;

    list.innerHTML = "";
    data.history.forEach(tx => {
      const item = document.createElement('div');
      item.className = "history-item";
      item.innerHTML = `
        <strong>${tx.tx_type}</strong><br>
        مبلغ: ${tx.amount}<br>
        هش: ${tx.tx_hash}
      `;
      list.appendChild(item);
    });

  } catch {
    alert("خطا در تاریخچه");
  }
}

window.onload = initApp;
