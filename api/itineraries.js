/* 南港高鐵 ⇄ 雲林高鐵 ⇄ 南公館：表定多時段轉乘查詢。
 * 高鐵採自2026-02-02生效的常態週班表，不是即時／特殊日班表。
 * 公車由公路局網站下載起站表定，途中站時間只供估計。
 */
'use strict';
const {fetchDay,_test:{validDate,nextDate,dow}}=require('./schedule');
const THSR=require('../data/thsr-weekly.json');
const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
const gap=(after,before)=>minutes(after)-minutes(before);
const byDep=(a,b)=>minutes(a.dep)-minutes(b.dep);
const MIN_HSR_TO_BUS=25,MIN_BUS_TO_BUS=15,MIN_BUS_TO_HSR=30;
function build(day,bus){
 const routes=bus.trips||[],side=String(dow(day)),south=(THSR.week.south[side]||[]),north=(THSR.week.north[side]||[]);
 const legs=(type)=>routes.filter(x=>x.leg===type && x.route!=='7120').sort(byDep);
 const hsrBus=legs('hsr_huwei'), tigerNan=legs('huwei_nan'),nanTiger=legs('nan_huwei'),tigerHsr=legs('huwei_hsr');
 const home=[],train=[];
 for(const th of south){
  let choices=[];
  for(const a of hsrBus){
   const wait=gap(a.dep,th.arr);
   if(wait<MIN_HSR_TO_BUS||wait>180)continue;
   for(const b of tigerNan){
    const transfer=gap(b.dep,a.arr);
    if(transfer<MIN_BUS_TO_BUS||transfer>100)continue;
    if(gap(b.arr,th.dep)>330)continue;
    choices.push({date:day,dir:'home',start:th.dep,end:b.arr,hsr:{no:th.no,dep:th.dep,arr:th.arr},bus1:a,bus2:b,wait1:wait,wait2:transfer,estimated:true});
   }
  }
  choices.sort((x,y)=>minutes(x.end)-minutes(y.end)||x.wait1+x.wait2-(y.wait1+y.wait2));
  if(choices[0])home.push(choices[0]);
 }
 for(const a of nanTiger){
  let choices=[];
  for(const b of tigerHsr){
   const transfer=gap(b.dep,a.arr);
   if(transfer<MIN_BUS_TO_BUS||transfer>120)continue;
   for(const th of north){
    const wait=gap(th.dep,b.arr);
    if(wait<MIN_BUS_TO_HSR||wait>210)continue;
    choices.push({date:day,dir:'train',start:a.dep,end:th.arr,hsr:{no:th.no,dep:th.dep,arr:th.arr},bus1:a,bus2:b,wait1:transfer,wait2:wait,estimated:true});
   }
  }
  choices.sort((x,y)=>minutes(x.end)-minutes(y.end)||x.wait1+x.wait2-(y.wait1+y.wait2));
  if(choices[0])train.push(choices[0]);
 }
 home.sort((x,y)=>minutes(x.start)-minutes(y.start));
 train.sort((x,y)=>minutes(x.start)-minutes(y.start));
 return {date:day,status:bus.status,notes:bus.notes,home,train,counts:{home:home.length,train:train.length},trainSource:'2026/02/02常態班表（非特殊日或即時資料）'};
}
async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'只支援GET'}));}
 const day=String((req.query||{}).date||'');
 if(!validDate(day)){res.statusCode=400;return res.end(JSON.stringify({error:'日期格式不正確'}));}
 try{
  const list=await Promise.all([fetchDay(day),fetchDay(nextDate(day))]);
  const days=list.map(x=>build(x.date,x));
  res.setHeader('Cache-Control','public, s-maxage=180, stale-while-revalidate=60');
  res.statusCode=200;
  return res.end(JSON.stringify({version:'ELDER-20261014.4',timeZone:'Asia/Taipei',source:{thsr:'https://www.thsrc.com.tw/ArticleContent/a3b630bb-1066-4352-a1ef-58c7b4e8ef7c',bus:'https://www.taiwanbus.tw/',timetableBasis:'2026/02/02常態表；途中站估時、未列臨時增減班'},checkedAt:new Date().toISOString(),days}));
 }catch(e){
  res.statusCode=503;return res.end(JSON.stringify({error:'目前無法確認高鐵或公車轉乘',info:String(e.message||e)}));
 }
}
module.exports=handler;
module.exports._test={build,minutes,gap,MIN_HSR_TO_BUS,MIN_BUS_TO_BUS,MIN_BUS_TO_HSR};
