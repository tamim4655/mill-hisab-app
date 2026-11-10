(function(){
"use strict";
const KEY="meal_manager_bn_v1", REMTIME="mill_hisab_reminder_time_v1", ACCENT="mill_hisab_accent_v1", LANG="mill_hisab_language_v1", DASH="mill_hisab_dashboard_v1", BIO="mill_hisab_biometric_v1", REM="mill_hisab_reminders_v1", REMDAY="mill_hisab_reminder_day_v1";
const bnEn={"ড্যাশবোর্ড":"Dashboard","সদস্য":"Members","রিপোর্ট":"Reports","সেটিংস":"Settings","স্বাগতম!":"Welcome!","আমাদের মিল হিসাব অ্যাপে":"Welcome to Mill Hisab","সঠিক হিসাব রাখুন, ঝামেলামুক্ত থাকুন।":"Keep accurate accounts, stay worry-free.","আজকের মিল লিখুন":"Enter today’s meals","সারসংক্ষেপ":"Overview","মাসের হিসাব":"Monthly account","আর্থিক অবস্থা":"Financial status","মাসের সারাংশ":"Monthly summary","লাইভ হিসাব":"Live account","দ্রুত কাজ":"Quick actions","যা করতে চান":"What would you like to do?","কাস্টমার":"Customer","খরচ যোগ":"Add expense","মোট সদস্য":"Total members","মোট মিল":"Total meals","মোট জমা":"Total paid","মোট খরচ":"Total expenses","জমা":"Paid","খরচ":"Expenses","বাকি":"Due","মোট বিল":"Total bill","জমার হার":"Payment rate","কাস্টমার তালিকা":"Customer list","নতুন কাস্টমার":"New customer","যোগ করুন":"Add","পেমেন্ট / টাকা জমা":"Payments / Deposits","পেমেন্ট যোগ":"Add payment","মাসিক রিপোর্ট":"Monthly report","কাস্টমারের আলাদা খাতা":"Customer ledger","দৈনিক বাজার ও অন্যান্য খরচ":"Daily purchases and other expenses","সবার একসাথে হিসাব (এক্সেল ভিউ)":"Combined account (Excel view)","সেটিংস ও নিরাপত্তা":"Settings & security","ডেটা ব্যাকআপ":"Data backup","হিসাব পরিবর্তনের ইতিহাস":"Activity history","নাম দিয়ে খুঁজুন":"Search by name","সব কাস্টমার":"All customers","যাদের বাকি আছে":"Customers with due","যাদের বাকি নেই":"No due","শুধু চালু":"Active only","শুধু বন্ধ":"Inactive only"};
const enBn=Object.fromEntries(Object.entries(bnEn).map(([a,b])=>[b,a]));
function translate(){const map=localStorage.getItem(LANG)==="en"?bnEn:enBn;const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const v=n.nodeValue.trim();if(map[v])n.nodeValue=n.nodeValue.replace(v,map[v]);}const q=document.getElementById("customerSearch");if(q)q.placeholder=localStorage.getItem(LANG)==="en"?"Search by customer name":"নাম দিয়ে খুঁজুন";}
window.setLanguage=function(v){localStorage.setItem(LANG,v==="en"?"en":"bn");translate();};
window.setAccent=function(v){if(!["green","blue","purple","orange"].includes(v))return;localStorage.setItem(ACCENT,v);document.body.dataset.accent=v;document.querySelectorAll(".color-swatch").forEach(b=>b.classList.toggle("selected",b.dataset.accent===v));};
function prefs(){let p;try{p=JSON.parse(localStorage.getItem(DASH)||"[true,true,true,true]");}catch(e){p=[true,true,true,true];}document.querySelectorAll(".dash-pref").forEach(x=>x.checked=p[Number(x.dataset.card)]!==false);document.querySelectorAll("#stats .card").forEach((c,i)=>c.style.display=p[i]===false?"none":"");}
function filterCustomers(){const q=(document.getElementById("customerSearch")?.value||"").trim().toLowerCase(),f=document.getElementById("customerStatus")?.value||"all";document.querySelectorAll("#customerRows tr").forEach(tr=>{const name=(tr.querySelector('input[aria-label="কাস্টমারের নাম"]')?.value||tr.cells[0]?.textContent||"").toLowerCase(),due=Number((tr.cells[3]?.textContent||"").replace(/[^0-9.-]/g,""))||0,status=tr.cells[5]?.textContent.trim()||"";const ok=name.includes(q)&&(f==="all"||(f==="due"&&due>0)||(f==="clear"&&due<=0)||(f==="active"&&status==="চালু")||(f==="inactive"&&status==="বন্ধ"));tr.style.display=ok?"":"none";});}
function activityView(){const host=document.getElementById("activityRows");if(!host||typeof db==="undefined")return;let a=(db.activityLog||[]).slice().reverse(),f=document.getElementById("activityFilter")?.value||"all";if(f!=="all")a=a.filter(x=>x.type===f);host.innerHTML=a.length?a.slice(0,300).map(x=>'<div class="activity-item"><div><b>'+esc(x.title||"হিসাব আপডেট")+'</b><small>'+esc(x.detail||"")+'</small></div><small>'+new Date(x.at).toLocaleString("bn-BD")+'</small></div>').join(""):'<p class="hint" style="padding:12px">এখনো কোনো পরিবর্তনের ইতিহাস নেই।</p>';}
function bars(host,items){if(!host)return;const max=Math.max(1,...items.map(x=>x.value));host.innerHTML=items.length?items.map(x=>'<div class="feature-bar"><span>'+esc(x.label)+'</span><div class="feature-track"><div class="feature-fill" style="width:'+Math.max(0,x.value/max*100)+'%"></div></div><b>'+money(x.value)+'</b></div>').join(""):'<p class="hint">দেখানোর মতো তথ্য নেই।</p>';}
const baseSave=window.save;
window.save=function(){const prev=JSON.parse(localStorage.getItem(KEY)||"{}");let type="customer",title="তথ্য পরিবর্তন",detail="ডেটা আপডেট হয়েছে";if(JSON.stringify(prev.meals||{})!==JSON.stringify(db.meals||{})){type="meal";title="মিলের হিসাব পরিবর্তন";detail="দৈনিক মিলের তথ্য সংরক্ষণ করা হয়েছে";}else if(JSON.stringify(prev.payments||[])!==JSON.stringify(db.payments||[])){type="payment";title="জমা / পেমেন্ট পরিবর্তন";detail="পেমেন্টের তথ্য যোগ বা পরিবর্তন হয়েছে";}else if(JSON.stringify(prev.expenses||[])!==JSON.stringify(db.expenses||[])){type="expense";title="খরচের হিসাব পরিবর্তন";detail="খরচের তথ্য যোগ বা পরিবর্তন হয়েছে";}else if(JSON.stringify(prev.customers||[])!==JSON.stringify(db.customers||[])){type="customer";title="কাস্টমার তথ্য পরিবর্তন";detail="কাস্টমার বা আগের বকেয়ার তথ্য পরিবর্তন হয়েছে";}const changed=["meals","payments","expenses","customers","mealRates"].some(k=>JSON.stringify(prev[k]||(k==="customers"||k==="payments"||k==="expenses"?[]:{}))!==JSON.stringify(db[k]||(k==="customers"||k==="payments"||k==="expenses"?[]:{})));db.activityLog=Array.isArray(db.activityLog)?db.activityLog:[];if(changed){db.activityLog.push({id:"A"+Date.now(),at:new Date().toISOString(),type,title,detail});if(db.activityLog.length>1000)db.activityLog=db.activityLog.slice(-1000);}baseSave.apply(this,arguments);if(window.AndroidBridge&&typeof totals==="function"&&typeof money==="function"){const due=Number(totals(monthNow()).due||0);AndroidBridge.updateDueReminder(due>0,"মোট বকেয়া "+money(due)+"। বিস্তারিত দেখতে অ্যাপ খুলুন।");}activityView();filterCustomers();prefs();translate();};
const baseCustomers=window.customers;window.customers=function(){baseCustomers();filterCustomers();};
const basePayments=window.payments;window.payments=function(){basePayments();document.querySelectorAll("#paymentRows tr").forEach(tr=>{const cell=tr.cells[4];if(cell&&!cell.querySelector(".share-receipt")){const b=document.createElement("button");b.className="secondary share-receipt";b.textContent="শেয়ার";b.onclick=()=>window.shareReceiptFromRow(b);cell.appendChild(b);}});};
window.showReceiptFromRow=function(b){const c=b.closest("tr").cells;let modal=document.getElementById("receiptModal");if(!modal){modal=document.createElement("div");modal.id="receiptModal";modal.innerHTML='<div class="receipt-paper"><h2>মিল হিসাব — পেমেন্ট রসিদ</h2><p style="text-align:center">পেমেন্ট গ্রহণের রসিদ</p><div class="receipt-line"><span>তারিখ</span><b id="receiptDate"></b></div><div class="receipt-line"><span>কাস্টমার</span><b id="receiptCustomer"></b></div><div class="receipt-line"><span>জমা</span><b id="receiptAmount"></b></div><div class="receipt-line"><span>পদ্ধতি</span><b id="receiptMethod"></b></div><p style="text-align:center;margin-top:22px">ধন্যবাদ।</p><div class="receipt-actions"><button onclick="printReceiptNow()">PDF / প্রিন্ট</button><button class="secondary" onclick="closeReceiptModal()">বন্ধ করুন</button></div></div>';document.body.appendChild(modal);}document.getElementById("receiptDate").textContent=c[0].textContent;document.getElementById("receiptCustomer").textContent=c[1].textContent;document.getElementById("receiptAmount").textContent=c[2].textContent;document.getElementById("receiptMethod").textContent=c[3].textContent;modal.classList.add("open");};
window.printReceiptNow=function(){document.body.classList.add("receipt-printing");if(window.AndroidPrint&&AndroidPrint.printPage)AndroidPrint.printPage("মিল হিসাব - পেমেন্ট রসিদ");else window.print();};
window.closeReceiptModal=function(){document.body.classList.remove("receipt-printing");document.getElementById("receiptModal")?.classList.remove("open");};
window.shareReceiptFromRow=function(b){const c=b.closest("tr").cells,txt="মিল হিসাব — পেমেন্ট রসিদ\nতারিখ: "+c[0].textContent+"\nকাস্টমার: "+c[1].textContent+"\nজমা: "+c[2].textContent+"\nপদ্ধতি: "+c[3].textContent+"\nধন্যবাদ।";if(window.AndroidBridge&&AndroidBridge.shareText)AndroidBridge.shareText("মিল হিসাবের রসিদ",txt);else if(navigator.share)navigator.share({title:"মিল হিসাবের রসিদ",text:txt}).catch(()=>{});else alert(txt);}
const baseExpenses=window.renderExpenses;window.renderExpenses=function(){baseExpenses();const m=document.getElementById("expenseMonth").value||monthNow(),a=(db.expenses||[]).filter(x=>x.date.startsWith(m)),g={};a.forEach(x=>g[x.category||"অন্যান্য"]=(g[x.category||"অন্যান্য"]||0)+Number(x.amount||0));bars(document.getElementById("expenseCharts"),Object.entries(g).map(([label,value])=>({label,value})));};
const baseReport=window.report;window.report=function(){baseReport();const m=document.getElementById("reportMonth").value||monthNow(),x=totals(m),e=(db.expenses||[]).filter(v=>v.date.startsWith(m)).reduce((a,v)=>a+Number(v.amount||0),0);bars(document.getElementById("reportCharts"),[{label:"মোট বিল",value:x.bill},{label:"জমা",value:x.paid},{label:"বাকি",value:x.due},{label:"খরচ",value:e}]);};
const baseHome=window.home;window.home=function(){baseHome();const host=document.getElementById("dueReminderCard");if(!host)return;const rows=data(monthNow()).filter(x=>x.due>0).sort((a,b)=>b.due-a.due),sum=rows.reduce((a,x)=>a+x.due,0);host.innerHTML=sum>0?'<div class="reminder-card"><strong>🔔 মোট বকেয়া '+money(sum)+'</strong><p>'+rows.slice(0,4).map(x=>esc(x.name)+": "+money(x.due)).join(" · ")+'</p><button class="secondary" onclick="go(\'report\')">বকেয়া রিপোর্ট দেখুন</button></div>':"";};
const baseRender=window.render;window.render=function(){baseRender();filterCustomers();prefs();activityView();translate();};
window.exportActivity=function(){const a=[["সময়","ধরন","শিরোনাম","বিবরণ"],...(db.activityLog||[]).map(x=>[x.at,x.type,x.title,x.detail])];download(a,"mill-hisab-history-"+today()+".csv");};
window.exportFullExcel=function(){const a=[["ধরন","তারিখ","কাস্টমার/বিবরণ","পরিমাণ","অতিরিক্ত"],...db.customers.map(c=>["কাস্টমার","",c.name,c.rate,"প্রতি বেলার দর; আগের বাকি "+(c.openingDue||0)]),...Object.entries(db.meals||{}).flatMap(([d,v])=>Object.entries(v).map(([id,n])=>["মিল",d,(db.customers.find(c=>c.id===id)||{}).name||id,n,""])),...(db.payments||[]).map(p=>["জমা",p.date,(db.customers.find(c=>c.id===p.cid)||{}).name||p.cid,p.amount,p.method]),...(db.expenses||[]).map(e=>["খরচ",e.date,(e.category||"অন্যান্য")+" - "+e.title,e.amount,""])];download(a,"mill-hisab-full-"+today()+".csv");};
function download(rows,name){const csv="\ufeff"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n"),a=document.createElement("a"),u=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
window.testBiometric=function(){if(window.AndroidBridge&&AndroidBridge.authenticateBiometric)AndroidBridge.authenticateBiometric();else alert("এই সুবিধার জন্য নতুন Android APK প্রয়োজন।");};
window.onBiometricResult=function(ok){if(ok){document.getElementById("pinLock")?.classList.add("hidden");}else alert("বায়োমেট্রিক যাচাই হয়নি। PIN দিয়ে চেষ্টা করুন।");};
function scheduleReminder(){if(localStorage.getItem(REM)!=="1"||!window.AndroidBridge)return;const t=(document.getElementById("reminderTime")?.value||"20:00").split(":").map(Number);AndroidBridge.scheduleDailyReminder(Number.isFinite(t[0])?t[0]:20,Number.isFinite(t[1])?t[1]:0);}
function sendDueNotification(){if(localStorage.getItem(REM)!=="1"||!window.AndroidBridge||localStorage.getItem(REMDAY)===today())return;const x=totals(monthNow());if(x.due>0){AndroidBridge.showDueReminder("মিল হিসাবের বকেয়া","মোট বকেয়া "+money(x.due)+"। বিস্তারিত দেখতে অ্যাপ খুলুন।");localStorage.setItem(REMDAY,today());}}
function setup(){const b=document.getElementById("biometricEnabled"),r=document.getElementById("reminderEnabled"),l=document.getElementById("languageSelect");if(b){b.checked=localStorage.getItem(BIO)==="1";b.onchange=()=>{if(b.checked&&!localStorage.getItem("mill_hisab_pin_v1")){b.checked=false;alert("বায়োমেট্রিক চালুর আগে একটি PIN সেট করুন, যাতে বিকল্পভাবে আনলক করতে পারেন।");return;}localStorage.setItem(BIO,b.checked?"1":"0");if(b.checked)window.testBiometric();};}if(r){r.checked=localStorage.getItem(REM)==="1";r.onchange=()=>{localStorage.setItem(REM,r.checked?"1":"0");if(r.checked&&window.AndroidBridge){AndroidBridge.requestNotificationPermission();scheduleReminder();}else if(window.AndroidBridge)AndroidBridge.cancelDailyReminder();};}const rt=document.getElementById("reminderTime");if(rt){rt.value=localStorage.getItem(REMTIME)||"20:00";rt.onchange=()=>{localStorage.setItem(REMTIME,rt.value);scheduleReminder();};}if(l)l.value=localStorage.getItem(LANG)||"bn";if(window.AndroidBridge&&typeof totals==="function"){const due=Number(totals(monthNow()).due||0);AndroidBridge.updateDueReminder(due>0,"মোট বকেয়া "+money(due)+"। বিস্তারিত দেখতে অ্যাপ খুলুন।");}document.querySelectorAll(".dash-pref").forEach(x=>x.onchange=()=>{localStorage.setItem(DASH,JSON.stringify([...document.querySelectorAll(".dash-pref")].map(y=>y.checked)));prefs();});document.getElementById("activityFilter")?.addEventListener("change",activityView);document.getElementById("customerSearch")?.addEventListener("input",filterCustomers);document.getElementById("customerStatus")?.addEventListener("change",filterCustomers);const excel=document.querySelector("#excel .toolbar");if(excel&&!document.getElementById("fullExportButton")){const b=document.createElement("button");b.id="fullExportButton";b.className="secondary";b.textContent="সম্পূর্ণ হিসাব CSV";b.onclick=window.exportFullExcel;excel.appendChild(b);}setAccent(localStorage.getItem(ACCENT)||"green");prefs();translate();activityView();filterCustomers();window.home();if(localStorage.getItem(REM)==="1")scheduleReminder();sendDueNotification();if(localStorage.getItem(BIO)==="1"&&window.AndroidBridge){document.getElementById("pinLock")?.classList.remove("hidden");AndroidBridge.authenticateBiometric();}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();

// Safety, richer reports, and faster monthly calculations (v2)
(function(){
"use strict";
const priorSave=window.save;
const dataCache=new Map();
function invalidate(){dataCache.clear();}
window.save=function(){invalidate();return priorSave.apply(this,arguments);};

// Recycle bin: deleted payments and expenses remain recoverable until explicitly cleared.
function ensureRecycleBin(){if(!Array.isArray(db.recycleBin))db.recycleBin=[];}
const oldDeletePayment=window.delPay;
window.delPay=function(id){
 const item=(db.payments||[]).find(x=>String(x.id)===String(id));
 if(!item)return;
 if(!confirm("এই পেমেন্টটি রিসাইকেল বিনে পাঠাবেন? পরে পুনরুদ্ধার করা যাবে।"))return;
 ensureRecycleBin();db.recycleBin.push({id:"R"+Date.now()+Math.random().toString(36).slice(2,6),kind:"payment",deletedAt:new Date().toISOString(),record:item});
 db.payments=db.payments.filter(x=>String(x.id)!==String(id));save();renderRecycleBin();
};
const oldDeleteExpense=window.deleteExpense;
window.deleteExpense=function(id){
 const item=(db.expenses||[]).find(x=>String(x.id)===String(id));
 if(!item)return;
 if(!confirm("এই খরচটি রিসাইকেল বিনে পাঠাবেন? পরে পুনরুদ্ধার করা যাবে।"))return;
 ensureRecycleBin();db.recycleBin.push({id:"R"+Date.now()+Math.random().toString(36).slice(2,6),kind:"expense",deletedAt:new Date().toISOString(),record:item});
 db.expenses=db.expenses.filter(x=>String(x.id)!==String(id));save();renderRecycleBin();
};
window.restoreRecycleItem=function(id){
 ensureRecycleBin();const i=db.recycleBin.findIndex(x=>String(x.id)===String(id));if(i<0)return;
 const item=db.recycleBin[i],target=item.kind==="payment"?"payments":item.kind==="expense"?"expenses":null;
 if(!target)return alert("এই ধরনের তথ্য পুনরুদ্ধার করা যাচ্ছে না।");
 if(!Array.isArray(db[target]))db[target]=[];
 if(db[target].some(x=>String(x.id)===String(item.record.id)))return alert("একই তথ্য আগে থেকেই আছে।");
 db[target].push(item.record);db.recycleBin.splice(i,1);save();renderRecycleBin();alert("তথ্য পুনরুদ্ধার হয়েছে।");
};
window.permanentlyDeleteRecycleItem=function(id){
 ensureRecycleBin();if(!confirm("এই তথ্য স্থায়ীভাবে মুছে ফেলবেন? পরে আর ফেরানো যাবে না।"))return;
 db.recycleBin=db.recycleBin.filter(x=>String(x.id)!==String(id));save();renderRecycleBin();
};
window.clearRecycleBin=function(){
 ensureRecycleBin();if(!db.recycleBin.length)return alert("রিসাইকেল বিন খালি।");
 if(!confirm("রিসাইকেল বিনের সব তথ্য স্থায়ীভাবে মুছে ফেলবেন?"))return;
 db.recycleBin=[];save();renderRecycleBin();
};
function renderRecycleBin(){
 const host=document.getElementById("recycleBinRows");if(!host)return;ensureRecycleBin();
 host.innerHTML=db.recycleBin.length?db.recycleBin.slice().reverse().map(x=>{
  const r=x.record||{},label=x.kind==="payment"?"পেমেন্ট":"খরচ",who=x.kind==="payment"?((db.customers.find(c=>c.id===r.cid)||{}).name||"অজানা সদস্য"):(r.title||r.category||"খরচ");
  return '<div class="recycle-item"><div><b>'+esc(label)+" — "+esc(who)+'</b><small>'+esc(r.date||"")+' · '+money(r.amount||0)+'</small></div><div class="recycle-actions"><button class="secondary" onclick="restoreRecycleItem(\''+esc(x.id)+'\')">ফেরত আনুন</button><button class="danger" onclick="permanentlyDeleteRecycleItem(\''+esc(x.id)+'\')">স্থায়ীভাবে মুছুন</button></div></div>';
 }).join(""):'<p class="hint">রিসাইকেল বিন খালি। মুছে ফেলা পেমেন্ট ও খরচ এখানে পাওয়া যাবে।</p>';
}
function installRecycleBin(){
 const section=document.getElementById("activity");if(!section||document.getElementById("recycleBinBox"))return;
 const box=document.createElement("div");box.id="recycleBinBox";box.className="box";box.innerHTML='<div class="box-heading"><div><small class="section-kicker">DATA RECOVERY</small><b>♻️ রিসাইকেল বিন</b></div><button class="danger" onclick="clearRecycleBin()">সব স্থায়ীভাবে মুছুন</button></div><p class="hint">মুছে ফেলা পেমেন্ট ও খরচ এখান থেকে ফিরিয়ে আনা যাবে। স্থায়ীভাবে মুছে দিলে আর ফেরানো যাবে না।</p><div id="recycleBinRows"></div>';
 section.appendChild(box);renderRecycleBin();
}

// Optimized month aggregation: one pass through meal dates and payments, cached until data changes.
const originalData=window.data;
window.data=function(month){
 const m=String(month||"");if(dataCache.has(m))return dataCache.get(m);
 const limit=m<monthNow()?dim(m):m===monthNow()?new Date().getDate():0,end=monthEnd(m);
 const monthMeals=Object.create(null),monthBills=Object.create(null),allBills=Object.create(null),paidToDate=Object.create(null),paidThisMonth=Object.create(null);
 const customers=db.customers||[];
 for(const c of customers){let count=0,bill=0;for(let day=1;day<=limit;day++){const date=m+"-"+String(day).padStart(2,"0"),n=meal(date,c);count+=n;bill+=n*mealRate(date,c);}monthMeals[c.id]=count;monthBills[c.id]=bill;}
 for(const date of Object.keys(db.meals||{})){if(date>end)continue;const day=db.meals[date]||{};for(const cid of Object.keys(day)){const c=customers.find(x=>String(x.id)===String(cid));if(!c)continue;const n=Number(day[cid])||0;allBills[cid]=(allBills[cid]||0)+n*mealRate(date,c);}}
 for(const p of db.payments||[]){const amount=Number(p.amount)||0;if(p.date<=end)paidToDate[p.cid]=(paidToDate[p.cid]||0)+amount;if(p.date.startsWith(m))paidThisMonth[p.cid]=(paidThisMonth[p.cid]||0)+amount;}
 const rows=customers.map(c=>{const meals=monthMeals[c.id]||0,bill=monthBills[c.id]||0,paid=paidToDate[c.id]||0,totalBill=(Number(c.openingDue)||0)+(allBills[c.id]||0),paidMonth=paidThisMonth[c.id]||0;return{...c,meals,bill,paidMonth,paid,totalBill,due:totalBill-paid,monthDue:bill-paidMonth};});
 dataCache.set(m,rows);if(dataCache.size>8)dataCache.delete(dataCache.keys().next().value);return rows;
};
window.totals=function(m){const rows=data(m);return{rows,meals:rows.reduce((s,x)=>s+x.meals,0),bill:rows.reduce((s,x)=>s+x.bill,0),paid:rows.reduce((s,x)=>s+x.paidMonth,0),due:rows.reduce((s,x)=>s+x.due,0)};};

// Add a compact member-wise comparison to the existing monthly report.
const priorReport=window.report;
window.report=function(){
 priorReport();const host=document.getElementById("reportCharts");if(!host)return;
 const m=document.getElementById("reportMonth")?.value||monthNow(),rows=data(m).filter(x=>x.active!==false).slice().sort((a,b)=>b.due-a.due);
 let panel=document.getElementById("memberReportChart");
 if(!panel){panel=document.createElement("div");panel.id="memberReportChart";panel.className="box member-report";host.appendChild(panel);}
 const top=rows.slice(0,8),max=Math.max(1,...top.map(x=>Math.max(0,Number(x.due)||0)));
 panel.innerHTML='<div class="box-heading"><div><small class="section-kicker">MEMBER SUMMARY</small><b>সদস্যভিত্তিক বকেয়া তুলনা</b></div><span class="status-pill">'+rows.length+' জন</span></div>'+
 (top.length?top.map(x=>'<div class="member-report-row"><span>'+esc(x.name)+'</span><div class="feature-track"><div class="feature-fill" style="width:'+Math.max(0,Math.min(100,(Number(x.due)||0)/max*100))+'%"></div></div><b>'+money(x.due)+'</b></div>').join(""):'<p class="hint">এই মাসে কোনো সদস্যের তথ্য নেই।</p>')+
 '<p class="hint">সর্বোচ্চ বকেয়া থাকা প্রথম ৮ জন দেখানো হয়েছে। সম্পূর্ণ তালিকা নিচের রিপোর্ট টেবিলে আছে।</p>';
};
const priorRender=window.render;
window.render=function(){priorRender();renderRecycleBin();};
const style=document.createElement("style");
style.textContent='.recycle-item,.member-report-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}.recycle-item:last-child,.member-report-row:last-child{border-bottom:0}.recycle-item small{display:block;color:var(--muted);font-size:12px}.recycle-actions{display:flex;gap:6px;flex-wrap:wrap}.recycle-actions button{font-size:12px;padding:8px 10px}.member-report{margin-top:12px}.member-report-row>span{width:27%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.member-report-row .feature-track{flex:1}.member-report-row>b{min-width:82px;text-align:right;font-size:13px}@media(max-width:480px){.recycle-item{align-items:flex-start;flex-direction:column}.member-report-row>span{width:30%}.member-report-row>b{min-width:70px;font-size:12px}}';
document.head.appendChild(style);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installRecycleBin);else installRecycleBin();
})();


// Google Sheets-style editing for the combined Excel view.
// Only source values (daily meal counts) are editable; calculated totals stay read-only.
(function(){
"use strict";
const originalExcelRender=window.renderExcel;
if(typeof originalExcelRender!=="function")return;
const excelEditMode=true;
function installExcelEditorUI(){
 const toolbar=document.querySelector("#excel .toolbar");
 if(!toolbar)return;
 document.getElementById("excelEditToggle")?.remove();
 let hint=document.getElementById("excelEditHint");
 if(!hint){
  hint=document.createElement("p");
  hint.id="excelEditHint";
  hint.className="hint";
  const intro=document.querySelector("#excel > .hint");
  if(intro)intro.insertAdjacentElement("afterend",hint);
  else toolbar.insertAdjacentElement("afterend",hint);
 }
 hint.textContent="Google Sheets-এর মতো সরাসরি মিলের ঘরে টাচ করে সংখ্যা লিখুন। Enter চাপলে পরের দিনের ঘরে যাবেন; ঘর পরিবর্তন হলেই সেভ হবে। মোট, বিল ও বকেয়া নিজে থেকে আপডেট হবে।";
}
window.saveExcelMeal=function(date,cid,rawValue){
 const value=String(rawValue??"").trim();
 const amount=value===""?0:Number(value);
 if(!Number.isInteger(amount)||amount<0||amount>2){
  alert("প্রতিদিনের মিল ০, ১ অথবা ২ হতে হবে।");
  window.renderExcel();
  return;
 }
 const customer=(db.customers||[]).find(c=>String(c.id)===String(cid));
 if(!customer)return alert("সদস্যের তথ্য পাওয়া যায়নি।");
 if(!db.meals||typeof db.meals!=="object")db.meals={};
 if(!db.meals[date]||typeof db.meals[date]!=="object")db.meals[date]={};
 if(!db.mealRates||typeof db.mealRates!=="object")db.mealRates={};
 if(!db.mealRates[date]||typeof db.mealRates[date]!=="object")db.mealRates[date]={};
 db.meals[date][cid]=amount;
 db.mealRates[date][cid]=Number(customer.rate)||0;
 save();
};
window.renderExcel=function(){
 originalExcelRender();
 installExcelEditorUI();
 const monthInput=document.getElementById("excelMonth");
 const body=document.getElementById("excelRows");
 if(!monthInput||!body)return;
 const month=monthInput.value||monthNow();
 const days=dim(month);
 const limit=month<monthNow()?days:month===monthNow()?new Date().getDate():0;
 const rows=window.data(month);
 body.innerHTML=rows.map(customer=>{
  const daily=Array.from({length:days},(_,index)=>{
   const day=index+1;
   const date=month+"-"+String(day).padStart(2,"0");
   const count=day<=limit?meal(date,customer):0;
   if(excelEditMode&&day<=limit){
    return '<td><input class="excel-edit-cell" type="number" min="0" max="100" step="0.5" inputmode="decimal" aria-label="'+esc(customer.name)+' '+day+' তারিখের মিল" data-date="'+date+'" data-cid="'+esc(customer.id)+'" value="'+count+'"></td>';
   }
   return "<td>"+count+"</td>";
  }).join("");
  return "<tr><td>"+esc(customer.name)+"</td>"+daily+
   "<td>"+customer.meals+"</td><td>"+money(customer.rate)+"</td><td>"+money(customer.bill)+"</td><td>"+money(customer.due)+"</td></tr>";
 }).join("");
 if(excelEditMode){
  body.querySelectorAll(".excel-edit-cell").forEach(input=>{
   input.addEventListener("change",()=>window.saveExcelMeal(input.dataset.date,input.dataset.cid,input.value));
   input.addEventListener("keydown",event=>{
    if(event.key==="Enter"){
     event.preventDefault();
     const cells=[...body.querySelectorAll(".excel-edit-cell")],index=cells.indexOf(input),next=cells[index+1];
     const nextDate=next?.dataset.date,nextCid=next?.dataset.cid;
     input.blur();
     if(nextDate&&nextCid)setTimeout(()=>{const target=[...body.querySelectorAll(".excel-edit-cell")].find(cell=>cell.dataset.date===nextDate&&cell.dataset.cid===nextCid);target?.focus();target?.select();},0);
    }
    if(event.key==="Escape"){event.preventDefault();window.renderExcel();}
   });
  });
 }
};
const style=document.createElement("style");
style.textContent="#excel .excel-edit-cell{width:62px;min-width:54px;min-height:36px;padding:5px 6px;text-align:center;border:1px solid #83c99e;border-radius:8px;background:#f2fff6;font-weight:750;color:#155d34}#excel .excel-edit-cell:focus{outline:2px solid #16864b;outline-offset:1px}.dark #excel .excel-edit-cell{background:#173b27;color:#d9f4e1;border-color:#4a9566}";
document.head.appendChild(style);
})();
