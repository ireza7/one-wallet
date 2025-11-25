window.addEventListener('DOMContentLoaded', async () => {
  const tg = window.Telegram.WebApp;

  tg.expand(); // full screen

  const initData = tg.initData;

  if (!initData) {
    document.getElementById('loading').textContent =
      'خطا: این وب‌اپ باید داخل Telegram WebApp باز شود.';
    return;
  }

  document.getElementById('loading').textContent = 'در حال ورود...';

  try {
    const res = await API.authWithTelegram(initData);

    if (!res.ok) {
      document.getElementById('loading').textContent =
        'ورود ناموفق: ' + res.error;
      return;
    }

    updateUI(res.user);

  } catch (err) {
    document.getElementById('loading').textContent =
      'خطا در اتصال به سرور';
    console.error(err);
  }
});
