// js/api.js
(function (global) {
  const App = global.App || (global.App = {});

  const tg = global.Telegram && global.Telegram.WebApp
    ? global.Telegram.WebApp
    : null;

  function api(path, data) {
    const payload = Object.assign({}, data || {});
    if (!payload.initData && tg && tg.initData) {
      payload.initData = tg.initData;
    }

    return fetch("/api" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "network_error" }));
  }

  App.tg = tg;
  App.api = api;
})(window);
