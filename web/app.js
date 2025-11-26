
const tg = window.Telegram.WebApp;
tg.expand();

const loader = document.getElementById("loader-overlay");
const statusEl = document.getElementById("loader-status");
const errorEl = document.getElementById("loader-error");

function setStatus(t){ statusEl.innerText = t; }
function showError(t){ errorEl.innerText = t; }
function hideLoader(){
  loader.classList.add("fade-out");
  setTimeout(() => loader.style.display = "none", 600);
}

async function api(path, body){
  const res = await fetch('/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return await res.json();
}

// قیمت ONE از CoinGecko
async function fetchOnePrice(){
  try{
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=harmony&vs_currencies=usd');
    const data = await res.json();
    return data.harmony.usd;
  }catch(e){
    console.error('price error', e);
    return 0;
  }
}

// بروزرسانی موجودی + قیمت دلاری
async function refreshBalance(){
  try{
    const tgData = tg.initDataUnsafe;
    const balRes = await api('/balance', { telegramData: tgData });
    if(!balRes.ok){
      console.error('balance error', balRes.error);
      return;
    }

    const onePrice = await fetchOnePrice();

    const oneAmount = Number(balRes.balance || 0);
    const usdValue = (oneAmount * onePrice).toFixed(4);

    document.getElementById('balance-one').innerText = `${oneAmount} ONE`;
    document.getElementById('balance-usd').innerText = `$ ${usdValue}`;
    document.getElementById('one-price').innerText = `$${onePrice}`;
  }catch(e){
    console.error('refresh balance error', e);
  }
}

async function initApp(){
  setStatus("در حال شناسایی کاربر...");
  const tgData = tg.initDataUnsafe;

  if(!tgData || !tgData.user){
    showError("initData دریافت نشد، Mini App را از داخل ربات باز کنید.");
    return;
  }

  setStatus("در حال ورود...");
  const data = await api('/init', { telegramData: tgData });
  if(!data.ok){
    showError(data.error || "خطا در ورود");
    return;
  }

  document.getElementById('deposit-address').innerText = data.user.deposit_address;

  hideLoader();
  await refreshBalance();

  // Auto-refresh هر 15 ثانیه
  setInterval(refreshBalance, 15000);
}

async function checkDeposit(){
  const tgData = tg.initDataUnsafe;
  const d = await api('/check-deposit', { telegramData: tgData });
  if(d.rate_limited){
    return alert("لطفاً " + d.wait + " ثانیه صبر کنید");
  }
  alert(d.message || "انجام شد");
  // بعد از سوییپ احتمالی، موجودی را رفرش کن
  refreshBalance();
}

async function showBalanceAlert(){
  const tgData = tg.initDataUnsafe;
  const d = await api('/balance', { telegramData: tgData });
  if(!d.ok) return alert("خطا در دریافت موجودی");
  alert("موجودی شما: " + d.balance + " ONE");
}

async function withdraw(){
  const tgData = tg.initDataUnsafe;
  const addr = document.getElementById('withdrawAddress').value.trim();
  const amt  = document.getElementById('withdrawAmount').value.trim();

  if(!addr || !amt){
    return alert("آدرس و مبلغ را وارد کنید");
  }

  const d = await api('/withdraw', { telegramData: tgData, address: addr, amount: amt });
  if(!d.ok) return alert(d.error || "خطا در برداشت");
  alert("درخواست برداشت ثبت شد. TX: " + d.txHash);
}

// History
function openHistory(){
  loadHistory();
  document.getElementById('main-page').classList.add('hidden');
  document.getElementById('history-page').classList.remove('hidden');
}

function closeHistory(){
  document.getElementById('history-page').classList.add('hidden');
  document.getElementById('main-page').classList.remove('hidden');
}

async function loadHistory(){
  const tgData = tg.initDataUnsafe;
  const data = await api('/history', { telegramData: tgData });
  const box = document.getElementById('history-list');
  box.innerHTML = '';

  if(!data.ok){
    box.innerHTML = "<p>خطا در دریافت تاریخچه</p>";
    return;
  }

  if(data.history.length === 0){
    box.innerHTML = "<p>تراکنشی یافت نشد.</p>";
    return;
  }

  data.history.forEach(tx => {
    const cls = tx.tx_type === "DEPOSIT" ? "tx-deposit" : "tx-withdraw";
    const created = tx.created_at ? new Date(tx.created_at).toLocaleString('fa-IR') : '-';
    box.innerHTML += `
      <div class="history-item">
        <div class="${cls}">
          ${tx.tx_type === "DEPOSIT" ? "واریز +" : "برداشت -"} ${tx.amount} ONE
        </div>
        <div class="tx-hash">${tx.tx_hash}</div>
        <div>از: ${tx.from_address || "-"}</div>
        <div>به: ${tx.to_address || "-"}</div>
        <div>وضعیت: ${tx.status}</div>
        <div>تاریخ: ${created}</div>
      </div>
    `;
  });
}

initApp();
