// js/main.js
(function (global) {
  const App = global.App || (global.App = {});

  global.addEventListener("load", function () {
    if (App.initTheme) App.initTheme();
    if (App.initApp) App.initApp();
  });
})(window);
