'use strict';
const {fetchDay,_test:{validDate}}=require('./schedule');
const { _test:{build} }=require('./itineraries');
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','public, s-maxage=180');
 const d=String((req.query||{}).date||'');
 if(!validDate(d)){res.status(400).end(JSON.stringify({error:'日期錯誤'}));return;}
 try{
  const b=await fetchDay(d),x=build(d,b);
  const sample=t=>t?{start:t.start,end:t.end,hsr:t.hsr,bus1:{route:t.bus1.route,dep:t.bus1.dep},bus2:{route:t.bus2.route,dep:t.bus2.dep}}:null;
  res.status(200).end(JSON.stringify({ok:b.status!=='unavailable',version:'ELDER-20261014.4',date:d,sourceStatus:b.status,buses:b.trips.length,matches:x.counts,firstHome:sample(x.home[0]),firstTrain:sample(x.train[0]),checkedAt:new Date().toISOString()}));
 }catch(e){res.status(503).end(JSON.stringify({ok:false,message:'班表服務暫時無法使用'}))}
};
