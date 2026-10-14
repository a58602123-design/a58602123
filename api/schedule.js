/* 雲林一鍵查車：公開班表查詢；非 GPS 即時車輛定位。
 * 公路局時刻表只提供起始站時間，轉乘時刻均標為推估。
 * Vercel Hobby：Node.js serverless function, no dependencies.
 */
'use strict';
const ROUTES=['7102','7104','7111','7120'];
const DAY_NAMES={'日':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6};
function formatDate(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function validDate(day){if(!/^20\d\d-\d\d-\d\d$/.test(day))return false;const d=new Date(day+'T12:00:00+08:00');return !isNaN(d.getTime()) && formatDate(d)===day;}
function nextDate(day){return formatDate(new Date(Date.parse(day+'T12:00:00+08:00')+86400000));}
function dow(day){return new Date(day+'T12:00:00+08:00').getUTCDay();}
function addMins(s,n){let [h,m]=s.split(':').map(Number),v=((h*60+m+n)%1440+1440)%1440;return String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');}
function decodeText(html){return String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<tr\b[^>]*>/gi,'\n').replace(/<br\b[^>]*\/?>/gi,'\n').replace(/<\/(?:td|th)\s*>/gi,' | ').replace(/<\/(?:tr|table|div|p|h[1-6]|section|article)\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;|\u00a0/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/gi,(_,n)=>String.fromCharCode(Number(n))).replace(/\r/g,'').replace(/[ \t]+/g,' ');}
function canRun(rule,date,overrideDow){const a=String(rule||'').replace(/\s/g,'');const day=overrideDow===undefined?dow(date):overrideDow;
 if(/每日/.test(a))return true;
 if(/(?:週|星期)一[～~至-]五/.test(a))return day>=1&&day<=5;
 if(/(?:週|星期)六[、,，]日/.test(a))return day===0||day===6;
 const match=a.match(/(?:每週|週|星期)([一二三四五六日、,，]+)/);if(!match)return false;
 return match[1].split(/[、,，]/).some(s=>DAY_NAMES[s]===day);
}
function projected(date,route,dir,departure){
 const id=route.replace(/[AB]$/,''),out=[];
 function add(leg,from,to){out.push({date,route,leg,dep:addMins(departure,from),arr:addMins(departure,to),estimated:true,depEstimated:from!==0,arrEstimated:true});}
 if(id==='7102'){
  if(dir==='往程')add('hsr_huwei',0,22);
  else if(route==='7102A')add('huwei_hsr',16,38);
  else add('huwei_hsr',18,41);
 }else if(id==='7104'){
  // 7104A 不經高鐵雲林站；7104 虎尾第一站時間，約 16 分鐘到高鐵。
  if(dir==='往程'&&route==='7104')add('huwei_hsr',0,16);
 }else if(id==='7111'){
  if(dir==='往程')add('huwei_nan',0,45);
  else {
   // 麥寮衛生所起站→南公館→虎尾，各班行車時間不同。
   // 以公開站別時刻對照推估：南公館略提早2分候車；到虎尾額外抓5分緩衝。
   // 非公車GPS即時資料；臨時調班仍應向業者查證。
   const stopOffsets={
     '07:40':[8,59],
     '08:55':[5,47],
     '09:50':[6,49],
     '12:50':[11,61],
     '17:05':[9,60]
   };
   const [from,to]=stopOffsets[departure]||[5,65];
   add('nan_huwei',from,to);
  }
 }else if(id==='7120'){
  // 7120 斗六→高鐵雲林站方向，途經虎尾，非反方向班次。
  if(dir==='往程')add('huwei_hsr',34,54);
 }
 return out;
}
function parseRoute(page,route,date){let plain=decodeText(page);
 const mark=/\b(7102|7104|7111|7120)\s*[-－]\s*(0|A|B)\s*(往程|返程)/g;let sections=[],m;
 while((m=mark.exec(plain))!==null)sections.push({start:m.index,end:mark.lastIndex,route:m[1],branch:m[2],direction:m[3]});
 let result=[],seen=new Set();
 for(let i=0;i<sections.length;i++){
  const h=sections[i];if(h.route!==route)continue;
  const body=plain.slice(h.end,i+1<sections.length?sections[i+1].start:plain.length),lines=body.split('\n').map(x=>x.trim()).filter(Boolean);
  const header=lines.findIndex(l=>l.includes('編號')&&l.includes('行駛期間'));if(header<0)continue;
  const before=lines.slice(0,header).join(' ');
  if(/未營運|停駛/.test(before))continue;
  let override;
  let special=before.match(/依\s*週\s*\(\s*([一二三四五六日])\s*\)\s*班次/);
  if(special)override=DAY_NAMES[special[1]];
  for(let j=header+1;j<lines.length;j++){
   const line=lines[j];
   // each tr consists of ordinal, HHMM, operating weekdays, carrier; leading image columns ignored.
   const row=line.match(/(?:^|\|)\s*(?:\S*?\s*)?(\d{1,3})\s*\|\s*(\d{4})\s*\|\s*([^|]+)/);
   if(!row || !canRun(row[3],date,override))continue;
   const raw=row[2],hh=Number(raw.slice(0,2)),mm=Number(raw.slice(2));if(hh>23||mm>59)continue;
   const name=route+(h.branch==='0'?'':h.branch);
   for(const t of projected(date,name,h.direction,raw.slice(0,2)+':'+raw.slice(2))){
     const key=[t.leg,t.route,t.dep].join('/');if(!seen.has(key)){seen.add(key);result.push(t);}
   }
  }
 }
 return result;
}
async function fetchDay(date){
 const results=await Promise.all(ROUTES.map(async id=>{
  try{
   const url='https://www.taiwanbus.tw/eBUSPage/json/TimeTableAPIByWeek.aspx?RouteId='+id+'&SearchDate='+encodeURIComponent(date.replace(/-/g,'/'));
   const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; YunlinBusApp/1.0)','Accept':'text/html'},signal:AbortSignal.timeout(8500)});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const html=await response.text();const list=parseRoute(html,id,date);
   if(!list.length && !html.match(/未營運|停駛/))throw new Error('無法解析班表');
   return {list,error:null};
  }catch(err){return {list:[],error:id+'：'+String(err.message||err)};}
 }));
 const trips=results.flatMap(x=>x.list),errors=results.map(x=>x.error).filter(Boolean);
 return {date,status:!trips.length?'unavailable':errors.length?'partial':'derived',trips,notes:errors.length?errors.join('；'):'依公路局起站時刻推估途中站時間；非即時車輛位置',checkedAt:new Date().toISOString()};
}
async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'只支援 GET'}));}
 const date=String((req.query||{}).date||'');if(!validDate(date)){res.statusCode=400;return res.end(JSON.stringify({error:'日期錯誤'}));}
 try{
  const two=await Promise.all([fetchDay(date),fetchDay(nextDate(date))]);
  res.setHeader('Cache-Control','public, s-maxage=240, stale-while-revalidate=60');
  res.statusCode=200;return res.end(JSON.stringify({checkedAt:new Date().toISOString(),days:two}));
 }catch(err){res.statusCode=503;return res.end(JSON.stringify({error:'暫時無法取得公路局時刻表'}));}
}
module.exports=handler;
module.exports.fetchDay=fetchDay;
module.exports._test={validDate,nextDate,dow,addMins,decodeText,canRun,projected,parseRoute};