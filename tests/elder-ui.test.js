'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const DATE='2099-01-04';
const SOURCE='2026/02/02起常態班表（2026/10/02與高鐵官網核對；非即時，不含臨時加班、減班）';
function item(over){
 return Object.assign({
  date:DATE,dir:'train',start:'08:10',end:'12:20',
  hsr:{no:'818',dep:'11:12',arr:'12:50'},
  bus1:{route:'7111',dep:'08:10',arr:'09:00',depEstimated:true},
  bus2:{route:'7102B',dep:'09:20',arr:'09:46'},
  wait1:20,wait2:40,longWait:false,transferRisk:false,estimated:true
 },over);
}
function day(){
 return {
  date:DATE,status:'derived',notes:'測試',trainSource:SOURCE,
  home:[],
  train:[
   item({start:'08:10'}),
   item({start:'09:20',transferRisk:true,wait2:26,hsr:{no:'814',dep:'10:12',arr:'11:50'},bus2:{route:'7102B',dep:'09:20',arr:'09:46'}}),
   item({start:'12:30',longWait:true,wait2:160,hsr:{no:'830',dep:'14:12',arr:'15:50'}})
  ],
  bus7111:{home:[],train:[{route:'7111',dep:'08:10',arr:'09:00',depEstimated:true}]},
  reportedBus:{home:[],train:[]},
  thsr:{south:[],north:[{no:'814',dep:'10:12',arr:'11:50'},{no:'818',dep:'11:12',arr:'12:50'}]}
 };
}

function boot(storage,customDay){
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   value:id==='date'?DATE:id==='time'?'00:00':'',
   hidden:false,innerHTML:'',textContent:'',
   addEventListener(){},scrollIntoView(){},setAttribute(){}
  });
  return elements.get(id);
 };
 let online=true;
 const window={addEventListener(){}};
 const context={
  window,localStorage:storage,document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null},
  navigator:{},location:{protocol:'http:',origin:'http://test.local'},Intl,Date,AbortController,URLSearchParams,
  setInterval(){},setTimeout,clearTimeout,
  fetch:async()=>{
   if(!online)throw Error('offline');
   return {ok:true,json:async()=>({days:[customDay||day()],source:{timetableBasis:SOURCE}})};
  }
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','elder.js'),'utf8'),context);
 return {element,app:window.__YUNLIN_ELDER_TEST__,setOnline(v){online=v;}};
}
function memoryStorage(){
 const mem=new Map();
 return {getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>{mem.set(k,String(v));}};
}

test('第一屏只留一組較穩的，其餘與久候都在看更多',async()=>{
 const view=boot(memoryStorage());
 await view.app.query('train');
 const cards=view.element('cards').innerHTML;
 assert.equal((cards.match(/<article/g)||[]).length,1);
 assert.match(cards,/08:10/);
 assert.match(cards,/較穩妥/);
 assert.match(cards,/台語慢慢聽/);
 assert.match(cards,/國語備用/);
 assert.doesNotMatch(cards,/轉車太趕|12:30/);
 assert.equal(view.element('more').hidden,false);
 assert.match(view.element('more').textContent,/看更多/);
 assert.equal(view.element('busTimetable').hidden,true);
 assert.equal(view.element('thsrTimetable').hidden,true);
 assert.equal(view.element('tables').hidden,false);
 assert.match(view.element('scheduleBasis').textContent,/高鐵班表依據：2026\/02\/02起常態班表/);
 assert.equal(view.element('staleBanner').hidden,true);
 view.app.showMore();
 assert.match(view.element('cards').innerHTML,/轉車太趕/);
 assert.match(view.element('cards').innerHTML,/26 分鐘/);
 assert.match(view.element('cards').innerHTML,/12:30/);
 assert.match(view.element('cards').innerHTML,/等車很久/);
 assert.equal(view.element('more').hidden,true);
 view.app.openTables();
 assert.equal(view.element('busTimetable').hidden,false);
 assert.equal(view.element('thsrTimetable').hidden,false);
});

test('連線失敗時顯示同一天舊資料與資料時間，別天的舊資料不拿來充數',async()=>{
 const storage=memoryStorage();
 const view=boot(storage);
 view.setOnline(false);
 await view.app.query('train');
 assert.match(view.element('cards').innerHTML,/查不到車次/);
 assert.equal(view.element('staleBanner').hidden,true);
 assert.doesNotMatch(view.element('cards').innerHTML,/資料時間/);
 view.setOnline(true);
 await view.app.query('train');
 assert.match(view.element('cards').innerHTML,/08:10/);
 assert.equal(view.element('staleBanner').hidden,true);
 view.setOnline(false);
 await view.app.query('train');
 assert.equal(view.element('staleBanner').hidden,false);
 assert.match(view.element('staleBanner').textContent,/資料時間：/);
 assert.match(view.element('staleBanner').textContent,/不是即時班次/);
 assert.doesNotMatch(view.element('staleBanner').textContent,/超過兩天/);
 assert.match(view.element('cards').innerHTML,/08:10/);
 assert.doesNotMatch(view.element('cards').innerHTML,/轉車太趕/);
 view.app.showMore();
 assert.match(view.element('cards').innerHTML,/轉車太趕/);
 assert.match(view.element('outputNotice').textContent,/不是剛剛連線/);
 const store=JSON.parse(storage.getItem('yunlin-elder-cache-v1'));
 store.byDate[DATE].savedAt=new Date(Date.now()-3*24*60*60*1000).toISOString();
 storage.setItem('yunlin-elder-cache-v1',JSON.stringify(store));
 await view.app.query('train');
 assert.match(view.element('staleBanner').textContent,/超過兩天/);
 storage.setItem('yunlin-elder-cache-v1',JSON.stringify({byDate:{'2099-01-01':{savedAt:new Date().toISOString(),payload:{days:[{date:'2099-01-01',status:'derived',train:[item({date:'2099-01-01',start:'06:15'})],home:[],bus7111:{home:[],train:[]},reportedBus:{home:[],train:[]},thsr:{north:[],south:[]}}]}}}}));
 await view.app.query('train');
 assert.match(view.element('cards').innerHTML,/查不到車次/);
 assert.doesNotMatch(view.element('cards').innerHTML,/06:15/);
 assert.equal(view.element('staleBanner').hidden,true);
});

test('只有較趕的班次時，第一屏仍顯示轉車警告',async()=>{
 const custom=day();
 custom.train=custom.train.filter(t=>t.transferRisk);
 const view=boot(memoryStorage(),custom);
 await view.app.query('train');
 const cards=view.element('cards').innerHTML;
 assert.equal((cards.match(/<article/g)||[]).length,1);
 assert.match(cards,/轉車太趕/);
 assert.match(cards,/26 分鐘/);
});

test('06:50 學生專車出現在去南港的第一屏，下午改到看更多，回程不出現',async()=>{
 const custom=day();
 custom.reportedBus={home:[],train:[{route:'學生專車',from:'南公館',via:'臺西',to:'虎尾',dep:'06:50',depEstimated:true,reported:true,source:'家人實際搭乘',officialConfirmed:false}]};
 const view=boot(memoryStorage(),custom);
 await view.app.query('train');
 const early=view.element('earlyBus').innerHTML;
 for(const label of ['06:50','學生專車','家人實際搭乘','行駛日待確認','未獲官方確認','南公館 → 臺西 → 虎尾'])assert.match(early,new RegExp(label));
 assert.equal((view.element('cards').innerHTML.match(/<article/g)||[]).length,1);
 assert.equal((view.element('busTimetable').innerHTML.match(/06:50/g)||[]).length,1);
 assert.match(view.element('count').textContent,/清晨學生專車/);
 view.app.setSlot('afternoon');
 assert.equal(view.element('earlyBus').innerHTML,'');
 assert.match(view.element('more').textContent,/06:50 學生專車/);
 view.app.showMore();
 assert.match(view.element('earlyBus').innerHTML,/06:50/);
 await view.app.query('home');
 assert.equal(view.element('earlyBus').innerHTML,'');
 assert.doesNotMatch(view.element('busTimetable').innerHTML,/06:50|學生專車/);
});
