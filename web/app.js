// web/app.js

// Telegram WebApp object (ایمن با optional chaining)
const tg = window.Telegram?.WebApp || null;

// فراخوانی API با تزریق خودکار initData
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
      return { ok: false, error: "network_error" };
    });
}

/* ===== نوار وضعیت کوچک به جای صفحه لودینگ ===== */

function setStatus(msg) {
  const bar = document.getElementById("status-bar");
  const text = document.getElementById("status-text");
  if (!bar || !text) return;
  text.innerText = msg;
  bar.classList.remove("hidden");
}

function clearStatus() {
  const bar = document.getElementById("status-bar");
  if (!bar) return;
  bar.classList.add("hidden");
}

function showError(msg) {
  alert(msg);
}

/* ======================= INIT / LOGIN ======================= */

async function initApp() {
  try {
    setStatus("در حال آماده‌سازی اپلیکیشن...");

    if (!tg) {
      clearStatus();
      showError("لطفاً این Mini App را از داخل تلگرام باز کنید.");
      return;
    }

    tg.ready?.();

    setStatus("در حال شناسایی کاربر...");

    const initData = tg.initData;
    const unsafe = tg.initDataUnsafe;

    if (!unsafe?.user?.id) {
      clearStatus();
      showError("کاربر تلگرام شناسایی نشد. Mini App را از داخل ربات باز کنید.");
      return;
    }

    setStatus("در حال ورود به والت...");

    const resp = await api("/init", { initData });

    if (!resp.ok) {
      if (resp.error === "invalid telegram auth") {
        showError("احراز هویت تلگرام نامعتبر است. Mini App را ببندید و دوباره از ربات باز کنید.");
      } else if (resp.error === "network_error") {
        showError("خطای شبکه. اتصال اینترنت یا سرور را بررسی کنید.");
      } else {
        showError(resp.error || "خطا در ورود");
      }
      clearStatus();
      return;
    }

    // مقداردهی آدرس واریز
    const depositAddressEl = document.getElementById("deposit-address");
    if (depositAddressEl && resp.user?.deposit_address) {
      depositAddressEl.innerText = resp.user.deposit_address;
    }

    setStatus("در حال دریافت موجودی...");
    await refreshBalance();
    clearStatus();

    // هر ۱۵ ثانیه موجودی را رفرش کن
    setInterval(refreshBalance, 15000);
  } catch (err) {
    console.error(err);
    clearStatus();
    showError("خطا در اجرای برنامه");
  }
}

/* ==================== عملیات‌های اصلی والت ==================== */

async function refreshBalance() {
  try {
    const initData = tg?.initData;
    if (!initData) return;

    const res = await api("/balance", { initData });
    if (!res.ok) return;

    const balanceEl = document.getElementById("balance-one");
    if (balanceEl) balanceEl.innerText = res.balance + " ONE";

    // اگر بعداً قیمت ONE اضافه کردی، اینجا می‌توانی USD را هم آپدیت کنی
    // const usdEl = document.getElementById("balance-usd");
    // ...
  } catch {
    // سایلنت
  }
}

async function checkDeposit() {
  try {
    const initData = tg?.initData;
    if (!initData) {
      return alert("initData در دسترس نیست. از داخل تلگرام وارد شوید.");
    }

    setStatus("در حال بررسی واریز...");
    const d = await api("/check-deposit", { initData });
    clearStatus();

    if (d.rate_limited) {
      alert(d.error);
      return;
    }

    if (!d.ok) {
      alert(d.error || "خطا در بررسی واریز");
      return;
    }

    alert(d.message);
    await refreshBalance();
  } catch {
    clearStatus();
    alert("خطا در بررسی واریز");
  }
}

async function showBalanceAlert() {
  const initData = tg?.initData;
  if (!initData) {
    return alert("initData در دسترس نیست. از داخل تلگرام وارد شوید.");
  }

  const d = await api("/balance", { initData });
  if (d.ok) alert("موجودی شما: " + d.balance + " ONE");
}

async function withdraw() {
  try {
    const initData = tg?.initData;
    if (!initData) {
      return alert("initData در دسترس نیست. از داخل تلگرام وارد شوید.");
    }

    const addr = document.getElementById("withdrawAddress").value.trim();
    const amt = Number(document.getElementById("withdrawAmount").value);

    if (!addr || !amt) return alert("لطفاً اطلاعات برداشت را کامل وارد کنید.");

    setStatus("در حال ثبت درخواست برداشت...");
    const d = await api("/withdraw", { initData, address: addr, amount: amt });
    clearStatus();

    if (!d.ok) {
      alert(d.error || "خطای برداشت");
      return;
    }

    alert("درخواست برداشت ثبت شد.\nTransaction: " + d.txHash);
    await refreshBalance();
  } catch {
    clearStatus();
    alert("خطا در برداشت");
  }
}

async function loadHistory() {
  try {
    const initData = tg?.initData;
    if (!initData) {
      return alert("initData در دسترس نیست. از داخل تلگرام وارد شوید.");
    }

    setStatus("در حال بارگذاری تاریخچه...");
    const data = await api("/history", { initData });
    clearStatus();

    if (!data.ok) {
      alert("خطا در دریافت تاریخچه");
      return;
    }

    const list = document.getElementById("history-list");
    if (!list) return;

    list.innerHTML = "";

    data.history.forEach(tx => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <strong>${tx.tx_type}</strong><br>
        مبلغ: ${tx.amount}<br>
        <span class="tx-hash">${tx.tx_hash}</span>
      `;
      list.appendChild(item);
    });
  } catch {
    clearStatus();
    alert("خطا در بارگذاری تاریخچه");
  }
}

/* =========== سوییچ بین صفحه اصلی و تاریخچه =========== */

function openHistory() {
  document.getElementById("main-page")?.classList.add("hidden-page");
  document.getElementById("history-page")?.classList.remove("hidden-page");
  loadHistory();
}

function closeHistory() {
  document.getElementById("history-page")?.classList.add("hidden-page");
  document.getElementById("main-page")?.classList.remove("hidden-page");
}


/* شروع برنامه */
window.onload = initApp;
