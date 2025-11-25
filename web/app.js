const tg = window.Telegram.WebApp;
tg.expand();

const telegramData = tg.initDataUnsafe;

async function api(path, body) {
  const res = await fetch('/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramData, ...body })
  });
  return res.json();
}

async function init() {
  try {
    const data = await api('/init', {});
    if (!data.ok) throw new Error(data.error || 'init failed');

    document.getElementById('deposit-info').innerHTML =
      'آدرس واریز شما:<br><code>' + data.user.deposit_address + '</code>';
  } catch (err) {
    alert('خطا در init: ' + err.message);
  }
}

async function checkDeposit() {
  try {
    const data = await api('/check-deposit', {});
    if (!data.ok) throw new Error(data.error || 'error');
    alert(data.message);
  } catch (err) {
    alert('خطا در بررسی واریز: ' + err.message);
  }
}

async function showBalance() {
  try {
    const data = await api('/balance', {});
    if (!data.ok) throw new Error(data.error || 'error');
    alert('موجودی شما: ' + data.balance + ' ONE');
  } catch (err) {
    alert('خطا در دریافت موجودی: ' + err.message);
  }
}

async function withdraw() {
  const address = document.getElementById('withdrawAddress').value.trim();
  const amount = document.getElementById('withdrawAmount').value.trim();

  if (!address || !amount) {
    return alert('آدرس و مبلغ را وارد کنید');
  }

  try {
    const data = await api('/withdraw', { address, amount });
    if (!data.ok) throw new Error(data.error || 'error');
    alert('درخواست برداشت ثبت و ارسال شد. ID: ' + data.requestId + '\nTX: ' + data.txHash);
  } catch (err) {
    alert('خطا در برداشت: ' + err.message);
  }
}

init();
