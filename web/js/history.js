// js/history.js
(function (global) {
  const App = global.App || (global.App = {});

  const tg = () => App.tg;
  const api = () => App.api;

  const setStatus = App.setStatus;
  const clearStatus = App.clearStatus;

  // Explorer URL base
  const EXPLORER_URL = "https://explorer.harmony.one/tx/";

  let fullHistory = [];

  function formatDateTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const date = d.toLocaleDateString("fa-IR");
    const time = d.toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return date + " - " + time;
  }

  function getDayLabel(ts) {
    if (!ts) return "سایر";
    const d = new Date(ts);
    return d.toLocaleDateString("fa-IR", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function renderFeeGas(tx) {
    const hasFee = typeof tx.fee !== "undefined" && tx.fee !== null;
    const hasGas = typeof tx.gas !== "undefined" && tx.gas !== null;

    if (!hasFee && !hasGas) return "";

    const feePart = hasFee ? tx.fee + " ONE" : "نامشخص";
    const gasPart = hasGas ? String(tx.gas) : "نامشخص";

    return (
      '<div class="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">' +
      "<span>Fee: " +
      feePart +
      "</span>" +
      "<span>Gas: " +
      gasPart +
      "</span>" +
      "</div>"
    );
  }

  function buildCardHTML(tx) {
    const isDeposit = tx.tx_type === "DEPOSIT";
    const sign = isDeposit ? "+" : "-";
    const iconEmoji = isDeposit ? "⬆️" : "⬇️";
    const title = isDeposit ? "واریز (Deposit)" : "برداشت (Withdraw)";
    const color = isDeposit ? "text-emerald-500" : "text-red-400";
    const iconBg = isDeposit
      ? "bg-emerald-500/10 text-emerald-400"
      : "bg-red-500/10 text-red-400";

    const dateTime = tx.timestamp ? formatDateTime(tx.timestamp) : "";
    const dateLine = dateTime
      ? '<div class="text-[11px] text-slate-500 dark:text-slate-400">' +
        dateTime +
        "</div>"
      : "";

    const usd =
      typeof tx.amount_usd !== "undefined" && tx.amount_usd !== null
        ? tx.amount_usd
        : null;
    const usdLine = usd
      ? '<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">≈ $' +
        usd +
        "</div>"
      : "";

    const feeGasHtml = renderFeeGas(tx);

    return (
      '<div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-3 shadow-sm">' +
      '<div class="flex items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2.5">' +
      '<div class="h-9 w-9 rounded-full ' +
      iconBg +
      ' flex items-center justify-center text-[17px] animate-pulse">' +
      iconEmoji +
      "</div>" +
      '<div class="flex flex-col">' +
      '<span class="text-[13px] font-semibold text-slate-800 dark:text-slate-100">' +
      title +
      "</span>" +
      dateLine +
      "</div>" +
      "</div>" +
      '<div class="text-right">' +
      '<div class="text-[13px] font-semibold ' +
      color +
      '">' +
      sign +
      tx.amount +
      " ONE</div>" +
      usdLine +
      "</div>" +
      "</div>" +
      '<div class="mt-2 text-[11px] text-slate-500 dark:text-slate-300 break-all">' +
      "TX: " +
      tx.tx_hash +
      "</div>" +
      feeGasHtml +
      '<a href="' +
      EXPLORER_URL +
      tx.tx_hash +
      '" target="_blank" class="mt-3 inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">' +
      "مشاهده در Explorer" +
      "</a>" +
      "</div>"
    );
  }

  function getFilteredSortedHistory() {
    const filterEl = document.getElementById("history-filter");
    const sortEl = document.getElementById("history-sort");

    const typeFilter = filterEl ? filterEl.value : "all";
    const sortMode = sortEl ? sortEl.value : "newest";

    let list = fullHistory.slice();

    if (typeFilter !== "all") {
      list = list.filter(function (tx) {
        return tx.tx_type === typeFilter;
      });
    }

    list.sort(function (a, b) {
      var ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      var tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      if (sortMode === "oldest") {
        return ta - tb;
      }
      return tb - ta;
    });

    return list;
  }

  function renderHistory() {
    const listEl = document.getElementById("history-list");
    if (!listEl) return;

    const list = getFilteredSortedHistory();
    listEl.innerHTML = "";

    if (!list.length) {
      listEl.innerHTML =
        '<div class="text-center text-[12px] text-slate-500 dark:text-slate-400 py-2">هیچ تراکنشی یافت نشد</div>';
      return;
    }

    let lastDayLabel = null;

    list.forEach(function (tx) {
      const dayLabel = getDayLabel(tx.timestamp);

      if (dayLabel !== lastDayLabel) {
        const dayHeader = document.createElement("div");
        dayHeader.className =
          "mt-2 mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2";
        dayHeader.innerHTML =
          '<span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>' +
          "<span>" +
          dayLabel +
          "</span>" +
          '<span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>';
        listEl.appendChild(dayHeader);
        lastDayLabel = dayLabel;
      }

      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildCardHTML(tx);
      listEl.appendChild(wrapper.firstElementChild);
    });
  }

  function updateHistoryUI() {
    renderHistory();
  }

  async function loadHistory() {
    try {
      const t = tg();
      const initData = t && t.initData;
      if (!initData) {
        return;
      }

      setStatus("در حال بارگذاری تاریخچه...");
      const data = await api()("/history", { initData });
      clearStatus();

      if (!data.ok) {
        console.warn("history error", data.error);
        return;
      }

      fullHistory = Array.isArray(data.history) ? data.history : [];
      renderHistory();
    } catch (e) {
      clearStatus();
      console.warn("loadHistory error", e);
    }
  }

  App.loadHistory = loadHistory;
  App.updateHistoryUI = updateHistoryUI;
})(window);
