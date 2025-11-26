
const tg = window.Telegram.WebApp;
tg.expand();

const loader=document.getElementById("loader-overlay");
const statusEl=document.getElementById("loader-status");
const errorEl=document.getElementById("loader-error");

function setStatus(t){statusEl.innerText=t;}
function showError(t){errorEl.innerText=t;}
function hideLoader(){loader.classList.add("fade-out");setTimeout(()=>loader.style.display="none",600);}

async function api(path, body){
 const res = await fetch('/api'+path,{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body: JSON.stringify(body)
 });
 return await res.json();
}

async function initApp(){
 setStatus("در حال شناسایی کاربر...");
 const tgData=tg.initDataUnsafe;

 if(!tgData || !tgData.user){
   showError("initData دریافت نشد، باید از داخل ربات باز کنید.");
   return;
 }

 setStatus("در حال ورود...");
 const data = await api('/init',{telegramData:tgData});
 if(!data.ok){
   showError(data.error || "خطا");
   return;
 }

 document.getElementById("deposit-info").innerHTML=
   "آدرس واریز:<br><code>"+data.user.deposit_address+"</code>";

 hideLoader();
}

async function checkDeposit(){
 const tgData=tg.initDataUnsafe;
 const d=await api('/check-deposit',{telegramData:tgData});
 if(d.rate_limited) return alert("لطفاً "+d.wait+" ثانیه صبر کنید");
 alert(d.message || "انجام شد");
}

async function showBalance(){
 const tgData=tg.initDataUnsafe;
 const d=await api('/balance',{telegramData:tgData});
 alert("موجودی: "+d.balance+" ONE");
}

async function withdraw(){
 const tgData=tg.initDataUnsafe;
 const addr=document.getElementById("withdrawAddress").value;
 const amt=document.getElementById("withdrawAmount").value;
 const d=await api('/withdraw',{telegramData:tgData,address:addr,amount:amt});
 if(!d.ok) return alert(d.error);
 alert("درخواست ثبت شد");
}

function openHistory(){
 loadHistory();
 document.getElementById("main-page").classList.add("hidden");
 document.getElementById("history-page").classList.remove("hidden");
}

function closeHistory(){
 document.getElementById("history-page").classList.add("hidden");
 document.getElementById("main-page").classList.remove("hidden");
}

async function loadHistory(){
 const tgData=tg.initDataUnsafe;
 const data = await api('/history',{telegramData:tgData});
 const box=document.getElementById("history-list");
 box.innerHTML="";

 if(!data.ok){
   box.innerHTML="<p>خطا در دریافت تاریخچه</p>";
   return;
 }

 if(data.history.length===0){
   box.innerHTML="<p>تراکنشی یافت نشد.</p>";
   return;
 }

 data.history.forEach(tx=>{
   const cls = tx.tx_type==="DEPOSIT" ? "tx-deposit" : "tx-withdraw";
   box.innerHTML += `
     <div class="history-item">
       <div class="${cls}">
         ${tx.tx_type==="DEPOSIT"?"واریز +":"برداشت -"} ${tx.amount} ONE
       </div>
       <div class="tx-hash">${tx.tx_hash}</div>
       <div>از: ${tx.from_address || "-"}</div>
       <div>به: ${tx.to_address || "-"}</div>
       <div>وضعیت: ${tx.status}</div>
       <div>تاریخ: ${new Date(tx.created_at).toLocaleString('fa-IR')}</div>
     </div>
   `;
 });
}

initApp();
