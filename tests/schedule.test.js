const test=require('node:test');const assert=require('node:assert/strict');const { _test:t}=require('../api/schedule');
test('日期及時間',()=>{assert.equal(t.validDate('2026-10-14'),true);assert.equal(t.validDate('2026-02-30'),false);assert.equal(t.nextDate('2026-10-14'),'2026-10-15');assert.equal(t.addMins('08:15',16),'08:31');});
test('每週六和每週一到五',()=>{assert.equal(t.canRun('週一～五行駛','2026-10-17'),false);assert.equal(t.canRun('每週六行駛','2026-10-17'),true);assert.equal(t.canRun('每週一、二、三、四、五、日行駛','2026-10-18'),true);assert.equal(t.canRun('每週一、二、三、四、五、日行駛','2026-10-17'),false);});
const segment=(route,branch,dir,rows,status='')=>`<div>【${route} - ${branch} ${dir}】<br>臺西客運 ${status}</div><table><tr><th>編號</th><th>虎尾</th><th>行駛期間</th><th>客運業者</th></tr>${rows.map(([num,dep,when])=>`<tr><td>${num}</td><td>${dep}</td><td>${when}</td><td>臺西客運</td></tr>`).join('')}</table>`;
test('官方 HTML 班表解析、7104A過濾、假日行駛',()=>{
 const html=segment('7104','0','往程',[[1,'0815','週一～五行駛'],[2,'1140','每日行駛']])+segment('7104','A','往程',[[1,'0720','週一～五行駛']])+segment('7111','0','往程',[[1,'1135','每週一、二、三、四、五、日行駛']])+segment('7111','A','往程',[[1,'1135','每週六行駛']]);
 const x=t.parseRoute(html,'7104','2026-10-14');assert.equal(x.length,2);assert.equal(x[0].dep,'08:15');assert.equal(x[0].arr,'08:31');
 assert.equal(t.parseRoute(html,'7111','2026-10-17')[0].route,'7111A');
 assert.equal(t.parseRoute(html,'7111','2026-10-18')[0].route,'7111');
});
test('被官方標為未營運的段落不能出現',()=>{
 let html=segment('7111','A','往程',[[1,'1135','每週六行駛']],'2026/10/17 未營運');assert.equal(t.parseRoute(html,'7111','2026-10-17').length,0);
});
test('7120 經虎尾到高鐵（往程）',()=>{assert.equal(t.projected('2026-10-14','7120','往程','07:50')[0].dep,'08:24');assert.equal(t.projected('2026-10-14','7120','返程','09:30').length,0);});
