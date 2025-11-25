
const tg = window.Telegram.WebApp;
tg.expand();

let currentUser = null;

const loading = document.getElementById("loading");
const walletShell = document.getElementById("walletShell");

const walletView = document.getElementById("walletView");
const historyView = document.getElementById("historyView");
const qrView = document.getElementById("qrView");
const settingsView = document.getElementById("settingsView");

const tabWallet = document.getElementById("tabWallet");
const tabHistory = document.getElementById("tabHistory");
const tabQR = document.getElementById("tabQR");
const tabSettings = document.getElementById("tabSettings");

const addressEl = document.getElementById("address");
const balanceEl = document.getElementById("balance");
const msgEl = document.getElementById("message");

function hideAll() {
  walletView.classList.add("hidden");
  historyView.classList.add("hidden");
  qrView.classList.add("hidden");
  settingsView.classList.add("hidden");

  tabWallet.classList.remove("bg-green-400","text-black");
  tabHistory.classList.remove("bg-blue-400","text-black");
  tabQR.classList.remove("bg-purple-400","text-black");
  tabSettings.classList.remove("bg-yellow-400","text-black");
}

async function init() {
  const u = tg?.initDataUnsafe?.user;
  if (!u) return loading.innerText = "خطا: کاربر تلگرام یافت نشد";

  const res = await fetch("/api/user/init", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ telegram_id:u.id, username:u.username })
  });

  const data = await res.json();
  if (!data.ok) return loading.innerText = "خطا در init";

  currentUser = data.user;

  addressEl.innerText = currentUser.harmony_address;
  balanceEl.innerText = currentUser.internal_balance + " ONE";

  loading.classList.add("hidden");
  walletShell.classList.remove("hidden");

  generateQR();
}

tabWallet.onclick = ()=>{
  hideAll();
  tabWallet.classList.add("bg-green-400","text-black","rounded-full");
  walletView.classList.remove("hidden");
};

tabHistory.onclick = ()=>{
  hideAll();
  tabHistory.classList.add("bg-blue-400","text-black","rounded-full");
  historyView.classList.remove("hidden");
  loadHistory();
};

tabQR.onclick = ()=>{
  hideAll();
  tabQR.classList.add("bg-purple-400","text-black","rounded-full");
  qrView.classList.remove("hidden");
};

tabSettings.onclick = ()=>{
  hideAll();
  tabSettings.classList.add("bg-yellow-400","text-black","rounded-full");
  settingsView.classList.remove("hidden");
};

document.getElementById("copyAddress").onclick = () => {
  navigator.clipboard.writeText(addressEl.innerText);
  tg.showPopup({ title:"کپی شد", message:"آدرس با موفقیت کپی شد!" });
};

// Refresh manual
document.getElementById("refreshBtn").onclick = refreshBalance;

// Transfer
document.getElementById("btnTransfer").onclick = async ()=>{
  msgEl.innerText="";
  const toUser = document.getElementById("toUser").value.trim();
  const amt = Number(document.getElementById("amountTransfer").value);

  const res = await fetch("/api/wallet/transfer",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      from_telegram_id:currentUser.telegram_id,
      to_username:toUser,
      amount:amt
    })
  });

  const data = await res.json();
  msgEl.innerText = data.ok ? "✔ انتقال انجام شد" : "❌ "+data.error;
  refreshBalance();
};

// Withdraw
document.getElementById("btnWithdraw").onclick = async ()=>{
  msgEl.innerText="";
  const addr = document.getElementById("toAddress").value.trim();
  const amt = Number(document.getElementById("amountWithdraw").value);

  const res = await fetch("/api/wallet/withdraw",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      telegram_id:currentUser.telegram_id,
      to_address:addr,
      amount:amt
    })
  });

  const data = await res.json();
  msgEl.innerText = data.ok ? "✔ برداشت ثبت شد" : "❌ "+data.error;
  refreshBalance();
};

async function refreshBalance(){
  if (!currentUser) return;
  const res = await fetch("/api/wallet/me?telegram_id="+currentUser.telegram_id);
  const data = await res.json();
  if (data.ok){
    currentUser = data.user;
    balanceEl.innerText = currentUser.internal_balance+" ONE";
  }
}

// History
async function loadHistory(){
  const box = document.getElementById("historyList");
  box.innerHTML = "<p class='text-slate-400 text-sm'>در حال بارگذاری...</p>";

  const res = await fetch("/api/wallet/history?telegram_id="+currentUser.telegram_id);
  const data = await res.json();

  if (!data.ok) return box.innerHTML="<p class='text-red-400'>خطا!</p>";
  if (!data.history.length) return box.innerHTML="<p class='text-slate-400'>بدون تراکنش</p>";

  box.innerHTML="";

  data.history.forEach(h=>{
    const div = document.createElement("div");
    div.className="card";
    div.innerHTML = `
      <p class="font-bold mb-1">${mapType(h.type)}</p>
      <p class="text-green-400 font-bold">${h.amount} ONE</p>
      ${h.tx_hash?`<p class='text-xs text-slate-400 break-all'>tx: ${h.tx_hash}</p>`:""}
      ${h.label?`<p class='text-blue-300 text-sm'>برچسب: ${h.label}</p>`:""}
      ${h.note?`<p class='text-slate-300 text-sm'>توضیح: ${h.note}</p>`:""}
      <p class="text-xs mt-2 text-slate-500">${new Date(h.created_at).toLocaleString('fa-IR')}</p>
    `;
    box.appendChild(div);
  });
}

function mapType(t){
  switch(t){
    case"deposit":return"واریز";
    case"deposit_sweep":return"انتقال به هات‌ولت";
    case"withdraw":return"برداشت";
    case"internal_in":return"دریافت داخلی";
    case"internal_out":return"ارسال داخلی";
    default:return t;
  }
}

// QR
function generateQR(){
  const canvas = document.getElementById("qrCanvas");
  QRCode.toCanvas(canvas, currentUser.harmony_address, { width:220 });
}

// auto refresh
setInterval(refreshBalance, 7000);

init();
