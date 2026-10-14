const test=require('node:test');
const assert=require('node:assert/strict');
const {_test:{voiceSegments,tailoNumber,tailoTime,tailoSegments}}=require('../api/taigi');
const forward={dir:'home',hsr:'1307',hsrDep:'08:50',hsrArr:'10:16',bus1:'7102A',bus1Dep:'10:55',bus2:'7111',bus2Dep:'11:35',end:'12:20'};
const back={dir:'train',hsr:'818',hsrDep:'11:12',hsrArr:'12:50',bus1:'7111',bus1Dep:'07:47',bus2:'7102B',bus2Dep:'09:53',end:'12:50'};
test('去回程台語語音拆成三段短句，避免後半段音質不清',()=>{
 for(const q of [forward,back]){
  const parts=voiceSegments(q);
  assert.equal(parts.length,3);
  for(const p of parts){assert.ok(p.length>8 && p.length<=36,p);}
  assert.ok(parts[0].includes(q.dir==='home'?'南港':'南公館'));
  assert.ok(parts[2].includes(q.dir==='home'?'南公館':'南港'));
 }
});
test('每一段只會唸該階段班次，不重複整趟語音',()=>{
 const s=voiceSegments(forward);
 assert.ok(s[0].includes('一三零七'));
 assert.ok(s[1].includes('七一零二'));
 assert.ok(s[2].includes('七一一一'));
 assert.ok(!s[0].includes('七一一一'));
});
test('拒絕無效車次、方向、時間避免開放式免費台語API遭濫用',()=>{
 assert.equal(voiceSegments({...forward,hsr:'12345'}),null);
 assert.equal(voiceSegments({...forward,bus1:'500'}),null);
 assert.equal(voiceSegments({...forward,hsrDep:'99:30'}),null);
 assert.equal(voiceSegments({...forward,dir:'none'}),null);
});

test('台語時鐘固定唸法：十一點，不依賴標音網站',()=>{
 assert.equal(tailoNumber(11),'tsa̍p-it');
 assert.equal(tailoTime('11:00'),'tsa̍p-it tiám');
 assert.equal(tailoTime('11:35'),'tsa̍p-it tiám sann-tsa̍p-gōo hun');
 assert.equal(tailoTime('18:20'),'àm-sî la̍k tiám jī-tsa̍p hun');
 assert.equal(tailoTime('23:00'),'àm-sî tsa̍p-it tiám');
});
test('去回程三段台語都用台羅，不會誤讀國語數字',()=>{
 for(const trip of [forward,back]){
  const parts=tailoSegments(trip);
  assert.equal(parts.length,3);
  assert.ok(parts.every(text=>!/[\u4e00-\u9fff]/u.test(text)),parts.join('|'));
  assert.ok(parts.every(text=>text.includes('tiám')),parts.join('|'));
  assert.ok(parts.every(text=>text.includes('kong-tshia')||text.includes('ko-thih')));
 }
 assert.ok(tailoSegments(forward)[2].includes('tsa̍p-it tiám'),'虎尾11:35必須唸tsa̍p-it tiám');
 assert.equal(tailoSegments({...forward,dir:'nonsense'}),null);
});
