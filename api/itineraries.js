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
const MIN_POSSIBLE_BUS_TO_HSR=15; // 15-29分只列為有風險選項，不是長輩推薦
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
    if(transfer<MIN_BUS_TO_BUS)continue; // 長時間候車應顯示警示，不直接刪掉可行的晚班
    // 不因總旅程超過330分鐘就錯誤排除晚班 7111。
    choices.push({date:day,dir:'home',start:th.dep,end:b.arr,hsr:{no:th.no,dep:th.dep,arr:th.arr},bus1:a,bus2:b,wait1:wait,wait2:transfer,longWait:wait>90||transfer>90,estimated:true});
   }
  }
  choices.sort((x,y)=>minutes(x.end)-minutes(y.end)||x.wait1+x.wait2-(y.wait1+y.wait2));
  if(choices[0])home.push(choices[0]);
 }
 // 一個7111公車時段可以接多個高鐵車次，不能只取第一個合格車次。
 // 15～29分：有高鐵，列為「時間不足／不建議長輩」；>=30分才可成為安全建議。
 for(const a of nanTiger){
  for(const th of north){
   const choices=[];
   for(const b of tigerHsr){
    const transfer=gap(b.dep,a.arr);
    if(transfer<MIN_BUS_TO_BUS||transfer>120)continue;
    const wait=gap(th.dep,b.arr);
    if(wait<MIN_POSSIBLE_BUS_TO_HSR||wait>210)continue;
    choices.push({
      date:day,dir:'train',start:a.dep,end:th.arr,
      hsr:{no:th.no,dep:th.dep,arr:th.arr},
      bus1:a,bus2:b,wait1:transfer,wait2:wait,
      transferRisk:wait<MIN_BUS_TO_HSR,
      longWait:transfer>90||wait>90,
      estimated:true
    });
   }
   // 同班高鐵若有多種公車組合，先選>=30分緩衝，再選總等候少的。
   choices.sort((x,y)=>Number(x.transferRisk)-Number(y.transferRisk)
     ||(x.wait1+x.wait2)-(y.wait1+y.wait2));
   if(choices.length)train.push(choices[0]);
  }
 }
 home.sort((x,y)=>minutes(x.start)-minutes(y.start));
 train.sort((x,y)=>minutes(x.start)-minutes(y.start)||minutes(x.hsr.dep)-minutes(y.hsr.dep));
 const bus7111={
   home:tigerNan.filter(t=>/^7111[A-B]?$/.test(t.route)).map(t=>({route:t.route,dep:t.dep,arr:t.arr,arrEstimated:!!t.arrEstimated})),
   train:nanTiger.filter(t=>/^7111[A-B]?$/.test(t.route)).map(t=>({route:t.route,dep:t.dep,arr:t.arr,depEstimated:!!t.depEstimated,arrEstimated:!!t.arrEstimated}))
 };
 return {
   date:day,status:bus.status,notes:bus.notes,home,train,bus7111,
   // 高鐵正確班表與「能不能接到公車」分離，避免沒列出被誤會為沒車。
   thsr:{north:north.map(t=>({no:t.no,dep:t.dep,arr:t.arr})),south:south.map(t=>({no:t.no,dep:t.dep,arr:t.arr}))},
   counts:{home:home.length,train:train.length,bus7111Home:bus7111.home.length,bus7111Train:bus7111.train.length},
   trainSource:'2026/02/02常態班表（非特殊日或即時資料）'
 };
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
  return res.end(JSON.stringify({version:'ELDER-20261015.1',timeZone:'Asia/Taipei',source:{thsr:'https://www.thsrc.com.tw/ArticleContent/a3b630bb-1066-4352-a1ef-58c7b4e8ef7c',bus:'https://www.taiwanbus.tw/',timetableBasis:'2026/02/02常態表；途中站估時、未列臨時增減班'},checkedAt:new Date().toISOString(),days}));
 }catch(e){
  res.statusCode=503;return res.end(JSON.stringify({error:'目前無法確認高鐵或公車轉乘',info:String(e.message||e)}));
 }
}
module.exports=handler;
module.exports._test={build,minutes,gap,MIN_HSR_TO_BUS,MIN_BUS_TO_BUS,MIN_BUS_TO_HSR,MIN_POSSIBLE_BUS_TO_HSR};
