(()=>{'use strict';
const $=id=>document.getElementById(id);
let direction=null,slot='upcoming',offset=0,requestId=0,data=null,visibleOptions=[],showAll=false,deferredInstall=null;
const timeInt=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
const twfmt=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'numeric',day:'numeric',weekday:'long',hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'});
function twNow(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'}).formatToParts(new Date()),z={};p.forEach(v=>{if(v.type!=='literal')z[v.type]=v.value});return {date:z.year+'-'+z.month+'-'+z.day,time:(z.hour==='24'?'00':z.hour)+':'+z.minute};}
function addDay(d){return new Date(Date.parse(d+'T12:00:00+08:00')+86400000).toISOString().slice(0,10);}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function getStart(){let z=twNow(),date=$('date').value||z.date,time=$('time').value||(date===z.date?z.time:'00:00');return {date,time};}
function dayTitle(d,base){if(d===base)return '今天';if(d===addDay(base))return '明天';return d.slice(5).replace('-','月')+'日';}
function displayNotice(msg){$('message').textContent=msg;}
function heading(){return direction==='home'?'🚄 南港 → 南公館':'🏠 南公館 → 南港';}
function renderStep(emoji,name,route,from,to,approx){return '<div class="stage"><div class="mode">'+emoji+' '+esc(route)+'</div><div class="detail">'+(approx?'約 ':'')+esc(from)+' → '+(approx?'約 ':'')+esc(to)+'</div><div class="dest">'+esc(name)+'</div></div>';}
function renderCard(t,n,base,best){const home=t.dir==='home',date=dayTitle(t.date,base);let steps='';
 if(home){
  steps+=renderStep('🚄','南港高鐵 → 雲林高鐵','高鐵 '+t.hsr.no,t.hsr.dep,t.hsr.arr,false);
  steps+=renderStep('🚌','雲林高鐵 → 虎尾公車站',t.bus1.route,t.bus1.dep,t.bus1.arr,true);
  steps+=renderStep('🚌','虎尾公車站 → 南公館',t.bus2.route,t.bus2.dep,t.bus2.arr,true);
 }else{
  steps+=renderStep('🚌','南公館 → 虎尾公車站',t.bus1.route,t.bus1.dep,t.bus1.arr,true);
  steps+=renderStep('🚌','虎尾公車站 → 雲林高鐵',t.bus2.route,t.bus2.dep,t.bus2.arr,true);
  steps+=renderStep('🚄','雲林高鐵 → 南港高鐵','高鐵 '+t.hsr.no,t.hsr.dep,t.hsr.arr,false);
 }
 return '<article class="journey'+(best?' recommended':'')+'"><div class="cardhead"><div class="lead">'+(best?'⭐ 這時段全程最省時（估計） · ':'')+'第 '+(n+1)+' 組 · '+date+'</div><div class="depart">'+(t.bus1.depEstimated?'約 ':'')+esc(t.start)+' 出發</div></div>'+steps+'<div class="arrival">🏁 '+(home?'到南公館':'到南港高鐵')+'：'+(home?'約 ':'')+esc(t.end)+'</div><div class="listen"><button class="tai" type="button" data-speak="'+n+'" data-lang="tai">🔊 台語聽</button><button class="zh" type="button" data-speak="'+n+'" data-lang="zh">🔈 國語備用</button></div></article>';
}
function collect(){if(!data||!direction)return {items:[],date:getStart().date,actual:null};const start=getStart(),day=offset?addDay(start.date):start.date,record=(data.days||[]).find(x=>x.date===day);if(!record)return {items:[],date:day,actual:record};let items=(record[direction]||[]).slice();
 if(slot==='upcoming'){const min=day===twNow().date?timeInt(getStart().time)+15:0;items=items.filter(t=>timeInt(t.start)>=min);}
 if(slot==='morning')items=items.filter(t=>timeInt(t.start)>=300&&timeInt(t.start)<720);
 if(slot==='afternoon')items=items.filter(t=>timeInt(t.start)>=720&&timeInt(t.start)<1080);
 return {items,date:day,actual:record};}
function paint(){if(!direction||!data)return;const base=getStart().date;
 let pack=collect();if(slot==='upcoming'&&offset===0&&!pack.items.length&&data.days.some(d=>d.date===addDay(base))){offset=1;pack=collect();}
 const date=dayTitle(pack.date,twNow().date),ranked=pack.items.slice().sort((a,b)=>(timeInt(a.end)-timeInt(a.start))-(timeInt(b.end)-timeInt(b.start))||timeInt(a.end)-timeInt(b.end)),best=ranked[0]||null,ordered=best?[best,...pack.items.filter(t=>t!==best)]:[],more=showAll?ordered:ordered.slice(0,8);visibleOptions=more;
 $('tripHeading').textContent=heading();$('dayToggle').textContent=offset?'📅 顯示今天':'📅 顯示明天';
 for(const button of document.querySelectorAll('.slot'))button.setAttribute('aria-pressed',button.dataset.slot===slot?'true':'false');
 $('count').textContent=date+' · '+(slot==='upcoming'?'現在以後':slot==='morning'?'早上':'下午')+'，找到 '+pack.items.length+' 組可轉乘';
 if(!pack.items.length){$('cards').innerHTML='<div class="empty"><h2>🚌 這時段無適合班次</h2><p>可改選早上、下午，或明天。</p></div>';}
 else $('cards').innerHTML=more.map((item,i)=>renderCard(item,i,twNow().date,item===best)).join('');
 $('more').hidden=pack.items.length<=8||showAll;$('more').textContent='顯示更多（共 '+pack.items.length+' 組）';
 $('outputNotice').textContent='⚠️ 高鐵是常態表，公車途中站是估計。非即時到站，可能臨時調整。高鐵轉公車至少25分鐘，公車轉高鐵至少30分鐘；請務必先向業者確認。';
 if(pack.actual&&pack.actual.status!=='derived')$('outputNotice').textContent='⚠️ 公車資料只有部分可用／無法完整確認。請勿只靠此表趕車！';
}
async function query(dir){direction=dir;slot='upcoming';offset=0;showAll=false;const ticket=++requestId,start=getStart();$('output').hidden=false;$('tripHeading').textContent=heading();$('count').textContent='🚌 正在查班次，請稍等…';$('cards').innerHTML='';$('more').hidden=true;$('outputNotice').textContent='';$('output').scrollIntoView({block:'start',behavior:'smooth'});
 try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),17000);let response;
  try{response=await fetch('/api/itineraries?date='+encodeURIComponent(start.date),{signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer);}
  if(!response.ok)throw Error('連線失敗');const incoming=await response.json();if(ticket!==requestId)return;data=incoming;paint();
 }catch(e){if(ticket!==requestId)return;$('count').textContent='⚠️ 暫時無法查車';$('cards').innerHTML='<div class="empty"><h2>⚠️ 查不到車次</h2><p>請家人協助查官方時刻表。</p></div>';$('outputNotice').textContent='系統無法連線時不會顯示不可靠的班次。';}
}
function digits(n){return String(n).split('').map(c=>({'0':'零','1':'一','2':'二','3':'三','4':'四','5':'五','6':'六','7':'七','8':'八','9':'九','A':'欸','B':'比'}[c]||c)).join('');}
function number(n){const a=['零','一','二','三','四','五','六','七','八','九','十'],v=Number(n);if(v<11)return a[v];if(v<20)return '十'+(v%10?a[v%10]:'');return a[Math.floor(v/10)]+'十'+(v%10?a[v%10]:'');}
function timeTai(t){const [h,m]=t.split(':').map(Number);return number(h)+'點'+(m?number(m)+'分':'整');}
function voiceWords(t,tai){const d=t.dir==='home';let s=d?'欲對南港去南公館。':'欲對南公館去南港。';
 if(!tai)s=d?'從南港到南公館。':'從南公館到南港。';
 const step=(start,route,a,b,isTrain)=>tai?(start+'，大約'+timeTai(a)+'，坐'+(isTrain?'高鐵':'公車')+digits(route)+'號。'):(start+'，'+timeTai(a)+'，搭'+(isTrain?'高鐵':'公車')+digits(route)+'號。');
 if(d){s+=step('南港高鐵站',t.hsr.no,t.hsr.dep,t.hsr.arr,true)+step('雲林高鐵站',t.bus1.route,t.bus1.dep,t.bus1.arr,false)+step('虎尾公車站',t.bus2.route,t.bus2.dep,t.bus2.arr,false)+('大約'+timeTai(t.end)+'到南公館。');}
 else{s+=step('南公館',t.bus1.route,t.bus1.dep,t.bus1.arr,false)+step('虎尾公車站',t.bus2.route,t.bus2.dep,t.bus2.arr,false)+step('雲林高鐵站',t.hsr.no,t.hsr.dep,t.hsr.arr,true)+('到南港高鐵站，'+timeTai(t.end)+'。');}
 return s+(tai?'時間若有變動，愛記得先確認。':'途中站是估計時間，務必提前候車。');}
function taiVoice(){if(!('speechSynthesis' in window))return null;return speechSynthesis.getVoices().find(v=>/^(nan|nan-TW)(-|$)/i.test(v.lang)||/\b(Taiwanese Hokkien|Tai-gi|Taigi|Min Nan)\b/i.test(v.name));}
function play(i,lang){const t=visibleOptions[i];if(!t)return;if(!('speechSynthesis' in window)){displayNotice('這台手機無法語音播放。');return;}
 const tai=lang==='tai',voice=tai?taiVoice():(speechSynthesis.getVoices().find(v=>/^zh-TW/i.test(v.lang))||null);
 if(tai&&!voice){displayNotice('此手機沒有台語語音。請按「國語備用」；台語沒有假裝用國語唸。');return;}
 try{speechSynthesis.cancel();const msg=new SpeechSynthesisUtterance(voiceWords(t,tai));if(voice)msg.voice=voice;msg.lang=tai?'nan-TW':'zh-TW';msg.rate=.82;msg.pitch=1;msg.volume=1;speechSynthesis.speak(msg);displayNotice(tai?'正在用台語播報':'正在用國語備用播報');}catch(e){displayNotice('這台手機目前無法語音播放。');}
}
function installDialog(){if(!('showModal' in $('installDialog'))){alert('請在手機瀏覽器選「加入主畫面」');return;}$('installDialog').showModal();}
async function install(){if(deferredInstall){const e=deferredInstall;deferredInstall=null;e.prompt();try{await e.userChoice;}catch(err){}return;}installDialog();}
async function share(){const u=location.origin+'/';if(navigator.share){try{await navigator.share({title:'高鐵公車一鍵搭車｜長輩版',text:'分享給家人，開啟後可以加到手機桌面',url:u});return;}catch(err){if(err.name==='AbortError')return;}}
 try{await navigator.clipboard.writeText(u);displayNotice('網址已複製，請貼給家人');}catch(e){prompt('複製這個網址傳給家人',u);}}
function clock(){$('clock').textContent=twfmt.format(new Date()).replace('24:','00:');}
$('home').addEventListener('click',()=>query('home'));
$('train').addEventListener('click',()=>query('train'));
$('slots').addEventListener('click',e=>{const b=e.target.closest('[data-slot]');if(!b)return;slot=b.dataset.slot;showAll=false;paint();});
$('dayToggle').addEventListener('click',()=>{offset=offset?0:1;showAll=false;paint();});
$('more').addEventListener('click',()=>{showAll=true;paint();});
$('cards').addEventListener('click',e=>{const b=e.target.closest('[data-speak]');if(b)play(Number(b.dataset.speak),b.dataset.lang);});
$('share').addEventListener('click',share);$('install').addEventListener('click',install);$('done').addEventListener('click',()=>$('installDialog').close());
$('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+'/');displayNotice('網址已複製，可傳給家人');$('installDialog').close();}catch(e){prompt('複製網址',location.origin+'/');}});
$('date').addEventListener('change',()=>{if(direction)query(direction);});
$('time').addEventListener('change',()=>{if(direction)query(direction);});
$('reset').addEventListener('click',()=>{$('date').value='';$('time').value='';if(direction)query(direction);});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
clock();setInterval(clock,30000);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
window.__YUNLIN_ELDER_TEST__={getStart,collect,twNow,play,query,paint};
})();
