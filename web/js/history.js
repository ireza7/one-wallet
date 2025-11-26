// js/history.js
(function (global) {
  const App = global.App || (global.App = {});
  const tg = () => App.tg;
  const api = () => App.api;
  const setStatus = App.setStatus;
  const clearStatus = App.clearStatus;

  const EXPLORER_URL = "https://explorer.harmony.one/tx/";

  async function loadHistory() {
    const initData = tg()?.initData;

    if (!initData) {
      alert("initData در دسترس نیست. از داخل تلگرام وارد شوید.");
      return;
    }

    setStatus("در حال بارگذاری تاریخچه...");
    const data = await api()("/history", { initData });
    clearStatus();

    if (!data.ok) {
      alert("خطا در دریافت تاریخچه");
      return;
    }

    const list = document.getElementById("history-list");
    list.innerHTML = "";

    data.history.forEach((tx) => {
      const item = document.createElement("div");
      item.className =
        "rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3";

      const amountColor =
        tx.tx_type === "DEPOSIT"
          ? "text-emerald-500"
          : "text-red-400";

      item.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="text-[13px] font-semibold text-slate-700 dark:text-slate-100">${tx.tx_type}</span>
          <span class="text-[13px] font-medium ${amountColor}">
            ${tx.tx_type === "DEPOSIT" ? "+" : "-"}${tx.amount} ONE
          </span>
        </div>

        <div class="mt-2 text-[11px] text-slate-500 dark:text-slate-400 break-all">
          TX: ${tx.tx_hash}
        </div>

        <a
          href="${EXPLORER_URL + tx.tx_hash}"
          target="_blank"
          class="mt-3 inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          مشاهده در Explorer
        </a>
      `;

      list.appendChild(item);
    });
  }

  App.loadHistory = loadHistory;
})(window);
