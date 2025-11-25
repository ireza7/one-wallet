const tg=window.Telegram.WebApp;tg.expand();
const loader=document.getElementById("loader-overlay");
const statusEl=document.getElementById("loader-status");
const errorEl=document.getElementById("loader-error");

function setStatus(t){statusEl.innerText=t;}
function showError(t){errorEl.innerText=t;}
function hideLoader(){loader.classList.add("fade-out");setTimeout(()=>loader.style.display="none",600);}

async function callAPI(p,b){
 const r=await fetch("/api"+p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});
 return await r.json();
}

async function initApp(){
 setStatus("در حال شناسایی کاربر...");
 const tgData=tg.initDataUnsafe;
 if(!tgData||!tgData.user){showError("initData دریافت نشد");return;}
 setStatus("در حال ورود...");
 const d=await callAPI("/init",{telegramData:tgData});
 if(!d.ok){showError(d.error);return;}
 document.getElementById("deposit-info").innerHTML="آدرس:<br><code>"+d.user.deposit_address+"</code>";
 hideLoader();
}

async function checkDeposit(){
 const tgData=tg.initDataUnsafe;
 const d=await callAPI("/check-deposit",{telegramData:tgData});
 alert(d.message||"ok");
}
async function showBalance(){
 const tgData=tg.initDataUnsafe;
 const d=await callAPI("/balance",{telegramData:tgData});
 alert("Balance: "+d.balance);
}
async function withdraw(){
 const tgData=tg.initDataUnsafe;
 const a=document.getElementById("withdrawAddress").value;
 const m=document.getElementById("withdrawAmount").value;
 const d=await callAPI("/withdraw",{telegramData:tgData,address:a,amount:m});
 alert("done");
}

initApp();
