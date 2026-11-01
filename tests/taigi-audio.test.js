'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const handler=require('../api/taigi');

function mockRes(){
 return {statusCode:0,headers:{},body:null,setHeader(name,value){this.headers[name.toLowerCase()]=value;},end(buf){this.body=buf===undefined?Buffer.alloc(0):Buffer.from(buf);}};
}
const trip={dir:'home',hsr:'1307',hsrDep:'08:50',hsrArr:'10:16',bus1:'7102A',bus1Dep:'10:55',bus2:'7111',bus2Dep:'11:35',end:'12:20'};

test('台語音檔支援 iPhone 的 Range 探測，壞檔改走國語提示',async()=>{
 const original=global.fetch;
 let calls=0;
 const mp3=Buffer.alloc(500);mp3.write('ID3');
 try{
  global.fetch=async()=>{calls++;return {ok:false,status:500,headers:{get:()=>null},arrayBuffer:async()=>{throw Error('no body');}};};
  const limited=mockRes();
  await handler({method:'GET',query:{...trip,part:'0'},headers:{}},limited);
  assert.equal(limited.statusCode,503);
  assert.match(limited.body.toString(),/限流/);
  global.fetch=async()=>{calls++;return {ok:true,status:200,headers:{get:()=>'audio/mpeg'},arrayBuffer:async()=>Uint8Array.from(Buffer.alloc(450,65)).buffer};};
  const bad=mockRes();
  await handler({method:'GET',query:{...trip,part:'1'},headers:{}},bad);
  assert.equal(bad.statusCode,503);
  assert.match(bad.body.toString(),/國語/);
  const before=calls;
  global.fetch=async()=>{calls++;return {ok:true,status:200,headers:{get:()=>'audio/mpeg'},arrayBuffer:async()=>Uint8Array.from(mp3).buffer};};
  const full=mockRes();
  await handler({method:'GET',query:{check:'elevenAudio'},headers:{}},full);
  assert.equal(full.statusCode,200);
  assert.equal(full.headers['content-type'],'audio/mpeg');
  assert.equal(full.headers['accept-ranges'],'bytes');
  assert.equal(full.body.length,500);
  assert.equal(full.body.subarray(0,3).toString(),'ID3');
  const probe=mockRes();
  await handler({method:'GET',query:{check:'elevenAudio'},headers:{range:'bytes=0-1'}},probe);
  assert.equal(probe.statusCode,206);
  assert.equal(probe.body.length,2);
  assert.equal(probe.headers['content-range'],'bytes 0-1/500');
  assert.equal(probe.headers['cache-control'],'private, no-store');
  assert.equal(probe.body.toString(),'ID');
  assert.equal(calls,before+1,'分段請求要重用已合成的音檔');
  const missing=mockRes();
  await handler({method:'GET',query:{check:'elevenAudio'},headers:{range:'bytes=900-900'}},missing);
  assert.equal(missing.statusCode,416);
  assert.match(missing.headers['content-range'],/bytes \*\/500/);
 }finally{global.fetch=original;}
});

test('台語按鈕等音檔開始後才放慢，國語備用仍在',()=>{
 const js=fs.readFileSync(path.join(__dirname,'..','elder.js'),'utf8');
 const fn=js.slice(js.indexOf('function playTai'),js.indexOf('function play('));
 const step=fn.slice(fn.indexOf('function step'),fn.indexOf("sound.addEventListener('playing'"));
 assert.match(step,/playbackRate=1/);
 assert.doesNotMatch(step,/playbackRate=\.85/);
 assert.match(fn,/addEventListener\('playing',\(\)=>\{slowDown\(\)/);
 assert.match(fn,/國語備用/);
 assert.match(step,/volume=1/);
 assert.match(fn,/gain\.value=2/);
 const slow=fn.slice(fn.indexOf('function slowDown'),fn.indexOf('function step'));
 assert.match(slow,/volume=1/);
 assert.match(slow,/gain\.value=2/);
 assert.match(js,/msg\.volume=1/);
 assert.match(fn,/error\.code/);
 assert.match(js,/function play\(i,lang\)/);
 assert.match(js,/zh-TW/);
});
