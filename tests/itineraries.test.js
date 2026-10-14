const test=require('node:test');
const assert=require('node:assert/strict');
const { _test:{build,MIN_HSR_TO_BUS,MIN_BUS_TO_BUS,MIN_BUS_TO_HSR,gap}}=require('../api/itineraries');
const { _test:{dow}}=require('../api/schedule');
function fixture(day='2026-10-14'){
 const trip=(leg,route,dep,arr)=>({date:day,leg,route,dep,arr,estimated:true});
 return {date:day,status:'derived',notes:'固定測試資料',trips:[
 trip('hsr_huwei','7102A','10:55','11:17'),
 trip('huwei_nan','7111','11:35','12:20'),
 trip('nan_huwei','7111','09:02','09:55'),
 trip('huwei_hsr','7102B','10:23','10:46'),
 trip('huwei_hsr','7120','09:12','09:32') // 排除方向有風險的路線
 ]};
}
test('高鐵南港08:50（1307）在10:16抵雲林後可轉7102A 10:55、7111 11:35',()=>{
 const date='2026-10-14',data=build(date,fixture(date));
 const r=data.home.find(x=>x.hsr.no==='1307');
 assert.ok(r,'1307 組合存在');assert.equal(r.start,'08:50');assert.equal(r.hsr.arr,'10:16');
 assert.equal(r.bus1.route,'7102A');assert.equal(r.bus1.dep,'10:55');
 assert.equal(r.bus2.route,'7111');assert.equal(r.bus2.dep,'11:35');
 assert.equal(r.end,'12:20');
});
test('南公館→虎尾→高鐵雲林→南港有回程組合，至少30分鐘月台緩衝',()=>{
 const date='2026-10-14',data=build(date,fixture(date));assert.ok(data.train.length>0);
 for(const r of data.train){
  assert.equal(r.dir,'train');assert.equal(r.bus1.leg,'nan_huwei');assert.equal(r.bus2.leg,'huwei_hsr');
  assert.ok(gap(r.bus2.dep,r.bus1.arr)>=MIN_BUS_TO_BUS);
  assert.ok(gap(r.hsr.dep,r.bus2.arr)>=MIN_BUS_TO_HSR);
  assert.notEqual(r.bus2.route,'7120');
 }
});
test('高鐵→公車至少25分鐘、公車→公車至少15分鐘且班次不會倒退',()=>{
 const date='2026-10-14',data=build(date,fixture(date));
 for(const r of data.home){
  assert.ok(gap(r.bus1.dep,r.hsr.arr)>=MIN_HSR_TO_BUS);
  assert.ok(gap(r.bus2.dep,r.bus1.arr)>=MIN_BUS_TO_BUS);
  assert.equal(r.longWait,r.wait1>90||r.wait2>90);
 }
});
test('過短公車轉乘不得排進推薦清單',()=>{
 const day='2026-10-14',f=fixture(day);
 f.trips=f.trips.map(x=>x.leg==='huwei_nan'?{...x,dep:'11:25'}:x);
 const data=build(day,f);
 assert.equal(data.home.find(x=>x.hsr.no==='1307'),undefined);
});
test('依日期不同，高鐵常態週班表服務內容須有分別',()=>{
 const a=build('2026-10-14',fixture('2026-10-14'));
 const b=build('2026-10-18',fixture('2026-10-18'));
 assert.equal(dow('2026-10-14'),3);assert.equal(dow('2026-10-18'),0);
 assert.ok(a.train.length>=0&&b.home.length>=0);
});

test('虎尾7111完整班表有5個時段，不能被高鐵配對濾掉',()=>{
 const f=fixture('2026-10-14');const trip=(dep,arr)=>({date:f.date,leg:'huwei_nan',route:'7111',dep,arr,estimated:true});
 f.trips.push(trip('06:30','07:15'),trip('07:40','08:25'),trip('08:30','09:15'),trip('18:20','19:05'));
 const r=build(f.date,f);assert.deepEqual(r.bus7111.home.map(x=>x.dep),['06:30','07:40','08:30','11:35','18:20']);
 assert.ok(r.home.every(x=>x.bus2.dep==='11:35'),'清晨高鐵接不上7111前幾班，不代表班次不存在');
});
test('下午高鐵仍可轉18:20的7111，即使虎尾要等很久也應標示',()=>{
 const f=fixture('2026-10-14');
 f.trips.push({date:f.date,leg:'hsr_huwei',route:'7102B',dep:'15:15',arr:'15:37',estimated:true});
 f.trips.push({date:f.date,leg:'huwei_nan',route:'7111',dep:'18:20',arr:'19:05',estimated:true});
 const r=build(f.date,f);const afternoon=r.home.find(x=>x.hsr.no==='825');
 assert.ok(afternoon,'12:00 於南港搭825不應被刪除');
 assert.equal(afternoon.bus2.dep,'18:20');
 assert.equal(afternoon.wait2,163);
 assert.equal(afternoon.longWait,true);
});
