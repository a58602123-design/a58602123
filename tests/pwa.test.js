'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const root=path.join(__dirname,'..');

function pngSize(file){
 const buf=fs.readFileSync(path.join(root,file));
 assert.equal(buf.toString('ascii',1,4),'PNG');
 const color=buf[8+8+9];
 return {w:buf.readUInt32BE(16),h:buf.readUInt32BE(20),color,bytes:buf.length};
}

test('主畫面圖示是實體 PNG，HTML 不再內嵌 base64',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 assert.doesNotMatch(html,/data:image\/png;base64/);
 assert.match(html,/apple-touch-icon\.png/);
 assert.match(html,/elder\.css\?v=14/);
 assert.match(html,/elder\.js\?v=14/);
 assert.match(html,/id="install"/);
 assert.match(html,/id="share"/);
 assert.match(html,/台語慢慢聽|國語備用/);
 const icon=pngSize('apple-touch-icon.png');
 const icon192=pngSize('icon-192.png');
 const icon512=pngSize('icon-512.png');
 assert.deepEqual([icon.w,icon.h],[180,180]);
 assert.deepEqual([icon192.w,icon192.h],[192,192]);
 assert.deepEqual([icon512.w,icon512.h],[512,512]);
 assert.equal(icon.color,2,'iOS 圖示使用不透明 RGB，避免透明角被填黑');
 const srcs=manifest.icons.map(x=>x.src+' '+x.sizes+' '+x.type);
 assert.ok(srcs.some(x=>x.includes('/apple-touch-icon.png 180x180 image/png')));
 assert.ok(srcs.some(x=>x.includes('/icon-192.png 192x192 image/png')));
 assert.ok(srcs.some(x=>x.includes('/icon-512.png 512x512 image/png')));
 assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
 assert.doesNotMatch(sw,/ASSETS=\[[^\]]*\/api\//);
 assert.match(sw,/yunlin-elder-v14/);
 assert.match(sw,/elder\.js\?v=14/);
 const css=vercel.headers.find(h=>h.source==='/elder.css');
 const js=vercel.headers.find(h=>h.source==='/elder.js');
 const page=vercel.headers.find(h=>h.source==='/');
 assert.match(css.headers[0].value,/max-age=31536000/);
 assert.match(js.headers[0].value,/max-age=31536000/);
 assert.match(page.headers[0].value,/max-age=0/);
});

test('圖示四角是海軍藍實底',()=>{
 const buf=fs.readFileSync(path.join(root,'icon-192.png'));
 let p=8,w,h,color,idats=[];
 while(p<buf.length){
  const len=buf.readUInt32BE(p),type=buf.toString('ascii',p+4,p+8),data=buf.subarray(p+8,p+8+len);
  if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);color=data[9];}
  if(type==='IDAT')idats.push(data);
  if(type==='IEND')break;
  p+=12+len;
 }
 assert.equal(color,2);
 const bpp=3,raw=zlib.inflateSync(Buffer.concat(idats)),stride=w*bpp,out=Buffer.alloc(h*stride);
 const paeth=(a,b,c)=>{const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);if(pa<=pb&&pa<=pc)return a;if(pb<=pc)return b;return c;};
 for(let y=0;y<h;y++){
  const filter=raw[y*(stride+1)],src=y*(stride+1)+1,prev=y?out.subarray((y-1)*stride,y*stride):null,dest=out.subarray(y*stride,(y+1)*stride);
  for(let i=0;i<stride;i++){
   const x=raw[src+i],a=i>=bpp?dest[i-bpp]:0,b=prev?prev[i]:0,c=prev&&i>=bpp?prev[i-bpp]:0;
   let v=x;
   if(filter===1)v=x+a;else if(filter===2)v=x+b;else if(filter===3)v=x+Math.floor((a+b)/2);else if(filter===4)v=x+paeth(a,b,c);
   dest[i]=v&255;
  }
 }
 assert.deepEqual(Array.from(out.subarray(0,3)),[23,62,114]);
});
