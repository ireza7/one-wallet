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
      const initData = tg?.initData;
      if (!initData) return;

      const res = await api("/balance", { initData });
      if (!res.ok) return;

      const balanceEl = document.getElementById("balance-one");
      const usdEl = document.getElementById("balance-usd");

      if (balanceEl) balanceEl.innerText = res.balance + " ONE";

      // اگر بک‌اند قیمت را بدهد، می‌توانی این را آپدیت کنی
      if (usdEl && typeof res.usd_value !== "undefined") {
        usdEl.innerText = "$ " + res.usd_value;
      }
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

      const addr = document
        .getElementById("withdrawAddress")
        .value.trim();
      const amt = Number(
        document.getElementById("withdrawAmount").value
      );

      if (!addr || !amt) {
        return alert("لطفاً اطلاعات برداشت را کامل وارد کنید.");
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

      alert("درخواست برداشت ثبت شد.\nTransaction: " + d.txHash);
      await refreshBalance();
    } catch {
      clearStatus();
      alert("خطا در برداشت");
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

      tg.ready?.();

      setStatus("در حال شناسایی کاربر...");

      const initData = tg.initData;
      const unsafe = tg.initDataUnsafe;

      if (!unsafe?.user?.id) {
        clearStatus();
        showError(
          "کاربر تلگرام شناسایی نشد. Mini App را از داخل ربات باز کنید."
        );
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

      // مقداردهی آدرس واریز
      const depositAddressEl =
        document.getElementById("deposit-address");
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

  App.refreshBalance = refreshBalance;
  App.checkDeposit = checkDeposit;
  App.showBalanceAlert = showBalanceAlert;
  App.withdraw = withdraw;
  App.initApp = initApp;
})(window);
