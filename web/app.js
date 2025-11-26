const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

function api(path, data) {
  const payload = Object.assign({}, data || {});
  // به صورت پیش‌فرض initData را از Telegram WebApp اضافه می‌کنیم
  if (!payload.initData && tg && tg.initData) {
    payload.initData = tg.initData;
  }

  return fetch("/api" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(r => r.json());
}

function setStatus(msg) {
  const el = document.getElementById("loader-status");
  if (el) el.innerText = msg;
}

function showError(msg) {
  alert(msg);
}

function hideLoader() {
  const overlay = document.getElementById('loader-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function initApp() {
  try {
    if (!tg) {
      showError("لطفاً این Mini App را از داخل تلگرام باز کنید.");
      return;
    }

    tg.ready && tg.ready();

    setStatus("در حال شناسایی کاربر...");

    const initData = tg.initData;
    const unsafe = tg.initDataUnsafe;

    if (!unsafe || !unsafe.user || !unsafe.user.id) {
      showError("Mini App را از داخل ربات باز کنید.");
      return;
    }

    setStatus("در حال ورود...");

    const resp = await api('/init', { initData });

    if (!resp.ok) {
      showError(resp.error || 'خطا در ورود');
      return;
    }

    document.getElementById('deposit-address').innerText = resp.user.deposit_address;

    hideLoader();
    await refreshBalance();
    setInterval(refreshBalance, 15000);
  } catch (err) {
    showError("خطا در اجرای برنامه");
  }
}

async function refreshBalance() {
  try {
    const initData = tg.initData;
    const res = await api('/balance', { initData });

    if (!res.ok) return;

    const balanceEl = document.getElementById('balance-one');
    if (balanceEl) balanceEl.innerText = res.balance + " ONE";
  } catch { }
}

async function checkDeposit() {
  try {
    const initData = tg.initData;
    const d = await api('/check-deposit', { initData });

    if (d.rate_limited) {
      alert(d.error);
      return;
    }

    alert(d.message);
    await refreshBalance();
  } catch {
    alert("خطا در بررسی واریز");
  }
}

async function showBalanceAlert() {
  const initData = tg.initData;
  const d = await api('/balance', { initData });

  if (d.ok) alert("موجودی شما: " + d.balance + " TON");
}

async function withdraw() {
  try {
    const initData = tg.initData;

    const addr = document.getElementById('withdrawAddress').value.trim();
    const amt = Number(document.getElementById('withdrawAmount').value);

    if (!addr || !amt) return alert("لطفاً اطلاعات برداشت را کامل وارد کنید.");

    const d = await api('/withdraw', { initData, address: addr, amount: amt });

    if (!d.ok) {
      alert(d.error || "خطای برداشت");
      return;
    }

    alert("درخواست برداشت ثبت شد.\nTransaction: " + d.txHash);
    await refreshBalance();

  } catch {
    alert("خطا در برداشت");
  }
}

async function loadHistory() {
  try {
    const initData = tg.initData;
    const data = await api('/history', { initData });

    if (!data.ok) {
      alert("خطا در دریافت تاریخچه");
      return;
    }

    const list = document.getElementById('history-list');
    list.innerHTML = "";

    data.history.forEach(tx => {
      const item = document.createElement('div');
      item.className = "history-item";
      item.innerHTML = `
        <strong>${tx.type}</strong><br>
        مبلغ: ${tx.amount}<br>
        هش: ${tx.tx_hash}
      `;
      list.appendChild(item);
    });

  } catch {
    alert("خطا در بارگذاری تاریخچه");
  }
}

window.onload = initApp;