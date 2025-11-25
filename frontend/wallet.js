let currentUser = null;

function log(msg) {
  const box = document.getElementById('log');
  if (!box) return;
  const ts = new Date().toLocaleTimeString('fa-IR', { hour12: false });
  box.innerHTML = `[${ts}] ${msg}<br>` + box.innerHTML;
}

async function withdraw() {
  const input = document.getElementById('withdraw-amount');
  const amount = Number(input.value);

  if (!amount || amount <= 0) {
    alert('لطفاً مبلغ برداشت را وارد کنید');
    return;
  }

  log(`درخواست برداشت ${amount} ONE ارسال شد...`);

  try {
    const res = await API.withdraw(amount);

    if (!res.ok) {
      const msg = res.error || 'برداشت ناموفق بود';
      log('❌ ' + msg);
      alert(msg);
      return;
    }

    log('✅ برداشت با موفقیت انجام شد');
    if (typeof res.internal_balance !== 'undefined') {
      document.getElementById('internal-balance').textContent =
        res.internal_balance;
    }
  } catch (err) {
    console.error(err);
    log('❌ خطا در برقراری ارتباط با سرور (withdraw)');
    alert('خطا در اتصال به سرور');
  }
}

// Check deposit on-chain + auto sweep to hot wallet
async function checkDeposit() {
  const statusEl = document.getElementById('deposit-result');
  if (statusEl) {
    statusEl.textContent = 'در حال بررسی واریز روی شبکه...';
    statusEl.classList.remove('success', 'error');
  }

  log('شروع بررسی واریز جدید روی شبکه...');

  try {
    const res = await API.checkDeposit();

    if (!res.success) {
      const msg = res.message || 'بررسی واریز ناموفق بود';
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.classList.add('error');
      }
      log('❌ ' + msg);
      return;
    }

    if (res.deposit) {
      // Update UI balance if provided
      if (typeof res.balance !== 'undefined') {
        document.getElementById('internal-balance').textContent =
          res.balance;
      }

      const amount = res.amount ?? 0;
      const sweepTx = res.sweepTx || '-';

      const text = `واریز جدید شناسایی شد: ${amount} ONE (سوییپ انجام شد - TX: ${sweepTx})`;
      if (statusEl) {
        statusEl.textContent = text;
        statusEl.classList.add('success');
      }
      log('✅ ' + text);
    } else {
      if (statusEl) {
        statusEl.textContent = 'هیچ واریز جدیدی برای این کیف پول یافت نشد.';
        statusEl.classList.remove('success', 'error');
      }
      log('ℹ️ واریز جدیدی شناسایی نشد');
    }
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.textContent = 'خطا در بررسی واریز. لطفاً دوباره تلاش کنید.';
      statusEl.classList.add('error');
    }
    log('❌ خطا در برقراری ارتباط با سرور (checkDeposit)');
  }
}

function updateUI(user) {
  currentUser = user;

  const tgIdEl = document.getElementById('tg-id');
  const tgUsernameEl = document.getElementById('tg-username');
  const walletAddressEl = document.getElementById('wallet-address');
  const internalBalanceEl = document.getElementById('internal-balance');

  if (tgIdEl) tgIdEl.textContent = user.telegram_id;
  if (tgUsernameEl) tgUsernameEl.textContent = user.username || '-';
  if (walletAddressEl) walletAddressEl.textContent = user.harmony_address;
  if (internalBalanceEl) internalBalanceEl.textContent = user.internal_balance;

  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'none';

  const userInfoEl = document.getElementById('user-info');
  const walletInfoEl = document.getElementById('wallet-info');
  const actionsEl = document.getElementById('actions');

  if (userInfoEl) userInfoEl.style.display = 'block';
  if (walletInfoEl) walletInfoEl.style.display = 'block';
  if (actionsEl) actionsEl.style.display = 'block';

  log('کاربر با موفقیت احراز هویت شد');
}
