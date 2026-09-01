const CACHE='luauforge-v5';
const ASSETS=[
  './','./index.html','./manifest.json',
  './css/variables.css','./css/base.css','./css/components.css','./css/responsive.css',
  './js/app.js','./js/router.js','./js/storage.js','./js/ui.js',
  './js/tools/registry.js','./js/tools/snippets-data.js','./js/tools/loadstring.js','./js/tools/formatter.js','./js/tools/minifier.js','./js/tools/encoders.js','./js/tools/generators.js','./js/tools/inspector.js','./js/tools/snippets.js','./js/tools/pastefy.js','./js/tools/obfuscator.js',
  './assets/logo.svg'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=> Promise.all(keys.filter(k=>k!==CACHE).map(k=> caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  e.respondWith(
    caches.match(req).then(cached=> cached || fetch(req).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=> c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(()=> cached))
  );
});
