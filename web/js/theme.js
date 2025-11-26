// js/theme.js
(function (global) {
  const App = global.App || (global.App = {});
  const THEME_KEY = "one_wallet_theme";

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.dataset.theme = theme;

    const icon = document.getElementById("theme-toggle-icon");
    const label = document.getElementById("theme-toggle-label");
    if (icon && label) {
      if (theme === "dark") {
        icon.textContent = "🌙";
        label.textContent = "حالت تیره";
      } else {
        icon.textContent = "☀️";
        label.textContent = "حالت روشن";
      }
    }
  }

  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (e) {
      saved = null;
    }

    const prefersDark =
      global.matchMedia &&
      global.matchMedia("(prefers-color-scheme: dark)").matches;

    const theme = saved || (prefersDark ? "dark" : "light");
    applyTheme(theme);

    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        const current = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
        const next = current === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch (e) {}
        applyTheme(next);
      });
    }
  }

  App.initTheme = initTheme;
})(window);
