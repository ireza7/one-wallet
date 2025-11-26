// js/main.js
(function (global) {
  const App = global.App || (global.App = {});

  function navigate(page) {
    const pages = ["main", "history"];

    pages.forEach((p) => {
      const el = document.getElementById(p + "-page");
      if (!el) return;
      if (p === page) el.classList.remove("hidden");
      else el.classList.add("hidden");
    });

    if (page === "history") App.loadHistory();
  }

  App.navigate = navigate;

  global.addEventListener("load", () => {
    if (App.initTheme) App.initTheme();
    if (App.initApp) App.initApp();
  });
})(window);
