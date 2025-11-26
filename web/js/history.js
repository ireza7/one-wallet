// js/history.js
(function (global) {
  const App = global.App || (global.App = {});
  const tg = () => App.tg;
  const api = () => App.api;
  const setStatus = () => App.setStatus;
  const clearStatus = () => App.clearStatus;

  async function loadHistory() {
    try {
      const initData = tg()?.initData;
      if (!initData) {
        return alert("initData در دسترس نیست. از داخل تلگرام وارد شوید.");
      }

      setStatus()("در حال بارگذاری تاریخچه...");
      const data = await api()("/history", { initData });
      clearStatus()();

      if (!data.ok) {
        alert("خطا در دریافت تاریخچه");
        return;
      }

      const list = document.getElementById("history-list");
      if (!list) return;

      list.innerHTML = "";

      data.history.forEach((tx) => {
        const item = document.createElement("div");
        item.className =
          "rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-[12px] text-slate-100";
        item.innerHTML = `
          <strong class="block mb-1 text-[12px]">${tx.tx_type}</strong>
          <div class="mb-1">مبلغ: ${tx.amount}</div>
          <span class="block text-[10px] text-slate-400 break-all">${tx.tx_hash}</span>
        `;
        list.appendChild(item);
      });
    } catch {
      clearStatus()();
      alert("خطا در بارگذاری تاریخچه");
    }
  }

  function openHistory() {
    const main = document.getElementById("main-page");
    const history = document.getElementById("history-page");
    if (main) main.classList.add("hidden");
    if (history) history.classList.remove("hidden");
    loadHistory();
  }

  function closeHistory() {
    const main = document.getElementById("main-page");
    const history = document.getElementById("history-page");
    if (history) history.classList.add("hidden");
    if (main) main.classList.remove("hidden");
  }

  App.loadHistory = loadHistory;
  App.openHistory = openHistory;
  App.closeHistory = closeHistory;
})(window);
