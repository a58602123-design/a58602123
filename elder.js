(()=>{'use strict';
const $=id=>document.getElementById(id);
let direction=null,slot='upcoming',offset=0,requestId=0,data=null,visibleOptions=[],showAll=false,showTables=false,earlyShown=[],deferredInstall=null,staleSavedAt=null;
const STORE_KEY='yunlin-elder-cache-v1';
const timeInt=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
const twfmt=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'numeric',day:'numeric',weekday:'long',hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'});
function twNow(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'}).formatToParts(new Date()),z={};p.forEach(v=>{if(v.type!=='literal')z[v.type]=v.value});return {date:z.year+'-'+z.month+'-'+z.day,time:(z.hour==='24'?'00':z.hour)+':'+z.minute};}
function addDay(d){return new Date(Date.parse(d+'T12:00:00+08:00')+86400000).toISOString().slice(0,10);}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function getStart(){let z=twNow(),date=$('date').value||z.date,time=$('time').value||(date===z.date?z.time:'00:00');return {date,time};}
function dayTitle(d,base){if(d===base)return '今天';if(d===addDay(base))return '明天';return d.slice(5).replace('-','月')+'日';}
function displayNotice(msg){$('message').textContent=msg;}
function browserStorage(){
 try{const s=globalThis.localStorage;if(s&&typeof s.getItem==='function'&&typeof s.setItem==='function')return s;}catch(e){}
 return null;
}
function remember(date,payload){
 const s=browserStorage();if(!s||!date||!payload||!Array.isArray(payload.days))return;
 let store={};try{store=JSON.parse(s.getItem(STORE_KEY)||'{}')||{};}catch(e){store={};}
 if(!store.byDate||typeof store.byDate!=='object')store.byDate={};
 store.byDate[date]={savedAt:new Date().toISOString(),payload};
 const keys=Object.keys(store.byDate).sort((a,b)=>String(store.byDate[a].savedAt).localeCompare(String(store.byDate[b].savedAt)));
 while(keys.length>8)delete store.byDate[keys.shift()];
 try{s.setItem(STORE_KEY,JSON.stringify(store));}catch(e){}
}
function recall(date){
 const s=browserStorage();if(!s)return null;
 let store;try{store=JSON.parse(s.getItem(STORE_KEY)||'{}');}catch(e){return null;}
 const by=store&&store.byDate||{};
 const list=Object.values(by).filter(e=>e&&e.payload&&Array.isArray(e.payload.days)&&e.payload.days.some(d=>d&&d.date===date));
 list.sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));
 return list[0]||null;
}
function formatStamp(iso){
 const d=new Date(iso);if(isNaN(d.getTime()))return '先前保存';
 return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'}).format(d).replace('24:','00:');
}
function staleBannerText(savedAt){
 const age=Date.now()-Date.parse(savedAt);
 const old=Number.isFinite(age)&&age>48*60*60*1000?'這份資料已保存超過兩天。':'';
 return '資料時間：'+formatStamp(savedAt)+'。現在連不上新資料，下面是先前查到的班表，不是即時班次。'+old+'請向高鐵或客運再確認。';
}
function heading(){return direction==='home'?'🚄 南港 → 南公館':'🏠 南公館 → 南港';}
function renderStep(emoji,name,route,from,to,approx){return '<div class="stage"><div class="mode">'+emoji+' '+esc(route)+'</div><div class="detail">'+(approx?'約 ':'')+esc(from)+' → '+(approx?'約 ':'')+esc(to)+'</div><div class="dest">'+esc(name)+'</div></div>';}
function renderCard(t,n,base,best){const home=t.dir==='home',date=dayTitle(t.date,base);let steps='';
 if(home){
  steps+=renderStep('🚄','南港高鐵 → 雲林高鐵','高鐵 '+String(t.hsr.no).padStart(4,'0'),t.hsr.dep,t.hsr.arr,false);
  steps+=renderStep('🚌','雲林高鐵 → 虎尾公車站',t.bus1.route,t.bus1.dep,t.bus1.arr,true);
  steps+=renderStep('🚌','虎尾公車站 → 南公館',t.bus2.route,t.bus2.dep,t.bus2.arr,true);
 }else{
  steps+=renderStep('🚌','南公館 → 虎尾公車站',t.bus1.route,t.bus1.dep,t.bus1.arr,true);
  steps+=renderStep('🚌','虎尾公車站 → 雲林高鐵',t.bus2.route,t.bus2.dep,t.bus2.arr,true);
  steps+=renderStep('🚄','雲林高鐵 → 南港高鐵','高鐵 '+String(t.hsr.no).padStart(4,'0'),t.hsr.dep,t.hsr.arr,false);
 }
 const readableWait=m=>m>=60?Math.floor(m/60)+'小時'+(m%60?m%60+'分':''):m+'分鐘';
 const longParts=[];
 if(t.wait1>90)longParts.push((home?'雲林高鐵站':'虎尾站')+'要等'+readableWait(t.wait1));
 if(t.wait2>90)longParts.push((home?'虎尾站':'雲林高鐵站')+'要等'+readableWait(t.wait2));
 const tight=t.dir==='train'&&t.transferRisk?
  '<div class="dangerWait">⚠️ 有這班高鐵，但轉車太趕！<br>公車到高鐵站約 '+esc(t.bus2.arr)+'，高鐵 '+esc(t.hsr.dep)+' 出發，只相差約 '+t.wait2+' 分鐘。<br>公車到站是估計，長輩請選至少預留30分鐘的車次。</div>':'';
 const caution=tight+(longParts.length?'<div class="longWait">⏳ 等車很久！<br>'+longParts.map(esc).join('、')+'。<br>請家人確認是否要改搭其他交通工具。</div>':'');
 return '<article class="journey'+(best?' recommended':'')+'"><div class="cardhead"><div class="lead">'+(best?'⭐ 較穩妥轉乘（預留30分鐘） · ':'')+'第 '+(n+1)+' 組 · '+date+'</div><div class="depart">'+(t.bus1.depEstimated?'約 ':'')+esc(t.start)+' 出發</div></div>'+steps+'<div class="arrival">🏁 '+(home?'到南公館':'到南港高鐵')+'：'+(home?'約 ':'')+esc(t.end)+'</div>'+caution+'<div class="listen"><button class="tai" type="button" data-speak="'+n+'" data-lang="tai">🔊 台語慢慢聽</button><button class="zh" type="button" data-speak="'+n+'" data-lang="zh">🔈 國語備用</button></div><div class="voiceStatus" data-voice-status="'+n+'" role="status" aria-live="polite"></div><button class="repeatTai" type="button" data-speak="'+n+'" data-lang="repeat">🔁 重聽剛才這段</button></article>';
}
function collect(){if(!data||!direction)return {items:[],date:getStart().date,actual:null};const start=getStart(),day=offset?addDay(start.date):start.date,record=(data.days||[]).find(x=>x.date===day);if(!record)return {items:[],date:day,actual:record};let items=(record[direction]||[]).slice();
 if(slot==='upcoming'){const min=day===twNow().date?timeInt(getStart().time)+15:0;items=items.filter(t=>timeInt(t.start)>=min);}
 if(slot==='morning')items=items.filter(t=>timeInt(t.start)>=300&&timeInt(t.start)<720);
 if(slot==='afternoon')items=items.filter(t=>timeInt(t.start)>=720&&timeInt(t.start)<1080);
 return {items,date:day,actual:record};}
function paint(){if(!direction||!data)return;const base=getStart().date;
 let pack=collect();if(slot==='upcoming'&&offset===0&&!pack.items.length&&data.days.some(d=>d.date===addDay(base))){offset=1;pack=collect();}
 const date=dayTitle(pack.date,twNow().date);
 const safe=pack.items.filter(x=>!x.longWait&&!x.transferRisk).sort((a,b)=>(timeInt(a.end)-timeInt(a.start))-(timeInt(b.end)-timeInt(b.start))||timeInt(a.end)-timeInt(b.end));
 const best=safe[0]||null;
 const tight=pack.items.filter(t=>t.transferRisk&&!t.longWait).sort((a,b)=>(b.wait2||0)-(a.wait2||0)||timeInt(a.start)-timeInt(b.start));
 const delayed=pack.items.filter(t=>t.longWait);
 const primary=best||tight[0]||null;
 const ordered=best?[best,...safe.slice(1),...tight,...delayed]:tight.concat(delayed);
 const visible=showAll?ordered:(primary?[primary]:[]);
 visibleOptions=visible;
 const staleEl=$('staleBanner');
 if(staleEl){if(staleSavedAt){staleEl.hidden=false;staleEl.textContent=staleBannerText(staleSavedAt);}else{staleEl.hidden=true;staleEl.textContent='';}}
 const basis=(pack.actual&&pack.actual.trainSource)||(data.source&&data.source.timetableBasis)||'';
 const basisEl=$('scheduleBasis');
 if(basisEl)basisEl.textContent=basis?('高鐵班表依據：'+basis):'高鐵班表依據：常態班表（非即時資料）';
 $('tripHeading').textContent=heading();$('dayToggle').textContent=offset?'📅 顯示今天':'📅 顯示明天';
 for(const button of document.querySelectorAll('.slot'))button.setAttribute('aria-pressed',button.dataset.slot===slot?'true':'false');
 const slotName=slot==='upcoming'?'現在以後':slot==='morning'?'早上':'下午';
 let summary=date+' · '+slotName+'：';
 if(primary&&!primary.transferRisk)summary+='建議先看這一組';
 else if(primary)summary+='有車，但轉車較趕';
 else summary+='這時段沒有較穩的組合';
 $('count').textContent=summary;
 const dailyBus=pack.actual?.bus7111?.[direction];
 const officialBus=Array.isArray(dailyBus)?dailyBus:[];
 const reportedBus=Array.isArray(pack.actual?.reportedBus?.[direction])?pack.actual.reportedBus[direction]:[];
 const displayedBus=[...officialBus,...reportedBus].sort((a,b)=>timeInt(a.dep)-timeInt(b.dep));
 const busBox=$('busTimetable');
 if(displayedBus.length){
   const title=reportedBus.length?'🚌 南公館 → 臺西 → 虎尾':'🚌 7111 '+(direction==='home'?'虎尾 → 南公館':'南公館 → 虎尾');
   const count=reportedBus.length
     ?date+(officialBus.length?'公開班表 '+officialBus.length+' 班':'公開班次暫時無法確認')+'＋家人回報 '+reportedBus.length+' 班'
     :date+'全部 '+officialBus.length+' 班';
   busBox.innerHTML='<div class="busTitle">'+title+'<br>'+count+'</div>'
     +'<div class="busTimes">'+displayedBus.map(t=>'<div class="busChip">'+(t.depEstimated?'約 ':'')+esc(t.dep)
       +(t.reported?'<small>'+esc(t.route)+'<br>'+esc(t.source)+'<br>行駛日待確認</small>':t.route==='7111A'?'<small>7111A</small>':'')+'</div>').join('')+'</div>'
     +(reportedBus.length?'<p>⚠️ 學生專車：家人曾以一般民眾身分搭乘，未獲官方確認。行駛日及到虎尾時間待確認，未納入下方高鐵轉乘計算。</p>':'')
     +'<p>▲ 上面那一組才是建議的轉乘。這裡是全部班次，不是每一班都接得上高鐵。</p>';
 }else{
   busBox.innerHTML='<div class="busTitle">🚌 7111 全部班次暫時無法確認</div><p>請家人查客運官方班表，不要把「查不到」當成「沒有車」。</p>';
 }
 // 高鐵班次要獨立列出：30分鐘緩衝不足不代表沒有這班高鐵。
 const railBox=$('thsrTimetable');
 const sourceTrains=pack.actual?.thsr?.[direction==='train'?'north':'south'];
 if(Array.isArray(sourceTrains)&&sourceTrains.length){
  const start=getStart();
  const filtered=sourceTrains.filter(t=>{
    const minute=timeInt(t.dep);
    if(slot==='morning')return minute>=300&&minute<720;
    if(slot==='afternoon')return minute>=720&&minute<1080;
    if(pack.date===start.date&&slot==='upcoming')return minute>=timeInt(start.time);
    return true;
  });
  const from=direction==='train'?'雲林':'南港',to=direction==='train'?'南港':'雲林';
  railBox.innerHTML='<div class="railTitle">🚄 高鐵表定班次｜'+from+' → '+to+'</div>'
   +'<p class="railIntro">這些是高鐵班次，<strong>不代表每班都能從公車順利轉乘</strong>。</p>'
   +'<div class="railGrid">'+filtered.map(t=>'<div class="railTrip"><span class="railNo">高鐵 '+esc(String(t.no).padStart(4,'0'))+'</span>'
   +'<strong>'+esc(t.dep)+'</strong><small>到'+to+' '+esc(t.arr)+'</small></div>').join('')+'</div>'
   +'<p class="railIntro">此時段共 '+filtered.length+' 班；特殊日可能調整，以高鐵官網當日查詢為準。</p>';
 }else{
  railBox.innerHTML='<div class="railTitle">🚄 暫時無法確認高鐵完整時刻</div><p class="railIntro">不能把查不到當成沒有高鐵。</p>';
 }
 const earlyAll=Array.isArray(pack.actual?.reportedBus?.[direction])?pack.actual.reportedBus[direction].filter(t=>t&&t.dep):[];
 const viewing=offset?addDay(getStart().date):getStart().date;
 const earlyFits=dep=>{
  if(showAll)return true;
  if(slot==='morning')return timeInt(dep)<720;
  if(slot==='afternoon')return false;
  if(viewing!==twNow().date)return true;
  return timeInt(dep)>=timeInt(getStart().time);
 };
 const earlyVisible=earlyAll.filter(t=>earlyFits(t.dep));
 earlyShown=earlyVisible;
 if(earlyVisible.length)$('count').textContent+='。清晨學生專車也在上面';
 const earlyEl=$('earlyBus');
 if(earlyEl){
  earlyEl.innerHTML=earlyVisible.map((t,i)=>'<article class="earlyBus"><div class="cardhead"><div class="lead">清晨學生專車 · 不是高鐵轉乘</div><div class="depart">'+(t.depEstimated?'約 ':'')+esc(t.dep)+' 出發</div></div><div class="stage"><div class="mode">🚌 '+esc(t.route||'學生專車')+'</div><div class="detail">'+esc(t.from||'南公館')+' → '+esc(t.via||'臺西')+' → '+esc(t.to||'虎尾')+'</div><div class="dest">'+esc(t.source||'家人實際搭乘')+' · 行駛日待確認 · 未獲官方確認</div></div><div class="longWait">這班是家人實際搭乘，行駛日待確認。到虎尾的時間還不知道，沒有算進高鐵轉乘。</div><div class="listen"><button class="zh" type="button" data-early="'+i+'">🔊 國語聽這班公車</button></div></article>').join('');
 }
 if(!ordered.length)$('cards').innerHTML='<div class="empty"><h2>這時段沒有接得上的高鐵組合</h2><p>可改選早上、下午，或明天。</p></div>';
 else if(!visible.length)$('cards').innerHTML='<div class="empty"><h2>這時段沒有較穩的組合</h2><p>其他班次請按「看更多」。</p></div>';
 else $('cards').innerHTML=visible.map((item,i)=>renderCard(item,i,twNow().date,item===best&&!item.transferRisk)).join('');
 const hiddenTrips=ordered.length-visible.length;
 const hiddenEarly=earlyAll.length-earlyVisible.length;
 const hiddenTotal=hiddenTrips+hiddenEarly;
 $('more').hidden=hiddenTotal<=0;
 let moreText='看更多';
 if(hiddenTotal){
  moreText='看更多（還有 '+hiddenTotal+' 項）';
  if(hiddenEarly)moreText+='，含 '+(earlyAll.find(t=>!earlyVisible.includes(t))||{}).dep+' 學生專車';
 }
 $('more').textContent=moreText;
 const tablesBtn=$('tables');
 if(tablesBtn){tablesBtn.hidden=!!showTables;tablesBtn.textContent='看全部公車和高鐵班次';}
 busBox.hidden=!showTables;
 railBox.hidden=!showTables;
 let notice='⚠️ 高鐵是常態表，公車途中站是估計。非即時到站，可能臨時調整。高鐵轉公車至少25分鐘，公車轉高鐵至少30分鐘；請務必先向業者確認。';
 if(pack.actual&&pack.actual.status!=='derived')notice='⚠️ 公車資料只有部分可用／無法完整確認。請勿只靠此表趕車！';
 if(staleSavedAt)notice='⚠️ 上面「資料時間」是先前查到的班表，不是剛剛連線的結果。'+notice;
 $('outputNotice').textContent=notice;
}
async function query(dir){stopTai();if('speechSynthesis' in window)speechSynthesis.cancel();lastTaiPart=null;direction=dir;slot='upcoming';offset=0;showAll=false;showTables=false;staleSavedAt=null;earlyShown=[];const ticket=++requestId,start=getStart();$('output').hidden=false;$('tripHeading').textContent=heading();$('count').textContent='🚌 正在查班次，請稍等…';$('cards').innerHTML='';const pendingEarly=$('earlyBus');if(pendingEarly)pendingEarly.innerHTML='';$('busTimetable').hidden=true;$('thsrTimetable').hidden=true;$('more').hidden=true;const pendingTables=$('tables');if(pendingTables)pendingTables.hidden=true;$('outputNotice').textContent='';const pendingBanner=$('staleBanner');if(pendingBanner){pendingBanner.hidden=true;pendingBanner.textContent='';}const pendingBasis=$('scheduleBasis');if(pendingBasis)pendingBasis.textContent='';$('output').scrollIntoView({block:'start',behavior:'smooth'});
 try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),17000);let response;
  try{response=await fetch('/api/itineraries?date='+encodeURIComponent(start.date),{signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer);}
  if(!response.ok)throw Error('連線失敗');const incoming=await response.json();if(ticket!==requestId)return;if(!incoming||!Array.isArray(incoming.days))throw Error('資料不完整');data=incoming;staleSavedAt=null;remember(start.date,incoming);paint();
 }catch(e){if(ticket!==requestId)return;const cached=recall(start.date);if(cached){data=cached.payload;staleSavedAt=cached.savedAt;paint();return;}$('busTimetable').hidden=true;$('thsrTimetable').hidden=true;const failEarly=$('earlyBus');if(failEarly)failEarly.innerHTML='';const failTables=$('tables');if(failTables)failTables.hidden=true;const failBanner=$('staleBanner');if(failBanner)failBanner.hidden=true;$('count').textContent='⚠️ 暫時無法查車';$('cards').innerHTML='<div class="empty"><h2>⚠️ 查不到車次</h2><p>請家人協助查官方時刻表。這台手機還沒有這天可顯示的舊班表。</p></div>';$('outputNotice').textContent='系統無法連線，也沒有這天先前查到的班表，所以不會顯示其他日子的車次。';}
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
let loudCtx=null;
function boostLoud(sound){
 try{sound.volume=1;}catch(e){}
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC||sound._boosted)return;
 try{
  if(!loudCtx)loudCtx=new AC();
  if(loudCtx.resume)loudCtx.resume();
  const src=loudCtx.createMediaElementSource(sound);
  const gain=loudCtx.createGain();
  gain.gain.value=2;
  const comp=loudCtx.createDynamicsCompressor();
  comp.threshold.value=-8;comp.knee.value=6;comp.ratio.value=3;comp.attack.value=0.003;comp.release.value=0.15;
  src.connect(gain);gain.connect(comp);comp.connect(loudCtx.destination);
  sound._boosted=true;sound._gain=gain;
 }catch(e){}
}
// Keep each Taiwanese recording short. This avoids the late-phrase gibberish of long syntheses.
let activeAudio=null,audioSession=0,lastTaiPart=null;
function stopTai(){
 audioSession++;
 if(activeAudio){
  const el=activeAudio;activeAudio=null;
  try{el.pause();el.removeAttribute('src');el.load();}catch(e){}
  try{if(el.remove)el.remove();}catch(e){}
 }
}
function voiceStatus(i,message){
 displayNotice(message);
 const el=document.querySelector('[data-voice-status="'+i+'"]');
 if(el)el.textContent=message;
}
function playTai(t,i,onlyPart=null){
 stopTai();
 if('speechSynthesis' in window)speechSynthesis.cancel();
 const session=audioSession;
 const qs=new URLSearchParams({
  dir:t.dir,hsr:String(t.hsr.no),hsrDep:t.hsr.dep,hsrArr:t.hsr.arr,
  bus1:t.bus1.route,bus1Dep:t.bus1.dep,bus2:t.bus2.route,bus2Dep:t.bus2.dep,end:t.end
 });
 let part=onlyPart===null?0:onlyPart;
 const labels=t.dir==='home'?['南港搭高鐵','雲林換公車','虎尾轉車到南公館']:['南公館搭公車','虎尾換公車','雲林搭高鐵'];
 const sound=new Audio();
 sound.preload='auto';
 sound.setAttribute('playsinline','');
 try{if(document.body)document.body.appendChild(sound);}catch(e){}
 activeAudio=sound;
 let failed=false;
 function alive(){return audioSession===session&&activeAudio===sound;}
 function fail(message){if(!alive()||failed)return;failed=true;voiceStatus(i,message);activeAudio=null;try{sound.pause();if(sound.remove)sound.remove();}catch(e){}}
 function slowDown(){
  if(!alive())return;
  try{sound.playbackRate=.85;}catch(e){}
  try{sound.preservesPitch=true;}catch(e){}
  try{if('webkitPreservesPitch' in sound)sound.webkitPreservesPitch=true;}catch(e){}
  try{sound.volume=1;}catch(e){}
  if(sound._gain)try{sound._gain.gain.value=2;}catch(e){}
 }
 function step(){
  if(!alive())return;
  failed=false;
  lastTaiPart={i,part,t};
  // iPhone rejects play() if playbackRate is not 1 before the file is ready.
  try{sound.playbackRate=1;}catch(e){}
  try{sound.volume=1;}catch(e){}
  boostLoud(sound);
  sound.src='/api/taigi?v=11&part='+part+'&'+qs.toString();
  voiceStatus(i,'🔊 第 '+(part+1)+' 段：'+labels[part]+'，正在準備台語…');
  try{
   const started=sound.play();
   if(started&&started.catch)started.catch(err=>{if(!alive()||failed)return;if(err&&err.name==='AbortError')return;fail('⚠️ 第 '+(part+1)+' 段不能播放。可按「重聽剛才這段」或用國語備用。');});
  }catch(e){fail('⚠️ 手機暫時無法播放，請再按一次或用國語備用。');}
 }
 sound.addEventListener('playing',()=>{slowDown();if(alive())voiceStatus(i,'🐢 台語慢速 · 第 '+(part+1)+' 段：'+labels[part]);});
 sound.addEventListener('waiting',()=>{if(alive())voiceStatus(i,'⏳ 第 '+(part+1)+' 段台語音檔準備中，請稍等…');});
 sound.addEventListener('error',()=>{if(!alive()||failed)return;const code=sound.error&&sound.error.code;if(code===1)return;fail('⚠️ 第 '+(part+1)+' 段台語暫時無法播放。免費服務可能忙碌，可重聽或使用國語備用。');});
 sound.addEventListener('ended',()=>{
  if(!alive()||failed)return;
  lastTaiPart={i,part,t};
  if(part<2&&onlyPart===null){
   part++;
   step(); // reuse the same audio element for iPhone playlist playback
  }else{
   activeAudio=null;
   try{if(sound.remove)sound.remove();}catch(e){}
   voiceStatus(i,onlyPart===null?'✅ 三段播完。若有聽無，按「重聽剛才這段」。':'✅ 這段已重聽完成。');
  }
 });
 step();
}
function speakEarly(t){
 if(!t)return;
 stopTai();
 if(!('speechSynthesis' in window)){displayNotice('這台手機沒有國語語音。');return;}
 try{
  speechSynthesis.cancel();
  const msg=new SpeechSynthesisUtterance('清晨'+timeTai(t.dep)+'，南公館學生專車，經過臺西到虎尾。這是家人實際搭過的，行駛日還沒確認，沒有算進高鐵轉乘。');
  const voice=speechSynthesis.getVoices().find(v=>/^zh-TW/i.test(v.lang))||null;
  if(voice)msg.voice=voice;
  msg.lang='zh-TW';msg.rate=.85;msg.pitch=1;msg.volume=1;
  speechSynthesis.speak(msg);
  displayNotice('正在用國語說清晨學生專車');
 }catch(e){displayNotice('這台手機暫時無法播放國語。');}
}
function play(i,lang){
 const t=visibleOptions[i];if(!t)return;
 if(lang==='tai'){playTai(t,i);return;}
 if(lang==='repeat'){
  if(!lastTaiPart||lastTaiPart.i!==i||lastTaiPart.t!==t){voiceStatus(i,'請先按「台語慢慢聽」，再重聽不清楚的段落。');return;}
  playTai(t,i,lastTaiPart.part);return;
 }
 stopTai();
 if(!('speechSynthesis' in window)){voiceStatus(i,'這台手機沒有國語語音功能。');return;}
 try{
  speechSynthesis.cancel();
  const voice=speechSynthesis.getVoices().find(v=>/^zh-TW/i.test(v.lang))||null;
  const msg=new SpeechSynthesisUtterance(voiceWords(t,false));
  if(voice)msg.voice=voice;
  msg.lang='zh-TW';msg.rate=.8;msg.pitch=1;msg.volume=1;
  speechSynthesis.speak(msg);
  voiceStatus(i,'正在播放國語備用語音');
 }catch(e){voiceStatus(i,'這台手機暫時無法播放國語。');}
}
function installDialog(){if(!('showModal' in $('installDialog'))){alert('請在手機瀏覽器選「加入主畫面」');return;}$('installDialog').showModal();}
async function install(){if(deferredInstall){const e=deferredInstall;deferredInstall=null;e.prompt();try{await e.userChoice;}catch(err){}return;}installDialog();}
async function share(){const u=location.origin+'/';if(navigator.share){try{await navigator.share({title:'高鐵公車一鍵搭車｜長輩版',text:'分享給家人，開啟後可以加到手機桌面',url:u});return;}catch(err){if(err.name==='AbortError')return;}}
 try{await navigator.clipboard.writeText(u);displayNotice('網址已複製，請貼給家人');}catch(e){prompt('複製這個網址傳給家人',u);}}
function clock(){$('clock').textContent=twfmt.format(new Date()).replace('24:','00:');}
$('home').addEventListener('click',()=>query('home'));
$('train').addEventListener('click',()=>query('train'));
$('slots').addEventListener('click',e=>{const b=e.target.closest('[data-slot]');if(!b)return;stopTai();if('speechSynthesis' in window)speechSynthesis.cancel();lastTaiPart=null;slot=b.dataset.slot;showAll=false;showTables=false;paint();});
$('dayToggle').addEventListener('click',()=>{stopTai();if('speechSynthesis' in window)speechSynthesis.cancel();lastTaiPart=null;offset=offset?0:1;showAll=false;showTables=false;paint();});
$('more').addEventListener('click',()=>{showAll=true;paint();});
$('tables').addEventListener('click',()=>{showTables=true;paint();});
$('cards').addEventListener('click',e=>{const b=e.target.closest('[data-speak]');if(b)play(Number(b.dataset.speak),b.dataset.lang);});
$('earlyBus').addEventListener('click',e=>{const b=e.target.closest('[data-early]');if(b)speakEarly(earlyShown[Number(b.dataset.early)]);});
$('share').addEventListener('click',share);$('install').addEventListener('click',install);$('done').addEventListener('click',()=>$('installDialog').close());
$('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+'/');displayNotice('網址已複製，可傳給家人');$('installDialog').close();}catch(e){prompt('複製網址',location.origin+'/');}});
$('date').addEventListener('change',()=>{if(direction)query(direction);});
$('time').addEventListener('change',()=>{if(direction)query(direction);});
$('reset').addEventListener('click',()=>{$('date').value='';$('time').value='';if(direction)query(direction);});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
clock();setInterval(clock,30000);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
window.__YUNLIN_ELDER_TEST__={getStart,collect,twNow,play,query,paint,showMore(){showAll=true;paint();},openTables(){showTables=true;paint();},setSlot(name){slot=name;showAll=false;showTables=false;paint();},recall};
})();
