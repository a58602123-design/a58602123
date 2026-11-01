'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const schedule=require('../api/schedule');
const t=schedule._test;

function segment(route,branch,dir,rows){
 return `<div>【${route} - ${branch} ${dir}】<br>臺西客運 </div><table><tr><th>編號</th><th>虎尾</th><th>行駛期間</th><th>客運業者</th></tr>${rows.map(([num,dep,when])=>`<tr><td>${num}</td><td>${dep}</td><td>${when}</td><td>臺西客運</td></tr>`).join('')}</table>`;
}

test('同一日期的公路局結果留在記憶體十分鐘，失敗與過期不沿用',async()=>{
 t.clearDayCache();
 const html=segment('7102','A','往程',[[1,'1055','每日行駛']]);
 let calls=0;
 const fetcher=async()=>{calls++;return {ok:true,text:async()=>html};};
 const first=await schedule.fetchDay('2099-01-04',fetcher);
 const second=await schedule.fetchDay('2099-01-04',fetcher);
 assert.equal(first.fromMemory,false);
 assert.equal(second.fromMemory,true);
 assert.equal(calls,4,'四條路線只在第一次下載');
 assert.equal(second.status,'partial');
 assert.ok(second.trips.some(x=>x.route==='7102A'&&x.dep==='10:55'));
 const other=await schedule.fetchDay('2099-01-05',fetcher);
 assert.equal(other.fromMemory,false);
 assert.equal(calls,8);
 t.cacheSet('2099-02-01',{status:'unavailable',trips:[],date:'2099-02-01'});
 assert.equal(t.cacheGet('2099-02-01'),null);
 t.cacheSet('2099-02-02',{status:'derived',trips:[],date:'2099-02-02'},Date.now()-t.DAY_CACHE_MS-5);
 assert.equal(t.cacheGet('2099-02-02'),null);
 assert.equal(t.SCHEDULE_CACHE_SECONDS,600);
 assert.equal(t.DAY_CACHE_MS,600000);
 t.clearDayCache();
});

test('班表回應請 CDN 快取 10 分鐘',()=>{
 const headers={};
 const res={setHeader(name,value){headers[name]=value;}};
 schedule.setScheduleCache(res);
 assert.match(headers['Cache-Control'],/s-maxage=600/);
 assert.match(headers['Cache-Control'],/stale-while-revalidate=300/);
 assert.equal(headers['CDN-Cache-Control'],headers['Cache-Control']);
 assert.equal(headers['Vercel-CDN-Cache-Control'],headers['Cache-Control']);
 assert.equal(schedule.scheduleCacheLabel([{fromMemory:true},{fromMemory:true}]),'memory');
 assert.equal(schedule.scheduleCacheLabel([{fromMemory:true},{fromMemory:false}]),'partial');
 assert.equal(schedule.scheduleCacheLabel([{fromMemory:false}]),'live');
});
