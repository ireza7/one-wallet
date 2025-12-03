// js/status.js
(function (global) {
  const App = global.App || (global.App = {});

  // Toast System
  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `
      pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border backdrop-blur-md transform transition-all duration-300 translate-y-[-20px] opacity-0
      min-w-[280px] max-w-sm
      ${type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800 dark:bg-emerald-900/90 dark:border-emerald-800 dark:text-emerald-100' : 
        type === 'error' ? 'bg-red-50/90 border-red-200 text-red-800 dark:bg-red-900/90 dark:border-red-800 dark:text-red-100' : 
        'bg-white/90 border-slate-200 text-slate-800 dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-100'}
    `;

    // Icon based on type
    let icon = '';
    if (type === 'success') icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    else if (type === 'error') icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    else icon = '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>';

    toast.innerHTML = `
      <div class="shrink-0">${icon}</div>
      <div class="text-[13px] font-medium leading-5">${msg}</div>
    `;

    container.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-[-20px]', 'opacity-0');
    });

    // Remove after delay
    setTimeout(() => {
      toast.classList.add('opacity-0', 'scale-95');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Backwards compatibility
  function setStatus(msg) {
    // Optional: show a loading toast if needed
    // showToast(msg, 'info');
  }

  function clearStatus() {
    // Do nothing
  }

  function showError(msg) {
    showToast(msg, 'error');
  }

  function showSuccess(msg) {
    showToast(msg, 'success');
  }

  App.setStatus = setStatus;
  App.clearStatus = clearStatus;
  App.showError = showError;
  App.showSuccess = showSuccess; // New method
  App.showToast = showToast;     // Direct access
})(window);