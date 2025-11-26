// js/api.js
(function (global) {
  const App = global.App || (global.App = {});

  // Telegram WebApp object (با optional chaining)
  const tg = global.Telegram?.WebApp || null;

  function api(path, data) {
    const payload = Object.assign({}, data || {});

    if (!payload.initData && tg?.initData) {
      payload.initData = tg.initData;
    }

    return fetch("/api" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .catch(() => {
        return { ok: false, error: "network_error" };
      });
  }

  App.tg = tg;
  App.api = api;
})(window);
