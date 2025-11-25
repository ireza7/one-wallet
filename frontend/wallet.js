let currentUser = null;

function log(msg) {
  const box = document.getElementById('log');
  box.innerHTML += msg + "<br>";
}

async function withdraw() {
  const amount = Number(document.getElementById('withdraw-amount').value);
  if (!amount) return alert('مقدار وارد کنید');

  log('Sending withdraw request...');

  const res = await API.withdraw(amount);

  if (!res.ok) {
    log('Withdraw failed: ' + res.error);
    return;
  }

  log('Withdraw success. TX: ' + res.tx);
}

async function deposit() {
  const amount = Number(document.getElementById('deposit-amount').value);
  if (!amount) return alert('مقدار وارد کنید');

  log('Sending deposit request...');

  const res = await API.deposit(amount);

  if (!res.ok) {
    log('deposit failed: ' + res.error);
    return;
  }

  log('Deposit success');
}

function updateUI(user) {
  currentUser = user;

  document.getElementById('tg-id').textContent = user.telegram_id;
  document.getElementById('tg-username').textContent = user.username || '-';

  document.getElementById('wallet-address').textContent = user.harmony_address;
  document.getElementById('internal-balance').textContent = user.internal_balance;

  document.getElementById('loading').style.display = 'none';
  document.getElementById('user-info').style.display = 'block';
  document.getElementById('wallet-info').style.display = 'block';
  document.getElementById('actions').style.display = 'block';
}
