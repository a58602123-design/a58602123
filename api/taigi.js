/* Family-use Taiwanese Hokkien speech, optional third-party demonstrator.
 * Credit: ÌTHUÂN KHOKI (意傳科技) 媠聲；free demo is rate limited.
 * Do not use Mandarin TTS pretending to speak Taiwanese.
 * Input is whitelisted route/timing data, not an open free-form TTS relay.
 */
'use strict';
const {URLSearchParams}=require('node:url');
const DIGITS='零一二三四五六七八九';
const cache=new Map(),MAX_CACHE=18;
const validTime=s=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
const digits=s=>String(s).split('').map(c=>DIGITS[Number(c)]||c).join('');
function number(n){n=Number(n);if(n<10)return DIGITS[n];if(n<20)return '十'+(n===10?'':DIGITS[n-10]);if(n<100)return DIGITS[Math.floor(n/10)]+'十'+(n%10?DIGITS[n%10]:'');return digits(String(n));}
function sayTime(s){let [h,m]=s.split(':').map(Number);return number(h)+'點'+(m?number(m)+'分':'整');}
function sayBus(s){return digits(s.replace(/[AB]$/,''))+(s.endsWith('A')?' A':s.endsWith('B')?' B':'');}
function voiceText(q){
 const d=String(q.dir||''),hsr=String(q.hsr||''),b1=String(q.bus1||''),b2=String(q.bus2||'');
 const fields=[q.hsrDep,q.hsrArr,q.bus1Dep,q.bus2Dep,q.end];
 if(!['home','train'].includes(d)||!/^(\d{3,4})$/.test(hsr)||!fields.every(validTime))return null;
 if(d==='home' && !/^7102[AB]?$/.test(b1))return null;
 if(d==='train' && !/^7111A?$/.test(b1))return null;
 if(d==='home' && !/^7111A?$/.test(b2))return null;
 if(d==='train' && !/^7102[AB]?$|^7104$/.test(b2))return null;
 let str='';
 if(d==='home'){
  str='欲對南港去南公館。南港高鐵'+sayTime(q.hsrDep)+'坐'+digits(hsr)+'號高鐵。'+sayTime(q.hsrArr)+'到雲林。'
   +'雲林高鐵站'+sayTime(q.bus1Dep)+'坐'+sayBus(b1)+'號公車。虎尾'+sayTime(q.bus2Dep)+'換'+sayBus(b2)+'號。約'+sayTime(q.end)+'到南公館。';
 }else{
  str='欲對南公館去南港。南公館約'+sayTime(q.bus1Dep)+'坐'+sayBus(b1)+'號公車。'
   +'虎尾約'+sayTime(q.bus2Dep)+'換'+sayBus(b2)+'號。雲林高鐵站'+sayTime(q.hsrDep)+'坐'+digits(hsr)+'號高鐵。'+sayTime(q.end)+'到南港。';
 }
 return str;
}
// Make short, independent recordings: long TTS prompts can turn unintelligible near the end.
function voiceSegments(q){
 if(!voiceText(q))return null; // reuse strict whitelist for every route and time
 const d=String(q.dir);
 const hsr=digits(String(q.hsr)),first=sayBus(String(q.bus1)),second=sayBus(String(q.bus2));
 if(d==='home')return [
   '南港高鐵站，'+sayTime(q.hsrDep)+'，坐'+hsr+'號高鐵。',
   '到雲林高鐵站，'+sayTime(q.bus1Dep)+'，坐'+first+'號公車。',
   '虎尾，'+sayTime(q.bus2Dep)+'，換'+second+'號公車。約'+sayTime(q.end)+'到南公館。'
 ];
 return [
   '南公館，約'+sayTime(q.bus1Dep)+'，坐'+first+'號公車。',
   '到虎尾，約'+sayTime(q.bus2Dep)+'，轉'+second+'號公車。',
   '雲林高鐵站，'+sayTime(q.hsrDep)+'，坐'+hsr+'號高鐵。'+sayTime(q.end)+'到南港。'
 ];
}
function json(res,status,message,extra={}){
 res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify({ok:status===200,message,...extra}));
}
async function handler(req,res){
 if(req.method!=='GET')return json(res,405,'只支援GET');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(String((req.query||{}).check||'')==='health')return json(res,200,'台語音訊端點已啟用',{version:'2026-10-14.7'});
 const q=req.query||{},check=String(q.check||'');
 const segments=voiceSegments(q);
 if(check==='segments')return segments?json(res,200,'分段台語播報文字',{segments}):json(res,400,'車次資料格式不正確');
 const probe=check==='phonetic';
 const testing=check==='1'||probe;
 const partText=q.part===undefined?'':String(q.part);
 if(!testing&&partText&&!/^[012]$/.test(partText))return json(res,400,'語音段落只能是0、1或2');
 const text=testing?'逐家好，請坐車。':partText?segments?.[Number(partText)]:voiceText(q);
 if(!text)return json(res,400,'車次資料格式不正確');
 const key=testing?'check':JSON.stringify([q.dir,q.hsr,q.bus1,q.bus2,q.hsrDep,q.hsrArr,q.bus1Dep,q.bus2Dep,q.end,partText]);
 const hit=cache.get(key);
 if(hit&&!testing){res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800');return res.end(hit);}
 try{
   const transliterated=await fetch('https://hokbu.ithuan.tw/tau',{
     method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json','User-Agent':'Yunlin-family-pwa/1.0'},
     body:new URLSearchParams({taibun:text}),signal:AbortSignal.timeout(12000)
   });
   if(!transliterated.ok)return json(res,503,'台語標音服務暫時無法使用');
   const data=await transliterated.json();
   const kip=String(data.KIP||'').trim();
   if(!kip||kip.length>450)return json(res,503,'台語標音失敗，請改用國語備用');
   if(probe)return json(res,200,'台語標音服務可用',{kip});
   const audio=await fetch('https://hapsing.ithuan.tw/bangtsam?taibun='+encodeURIComponent(kip),{
     headers:{'User-Agent':'Yunlin-family-pwa/1.0','Accept':'audio/mpeg'},signal:AbortSignal.timeout(25000)
   });
   if(!audio.ok)return json(res,503,audio.status===500?'免費台語語音已達限流，請稍後再試':'台語語音服務暫時無法使用');
   const buffer=Buffer.from(await audio.arrayBuffer());
   const looksMp3=buffer.length>400&&(
      buffer.subarray(0,3).toString('ascii')==='ID3'||(buffer[0]===255 && (buffer[1]&224)===224)
   );
   if(!looksMp3||buffer.length>3*1024*1024)return json(res,503,'台語語音未成功產生，請改用國語');
   if(testing)return json(res,200,'免費台語語音合成可用',{kip,size:buffer.length,type:audio.headers.get('content-type'),provider:'意傳科技・媠聲展示版'});
   cache.set(key,buffer);if(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);
   res.statusCode=200;res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800');return res.end(buffer);
 }catch(err){return json(res,503,'台語語音連線逾時，請稍後再試或使用國語備用');}
}
module.exports=handler;module.exports._test={voiceText,voiceSegments,sayTime,number};
