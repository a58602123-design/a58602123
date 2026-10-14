const CACHE='yunlin-elder-v5';
const ASSETS=['/','/index.html','/manifest.webmanifest','/icon.svg','/elder.css?v=5','/elder.js?v=5'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(event.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok&&ASSETS.some(p=>{let asset=new URL(p,location.origin);return asset.pathname===u.pathname&&asset.search===u.search;}))caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
  return response;
 }).catch(()=>caches.match(event.request)));
});
