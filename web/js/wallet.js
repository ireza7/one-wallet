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
    const balanceOneEl = document.getElementById("balance-one");
    
    if (!usdEl || !balanceOneEl) return;
    
    // برداشتن انیمیشن اسکلتی اگر دیتا رسید
    if (App.lastBalance !== undefined) {
        balanceOneEl.classList.remove("skeleton-text", "text-transparent");
        if (App.latestPrice) {
            usdEl.classList.remove("skeleton-text", "text-transparent");
        }
    }

    if (!App.lastBalance) {
      // اگر موجودی صفر است یا هنوز لود نشده
      if (App.lastBalance === 0) {
          balanceOneEl.innerText = "0 ONE";
          usdEl.innerText = "$ 0.00";
      }
      return;
    }

    if (!App.latestPrice) {
      usdEl.innerText = "$ --";
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
        // فرمت کردن عدد با جداکننده هزارگان
        balanceEl.innerText = Number(res.balance).toLocaleString("en-US", { maximumFractionDigits: 4 }) + " ONE";
      }

      updateFiatValue();
    } catch (e) {
      console.warn("refreshBalance error", e);
    }
  }

  // === دریافت قیمت لحظه‌ای ===
  async function fetchOnePrice() {
    try {
      // استفاده از API کوین‌گکو یا هارمونی اکسپلورر
      // نکته: اکسپلورر هارمونی گاهی کند است، این اندپوینت مثال است
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
          
          // تغییر رنگ بر اساس مثبت/منفی
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

      const d = await api("/check-deposit", { initData });
      
      if (d.rate_limited) {
        // اگر کاربر تند تند کلیک کرد
        showError(d.error || "لطفاً کمی صبر کنید...");
        return;
      }

      if (!d.ok) {
        showError(d.error || "خطا در بررسی واریز");
        return;
      }

      // نمایش پیام موفقیت
      if (d.count > 0) {
          showSuccess(`${d.count} واریز جدید دریافت شد! 🎉`);
          // پخش ویبره موفقیت (Haptic Feedback)
          if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
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
        showError("لطفاً آدرس و مبلغ را کامل وارد کنید.");
        return;
      }

      if (!addr.startsWith("one1")) {
        showError("آدرس مقصد معتبر نیست (باید با one1 شروع شود).");
        return;
      }

      // دکمه را غیرفعال کنیم تا دوباره نزند (اختیاری)
      // ...

      const d = await api("/withdraw", {
        initData,
        address: addr,
        amount: amt,
      });

      if (!d.ok) {
        showError(d.error || "خطای برداشت");
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        return;
      }

      showSuccess("درخواست برداشت با موفقیت ثبت شد.");
      if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      
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
    if (!text || text === "one1...") return; // اگر هنوز لود نشده کپی نکن

    // تابع کپی
    const doCopy = () => {
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.selectionChanged();
        }
        showSuccess("آدرس کپی شد");
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        doCopy,
        () => showError("خطا در کپی آدرس")
      );
    } else {
      // روش قدیمی برای مرورگرهای خاص
      try {
        const tmp = document.createElement("textarea");
        tmp.value = text;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        document.body.removeChild(tmp);
        doCopy();
      } catch (e) {
        showError("خطا در کپی آدرس");
      }
    }
  }

  // === شروع برنامه ===
  async function initApp() {
    try {
      if (!tg) {
        // اگر بیرون از تلگرام باز شده
        // showError("لطفاً از داخل تلگرام باز کنید.");
        // برای تست روی مرورگر ارور ندهیم بهتر است، فقط لاگ کنیم
        console.warn("Telegram WebApp not detected");
      } else {
        if (tg.ready) tg.ready();
        if (tg.expand) tg.expand(); 
        // تنظیم رنگ هدر با تم
        if (tg.setHeaderColor) {
            // تشخیص تم تاریک/روشن برای هدر
            const isDark = document.documentElement.classList.contains('dark');
            tg.setHeaderColor(isDark ? '#0f172a' : '#f9fafb'); 
        }
      }

      const initData = tg ? tg.initData : "";
      
      // احراز هویت اولیه
      const resp = await api("/init", { initData });

      if (!resp.ok) {
        if (resp.error === "invalid telegram auth") {
          showError("نشست نامعتبر است. لطفاً ربات را دوباره باز کنید.");
        } else {
          // خطای شبکه یا سرور
          // showError("خطا در اتصال به سرور");
          console.error("Init failed:", resp.error);
        }
        // حتی اگر خطا داد، ادامه می‌دهیم تا UI لود شود (شاید در حالت تست هستیم)
      }

      // نمایش آدرس کاربر
      const depositAddressEl = document.getElementById("deposit-address");
      if (depositAddressEl && resp.user && resp.user.deposit_address) {
        depositAddressEl.innerText = resp.user.deposit_address;
        // فعال کردن دکمه کپی (تغییر استایل)
        depositAddressEl.parentElement.classList.remove("opacity-50");
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