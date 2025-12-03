// js/wallet.js
(function (global) {
  const App = global.App || (global.App = {});

  // دسترسی به متدهای سراسری
  const tg = App.tg;
  const api = App.api;

  // متدهای نمایش پیام (از status.js)
  const setStatus = App.setStatus;
  const clearStatus = App.clearStatus;
  const showError = App.showError;
  const showSuccess = App.showSuccess;

  App.lastBalance = 0;
  App.latestPrice = 0;

  // === بروزرسانی نمایش دلاری ===
  function updateFiatValue() {
    const usdEl = document.getElementById("balance-usd");
    if (!usdEl) return;
    
    // برداشتن انیمیشن اسکلتی اگر دیتا رسید
    if (App.lastBalance !== undefined && App.latestPrice) {
        usdEl.classList.remove("skeleton-text", "text-transparent");
        document.getElementById("balance-one").classList.remove("skeleton-text", "text-transparent");
    }

    if (!App.lastBalance || !App.latestPrice) {
      if(!App.lastBalance) usdEl.innerText = "$ 0.00";
      return;
    }
    const usd = (Number(App.lastBalance) * Number(App.latestPrice)).toFixed(2);
    usdEl.innerText = "$ " + usd;
  }

  // === دریافت موجودی ===
  async function refreshBalance() {
    try {
      const initData = tg && tg.initData;
      if (!initData) return;

      const res = await api("/balance", { initData });
      if (!res.ok) return;

      const balanceEl = document.getElementById("balance-one");
      App.lastBalance = res.balance || 0;

      if (balanceEl) {
        balanceEl.innerText = Number(res.balance).toLocaleString("en-US") + " ONE";
      }

      updateFiatValue();
    } catch (e) {
      console.warn("refreshBalance error", e);
    }
  }

  // === دریافت قیمت لحظه‌ای ===
  async function fetchOnePrice() {
    try {
      const res = await fetch("https://explorer.harmony.one/api/v2/stats");
      const data = await res.json();

      if (data && data.coin_price) {
        App.latestPrice = Number(data.coin_price);
        const priceEl = document.getElementById("one-price");
        if (priceEl) {
          priceEl.innerText = "$" + App.latestPrice.toFixed(4);
        }

        const changeEl = document.getElementById("one-price-change");
        if (changeEl && typeof data.coin_price_change_percentage !== "undefined") {
          const pct = Number(data.coin_price_change_percentage);
          const sign = pct > 0 ? "+" : "";
          changeEl.innerText = sign + pct.toFixed(2) + "%";
          
          changeEl.className = "text-[10px] px-1.5 py-0.5 rounded font-en " + 
            (pct >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500");
        }
      }
      updateFiatValue();
    } catch (e) {
      console.warn("خطا در دریافت قیمت ONE", e);
    }
  }

  // === بررسی واریز (دکمه) ===
  async function checkDeposit() {
    try {
      const initData = tg && tg.initData;
      if (!initData) {
        showError("initData در دسترس نیست. از داخل تلگرام وارد شوید.");
        return;
      }

      // نمایش لودینگ کوچک (اختیاری)
      // setStatus("در حال بررسی...");

      const d = await api("/check-deposit", { initData });
      
      if (d.rate_limited) {
        showError(d.error);
        return;
      }

      if (!d.ok) {
        showError(d.error || "خطا در بررسی واریز");
        return;
      }

      // موفقیت
      if (d.count > 0) {
          showSuccess(`${d.count} تراکنش جدید یافت شد.`);
      } else {
          showSuccess("واریز جدیدی یافت نشد.");
      }

      await refreshBalance();
      if (App.loadHistory) {
        await App.loadHistory();
      }
    } catch (e) {
      showError("خطا در ارتباط با سرور");
    }
  }

  // === درخواست برداشت ===
  async function withdraw() {
    try {
      const initData = tg && tg.initData;
      if (!initData) {
        showError("initData در دسترس نیست.");
        return;
      }

      const addrEl = document.getElementById("withdrawAddress");
      const amtEl = document.getElementById("withdrawAmount");
      const addr = addrEl ? addrEl.value.trim() : "";
      const amt = amtEl ? Number(amtEl.value) : 0;

      if (!addr || !amt) {
        showError("لطفاً آدرس و مبلغ را وارد کنید.");
        return;
      }

      if (!addr.startsWith("one1")) {
        showError("آدرس نامعتبر است (باید با one1 شروع شود).");
        return;
      }

      // setStatus("در حال ارسال...");
      const d = await api("/withdraw", {
        initData,
        address: addr,
        amount: amt,
      });

      if (!d.ok) {
        showError(d.error || "خطای برداشت");
        return;
      }

      showSuccess("درخواست برداشت ثبت شد.");
      
      // پاک کردن فرم
      if(addrEl) addrEl.value = "";
      if(amtEl) amtEl.value = "";

      await refreshBalance();
      if (App.loadHistory) {
        await App.loadHistory();
      }
    } catch (e) {
      showError("خطا در انجام عملیات");
    }
  }

  // === کپی آدرس ===
  function copyDepositAddress() {
    const el = document.getElementById("deposit-address");
    if (!el) return;
    const text = el.innerText.trim();
    if (!text || text === "one1...") return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
            if (tg && tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
            showSuccess("آدرس کپی شد");
        },
        () => showError("خطا در کپی آدرس")
      );
    } else {
      // Fallback برای مرورگرهای قدیمی
      try {
        const tmp = document.createElement("textarea");
        tmp.value = text;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        document.body.removeChild(tmp);
        showSuccess("آدرس کپی شد");
      } catch (e) {
        showError("خطا در کپی آدرس");
      }
    }
  }

  // === شروع برنامه ===
  async function initApp() {
    try {
      // setStatus("در حال اتصال...");

      if (!tg) {
        showError("لطفاً از داخل تلگرام باز کنید.");
        return;
      }

      if (tg.ready) tg.ready();
      if (tg.expand) tg.expand(); // تمام صفحه کردن در تلگرام

      const initData = tg.initData;
      
      // احراز هویت اولیه
      const resp = await api("/init", { initData });

      if (!resp.ok) {
        if (resp.error === "invalid telegram auth") {
          showError("احراز هویت نامعتبر است. مجدد تلاش کنید.");
        } else {
          showError(resp.error || "خطا در ورود");
        }
        return;
      }

      // نمایش آدرس کاربر
      const depositAddressEl = document.getElementById("deposit-address");
      if (depositAddressEl && resp.user && resp.user.deposit_address) {
        depositAddressEl.innerText = resp.user.deposit_address;
      }

      // دریافت اطلاعات مالی
      await refreshBalance();
      await fetchOnePrice();

      if (App.loadHistory) {
        await App.loadHistory();
      }

      // آپدیت خودکار هر 15 ثانیه
      setInterval(refreshBalance, 15000);
      setInterval(fetchOnePrice, 15000);

    } catch (err) {
      console.error(err);
      showError("خطا در اجرای برنامه");
    }
  }

  App.refreshBalance = refreshBalance;
  App.fetchOnePrice = fetchOnePrice;
  App.checkDeposit = checkDeposit;
  App.withdraw = withdraw;
  App.copyDepositAddress = copyDepositAddress;
  App.initApp = initApp;
  App.updateFiatValue = updateFiatValue;
})(window);