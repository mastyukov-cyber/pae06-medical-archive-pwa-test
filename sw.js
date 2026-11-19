"use strict";
/* PAE-06 CP08.8 TEST: atomic stage; activation requires natural lifecycle or one-client consent. */
const CACHE="pae06-cp0811-synth-assets-v1";
const VERSION="v0.8.11-test.1",BUILD_ID="20261119-03";
const OLD_CACHES=new Set(["pae06-cp0810-synth-assets-v1","pae06-cp089-synth-assets-v1","pae06-cp083-synth-assets-v1","pae06-cp087-synth-assets-v1","pae06-cp088-synth-assets-v1"]);
const BASE=new URL("./",self.registration.scope);
const FILES=["./","./index.html","./style.css","./app.js","./catalog.js","./mac-derived-adapter.mjs","./mac-preview.mjs","./mac-bridge.mjs","./mac-bridge-view.mjs","./qa/qa_public_key.json","./qa/signed_transfer.json","./manifest.webmanifest","./icon-192.png","./icon-512.png","./fixtures/PAE06_QA_A_1_PAGE.pdf","./fixtures/PAE06_QA_B_2_PAGES.pdf","./assets/qa-a-page-1.webp","./assets/qa-b-page-1.webp","./assets/qa-b-page-2.webp"];
const ALLOWED=new Set(FILES.map(x=>new URL(x,BASE).href));
const INDEX=new URL("./index.html",BASE);
self.addEventListener("install",e=>e.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{await cache.addAll(FILES)}
  catch(err){await caches.delete(CACHE);throw err}
  // Do not skipWaiting here: old clients keep a consistent bundle until release.
})()));
self.addEventListener("message",e=>{
  if(!e.data||e.data.type!=="PAE06_PWA_ACTIVATE_V1"||!e.ports||!e.ports[0])return;
  e.waitUntil((async()=>{
    const port=e.ports[0];
    try{
      if(e.data.expectedVersion!==VERSION||e.data.expectedBuildId!==BUILD_ID){
        port.postMessage({ok:false,reason:"WORKER_BUILD_MISMATCH"});return;
      }
      const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
      if(windows.length!==1){port.postMessage({ok:false,reason:"MULTIPLE_OR_NO_CLIENTS"});return}
      await self.skipWaiting();
      port.postMessage({ok:true,reason:"USER_CONSENT_SINGLE_CLIENT"});
    }catch(err){port.postMessage({ok:false,reason:"ACTIVATION_UNAVAILABLE"})}
  })());
});
self.addEventListener("activate",e=>e.waitUntil((async()=>{
  // Only our exact known earlier TEST caches; never wipe unrelated caches or IndexedDB.
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>OLD_CACHES.has(k)).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==BASE.origin)return;
  const navigation=e.request.mode==="navigate"&&(u.pathname===BASE.pathname||u.pathname===INDEX.pathname);
  if(!navigation&&!ALLOWED.has(u.href))return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const request=navigation?INDEX:e.request;
    const hit=await c.match(request);
    if(hit)return hit;
    try{return await fetch(e.request)}catch(err){
      if(navigation){const fallback=await c.match(INDEX);if(fallback)return fallback}
      throw err;
    }
  })());
});
