// js/wallet.js
(function (global) {
  const App = global.App || (global.App = {});

  const tg = App.tg;
  const api = App.api;

  const setStatus = App.setStatus;
  const clearStatus = App.clearStatus;
  const showError = App.showError;

  async function refreshBalance() {
    try {
      const initData = tg && tg.initData;
      if (!initData) return;

      const res = await api("/balance", { initData });
      if (!res.ok) return;

      const balanceEl = document.getElementById("balance-one");
      const usdEl = document.getElementById("balance-usd");

      if (balanceEl) balanceEl.innerText = res.balance + " ONE";
      if (usdEl && typeof res.usd_value !== "undefined") {
        usdEl.innerText = "$ " + res.usd_value;
      }
    } catch (e) {
      console.warn("refreshBalance error", e);
    }
  }

  // Fetch ONE price from Harmony explorer official API
  async function fetchOnePrice() {
    try {
      const res = await fetch("https://explorer.harmony.one/api/v2/stats");
      const data = await res.json();

      // قیمت واقعی از API رسمی
      if (data && data.coin_price) {
        const priceEl = document.getElementById("one-price");
        if (priceEl) {
          priceEl.innerText = "$" + Number(data.coin_price).toFixed(6);
        }
      }
    } catch (e) {
      console.warn("خطا در دریافت قیمت ONE:", e);
    }
  }


  async function checkDeposit() {
    try {
      const initData = tg && tg.initData;
      if (!initData) {
        alert("initData در دسترس نیست. از داخل تلگرام وارد شوید.");
        return;
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

      alert(d.message || "واریز با موفقیت ثبت شد.");
      await refreshBalance();
      if (App.loadHistory) {
        await App.loadHistory();
      }
    } catch (e) {
      clearStatus();
      alert("خطا در بررسی واریز");
    }
  }

  async function withdraw() {
    try {
      const initData = tg && tg.initData;
      if (!initData) {
        alert("initData در دسترس نیست. از داخل تلگرام وارد شوید.");
        return;
      }

      const addrEl = document.getElementById("withdrawAddress");
      const amtEl = document.getElementById("withdrawAmount");
      const addr = addrEl ? addrEl.value.trim() : "";
      const amt = amtEl ? Number(amtEl.value) : 0;

      if (!addr || !amt) {
        alert("لطفاً آدرس و مبلغ برداشت را کامل وارد کنید.");
        return;
      }

      setStatus("در حال ثبت درخواست برداشت...");
      const d = await api("/withdraw", {
        initData,
        address: addr,
        amount: amt,
      });
      clearStatus();

      if (!d.ok) {
        alert(d.error || "خطای برداشت");
        return;
      }

      alert("درخواست برداشت ثبت شد.\nTransaction: " + (d.txHash || ""));
      await refreshBalance();
      if (App.loadHistory) {
        await App.loadHistory();
      }
    } catch (e) {
      clearStatus();
      alert("خطا در برداشت");
    }
  }

  function copyDepositAddress() {
    const el = document.getElementById("deposit-address");
    if (!el) return;
    const text = el.innerText.trim();
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          if (tg && tg.showPopup) {
            tg.showPopup({ message: "آدرس کپی شد" });
          } else {
            alert("آدرس کپی شد");
          }
        },
        () => {
          alert("خطا در کپی آدرس");
        }
      );
    } else {
      const tmp = document.createElement("textarea");
      tmp.value = text;
      document.body.appendChild(tmp);
      tmp.select();
      try {
        document.execCommand("copy");
        alert("آدرس کپی شد");
      } catch (e) {
        alert("خطا در کپی آدرس");
      }
      document.body.removeChild(tmp);
    }
  }

  async function initApp() {
    try {
      setStatus("در حال آماده‌سازی اپلیکیشن...");

      if (!tg) {
        clearStatus();
        showError("لطفاً این Mini App را از داخل تلگرام باز کنید.");
        return;
      }

      if (tg.ready) tg.ready();

      setStatus("در حال شناسایی کاربر...");

      const initData = tg.initData;
      const unsafe = tg.initDataUnsafe;

      if (!unsafe || !unsafe.user || !unsafe.user.id) {
        clearStatus();
        showError("کاربر تلگرام شناسایی نشد. Mini App را از داخل ربات باز کنید.");
        return;
      }

      setStatus("در حال ورود به والت...");

      const resp = await api("/init", { initData });

      if (!resp.ok) {
        if (resp.error === "invalid telegram auth") {
          showError(
            "احراز هویت تلگرام نامعتبر است. Mini App را ببندید و دوباره از ربات باز کنید."
          );
        } else if (resp.error === "network_error") {
          showError("خطای شبکه. اتصال اینترنت یا سرور را بررسی کنید.");
        } else {
          showError(resp.error || "خطا در ورود");
        }
        clearStatus();
        return;
      }

      // deposit address
      const depositAddressEl = document.getElementById("deposit-address");
      if (depositAddressEl && resp.user && resp.user.deposit_address) {
        depositAddressEl.innerText = resp.user.deposit_address;
      }

      setStatus("در حال دریافت موجودی و قیمت...");
      await refreshBalance();
      await fetchOnePrice();

      if (App.loadHistory) {
        await App.loadHistory();
      }

      clearStatus();

      // auto refresh every 15s
      setInterval(refreshBalance, 15000);
      setInterval(fetchOnePrice, 15000);
    } catch (err) {
      console.error(err);
      clearStatus();
      showError("خطا در اجرای برنامه");
    }
  }

  App.refreshBalance = refreshBalance;
  App.fetchOnePrice = fetchOnePrice;
  App.checkDeposit = checkDeposit;
  App.withdraw = withdraw;
  App.copyDepositAddress = copyDepositAddress;
  App.initApp = initApp;
})(window);
