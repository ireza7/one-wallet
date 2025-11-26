// js/status.js
(function (global) {
  const App = global.App || (global.App = {});

  function setStatus(msg) {
    const bar = document.getElementById("status-bar");
    const text = document.getElementById("status-text");
    if (!bar || !text) return;
    text.innerText = msg;
    bar.classList.remove("hidden");
  }

  function clearStatus() {
    const bar = document.getElementById("status-bar");
    if (!bar) return;
    bar.classList.add("hidden");
  }

  function showError(msg) {
    alert(msg);
  }

  App.setStatus = setStatus;
  App.clearStatus = clearStatus;
  App.showError = showError;
})(window);
