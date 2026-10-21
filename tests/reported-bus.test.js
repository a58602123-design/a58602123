'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');

// Isolate the itinerary builder from remote schedules; the fixture is test data only.
function loadBuild(){
 const module={exports:{}};
 const north=Object.fromEntries(Array.from({length:7},(_,i)=>[i,[{no:'TEST',dep:'10:00',arr:'11:30'}]]));
 const context={module,exports:module.exports,require(name){
  if(name==='./schedule')return {_test:{dow:day=>new Date(day+'T12:00:00+08:00').getUTCDay()}};
  if(name==='../data/thsr-weekly.json')return {week:{north,south:{}}};
  throw Error('Unexpected dependency '+name);
 }};
 vm.runInNewContext(fs.readFileSync(path.join(root,'api/itineraries.js'),'utf8'),context);
 return context.module.exports._test.build;
}
const build=loadBuild();
const plain=value=>JSON.parse(JSON.stringify(value));
const stops=['07:48','09:00','09:56','13:01','17:14'];
function busFixture(){return {status:'derived',notes:'test fixture',trips:[
 ...stops.map(dep=>({route:'7111',leg:'nan_huwei',dep,arr:'08:40',depEstimated:true,arrEstimated:true})),
 {route:'7104',leg:'huwei_hsr',dep:'09:10',arr:'09:26',arrEstimated:true},
 {route:'7111',leg:'huwei_nan',dep:'11:35',arr:'12:20',arrEstimated:true}
]};}
function record(day='2026-10-21'){return build(day,busFixture());}
async function render(day,direction='train'){
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:id==='date'?day.date:id==='time'?'00:00':'',hidden:false,innerHTML:'',textContent:'',addEventListener(){},scrollIntoView(){},setAttribute(){}});
  return elements.get(id);
 };
 const window={addEventListener(){}};
 const context={window,document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null},
  navigator:{},location:{protocol:'http:',origin:'http://test.local'},Intl,Date,AbortController,URLSearchParams,
  setInterval(){},setTimeout,clearTimeout,
  fetch:async()=>({ok:true,json:async()=>({days:[day]})})};
 vm.runInNewContext(fs.readFileSync(path.join(root,'elder.js'),'utf8'),context);
 await window.__YUNLIN_ELDER_TEST__.query(direction);
 return {html:element('busTimetable').innerHTML,element,app:window.__YUNLIN_ELDER_TEST__};
}

test('06:50 is a separate family-reported student service, not a verified 7111 trip',()=>{
 const day=record();
 assert.ok(Array.isArray(day.reportedBus?.train),'reportedBus.train is required');
 assert.equal(day.reportedBus.train.length,1);
 const trip=day.reportedBus.train[0];
 assert.equal(trip.dep,'06:50');
 assert.equal(trip.route,'學生專車');
 assert.equal(trip.from,'南公館');assert.equal(trip.via,'臺西');assert.equal(trip.to,'虎尾');
 assert.equal(trip.source,'家人實際搭乘');assert.equal(trip.officialConfirmed,false);
 assert.equal(trip.arr,null);assert.equal(trip.operatingDays,null);
 assert.deepEqual(plain(day.reportedBus.home),[]);
});

test('published timetable and transfer recommendations are unchanged by the report',()=>{
 const day=record();
 assert.deepEqual(plain(day.bus7111.train.map(t=>t.dep)),stops);
 assert.equal(day.counts.bus7111Train,5);
 assert.ok(day.train.length>0,'fixture must exercise existing transfers');
 assert.ok(day.train.every(t=>t.start!=='06:50'));
});

test('unknown service days remain unknown, including weekends',()=>{
 for(const date of ['2026-10-21','2026-10-24','2026-10-25']){
  const day=record(date);
  assert.equal(day.reportedBus?.train?.[0]?.operatingDays,null);
  assert.equal(day.reportedBus?.train?.[0]?.officialConfirmed,false);
 }
});

test('northbound timetable displays 06:50 once, first, with uncertainty and route labels',async()=>{
 const view=await render(record());
 assert.match(view.html,/06:50/);
 assert.equal((view.html.match(/06:50/g)||[]).length,1);
 assert.ok(view.html.indexOf('06:50')<view.html.indexOf('07:48'));
 assert.equal((view.html.match(/class="busChip"/g)||[]).length,6);
 for(const label of ['學生專車','家人實際搭乘','行駛日待確認','未獲官方確認','南公館 → 臺西 → 虎尾'])assert.ok(view.html.includes(label),label);
 assert.doesNotMatch(view.html,/全部 6 班/);
 view.app.paint();
 assert.equal((view.element('busTimetable').innerHTML.match(/06:50/g)||[]).length,1);
});

test('southbound timetable does not gain the northbound student service',async()=>{
 const {html}=await render(record(),'home');
 assert.doesNotMatch(html,/06:50|學生專車/);
 assert.match(html,/11:35/);
});

test('upstream failure is not hidden by a family-reported service',async()=>{
 const day=build('2026-10-21',{status:'unavailable',notes:'test unavailable',trips:[]});
 assert.equal(day.status,'unavailable');
 assert.equal(day.train.length,0);
 const {html}=await render(day);
 assert.match(html,/06:50/);
 assert.match(html,/公開班次暫時無法確認/);
 assert.match(html,/未獲官方確認/);
});

test('new frontend remains compatible with older API responses',async()=>{
 const day=record();delete day.reportedBus;
 const {html}=await render(day);
 assert.match(html,/07:48/);
 assert.doesNotMatch(html,/06:50|undefined/);
});

// On the existing GitHub main-branch workflow, also check the actual Vercel deployment.
// Local runs stay deterministic and do not require network access.
test('production deployment serves the reported 06:50 service and its caution labels',
 {skip:process.env.GITHUB_ACTIONS!=='true',timeout:150000},async()=>{
  const until=Date.now()+125000;let lastError;
  while(Date.now()<until){
   try{
    const stamp=Date.now();
    const response=await fetch('https://a58602123.vercel.app/api/itineraries?date=2026-10-21&verify0650='+stamp,{signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200);
    const data=await response.json();
    const day=data.days.find(d=>d.date==='2026-10-21');
    const trip=day?.reportedBus?.train?.find(t=>t.dep==='06:50');
    assert.ok(trip,'deployed API must include the 06:50 family report');
    assert.equal(trip.officialConfirmed,false);assert.equal(trip.arr,null);
    const js=await fetch('https://a58602123.vercel.app/elder.js?verify0650='+stamp,{signal:AbortSignal.timeout(10000)});
    assert.equal(js.status,200);const script=await js.text();
    assert.match(script,/reportedBus/);assert.match(script,/行駛日待確認/);assert.match(script,/未獲官方確認/);
    console.log('LIVE_0650_OK',JSON.stringify({version:data.version,departure:trip.dep,officialConfirmed:trip.officialConfirmed,operatingDays:trip.operatingDays}));
    return;
   }catch(error){lastError=error;}
   await new Promise(resolve=>setTimeout(resolve,6000));
  }
  throw lastError||Error('Production verification timed out');
 });
