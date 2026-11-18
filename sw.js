"use strict";
const CACHE="pae06-cp087-synth-assets-v1";
const BASE=new URL("./",self.registration.scope);
const FILES=["./","./index.html","./style.css","./app.js","./manifest.webmanifest","./icon-192.png","./icon-512.png","./fixtures/PAE06_QA_A_1_PAGE.pdf","./fixtures/PAE06_QA_B_2_PAGES.pdf","./assets/qa-a-page-1.webp","./assets/qa-b-page-1.webp","./assets/qa-b-page-2.webp"];
const ALLOWED=new Set(FILES.map(x=>new URL(x,BASE).href));
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith("pae06-cp083-synth-assets-")||k.startsWith("pae06-cp087-synth-assets-"))).map(k=>caches.delete(k)));
 await self.clients.claim();
})()));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==BASE.origin||!ALLOWED.has(u.href))return;e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request,{ignoreSearch:false});if(hit)return hit;try{return await fetch(e.request)}catch(err){if(u.pathname===BASE.pathname)return await c.match(new URL("index.html",BASE));throw err}}))});
