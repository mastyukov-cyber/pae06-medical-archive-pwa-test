"use strict";
/* PAE-06 CP08.2: synthetic-only iPhone preview. Refuses ALL files except two SHA-pinned fixtures.
   Reuses CP06.8 arraybuffer-v1 storage + original SHA identity principles and CP06.9 fail-closed quarantine.
   Preview images are pre-rendered from those frozen fixtures; THIS IS NOT a generic PDF.js viewer. */
const DB_NAME="pae06_cp082_synthetic_only",DB_VERSION=1,STORE="documents";
const FIXTURES=Object.freeze({
  A:{id:"qa-a",title:"QA-A · Учебный документ",file:"fixtures/PAE06_QA_A_1_PAGE.pdf",sha256:"4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153",pages:1,previews:["assets/qa-a-page-1.webp"]},
  B:{id:"qa-b",title:"QA-B · Двухстраничный документ",file:"fixtures/PAE06_QA_B_2_PAGES.pdf",sha256:"3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982",pages:2,previews:["assets/qa-b-page-1.webp","assets/qa-b-page-2.webp"]}
});
const $=id=>document.getElementById(id);
let validRows=[],activeId=null,activePage=1,busy=false,renderSeq=0,openBlob=null;
const good=(msg,error=false)=>{$("status").textContent=msg;$("status").classList.toggle("error",error)};
function releaseBlob(){if(openBlob){URL.revokeObjectURL(openBlob);openBlob=null}}
function dbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:"id"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("IndexedDB"));req.onblocked=()=>reject(new Error("База занята другой вкладкой"))})}
async function allRecords(){const db=await dbOpen();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error("Ошибка чтения"))})}finally{db.close()}}
async function addRecord(rec){const db=await dbOpen();try{await new Promise((resolve,reject)=>{const t=db.transaction(STORE,"readwrite");t.objectStore(STORE).add(rec);t.oncomplete=resolve;t.onabort=()=>reject(t.error||new Error("Отказ транзакции"));t.onerror=()=>reject(t.error||new Error("Ошибка транзакции"))})}finally{db.close()}}
async function sha256(bytes){const h=await crypto.subtle.digest("SHA-256",bytes.slice(0));return Array.from(new Uint8Array(h),x=>x.toString(16).padStart(2,"0")).join("")}
const lookup=r=>Object.values(FIXTURES).find(f=>f.id===r?.id&&f.sha256===r?.sha256);
async function classify(rec){const f=lookup(rec);if(!f)return {ok:false,reason:"UNKNOWN_OR_MISMATCHED_ID_SHA"};if(rec.sourceEncoding!=="arraybuffer-v1"||!(rec.sourceBytes instanceof ArrayBuffer))return {ok:false,reason:"QUARANTINE_LEGACY_OR_VERSIONED_MISSING_BYTES"};if(rec.sourceBytes.byteLength<10||rec.sourceBytes.byteLength>1024*1024)return {ok:false,reason:"INVALID_SIZE"};if(await sha256(rec.sourceBytes)!==f.sha256)return {ok:false,reason:"ORIGINAL_SHA_MISMATCH"};return {ok:true,fixture:f}}
async function refresh(id=activeId){
 const rows=await allRecords(),checked=await Promise.all(rows.map(classify));
 validRows=rows.filter((_,i)=>checked[i].ok);
 const rejected=rows.length-validRows.length;
 $("count").textContent=validRows.length;
 $("items").replaceChildren();
 const catalog=window.PAE06Catalog;
 if(!catalog)throw new Error("Модуль каталога не загружен: документы не изменены");
 const entries=catalog.prepare(validRows,lookup,$("search").value,$("sortMode").value);
 $("matchCount").textContent=`Найдено: ${entries.length} из ${validRows.length}`;
 for(const entry of entries){
  const r=entry.row,f=entry.fixture,b=document.createElement("button");
  b.type="button";b.className="item"+(r.id===id?" active":"");
  const title=document.createElement("strong"),detail=document.createElement("span"),added=document.createElement("span");
  title.textContent=f.title;
  detail.textContent=f.pages+" стр. · проверен SHA-256 · только учебный PDF";
  added.textContent=catalog.addedLabel(r);
  b.append(title,detail,added);
  b.onclick=()=>openDetail(r.id,1);
  $("items").append(b);
 }
 if(!entries.length){const empty=document.createElement("div");empty.className="small";empty.textContent="Учебных документов по запросу нет";$("items").append(empty)}
 const timeline=$("timelineList");timeline.replaceChildren();
 // Timeline is always chronological, independently of list sort order.
 for(const entry of catalog.prepare(validRows,lookup,$("search").value,"newest")){
  const b=document.createElement("button");b.type="button";b.className="timelineevent";
  const title=document.createElement("strong"),desc=document.createElement("span");
  title.textContent=entry.fixture.title;
  desc.textContent=catalog.addedLabel(entry.row)+" · источник: учебный PDF, пациент не указан";
  b.append(title,desc);b.onclick=()=>openDetail(entry.row.id,1);
  timeline.append(b);
 }
 if(!timeline.children.length){const p=document.createElement("p");p.className="small";p.textContent="Событий добавления нет";timeline.append(p)}
 if(rejected)good("Карантин: "+rejected+" запись(ей) не прошли проверку. Не отображаются.",true);
 if(id&&entries.some(entry=>entry.row.id===id))await openDetail(id,activePage);
 else if(entries.length)await openDetail(entries[0].row.id,1);
 else {activeId=null;$("detail").replaceChildren();const e=document.createElement("div");e.className="empty";e.textContent=validRows.length?"По вашему запросу документы не найдены.":"Добавьте QA-A или QA-B, чтобы проверить просмотр страниц.";$("detail").append(e)}
}

function label(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;e.textContent=text;return e}
async function openDetail(id,page){const seq=++renderSeq;const rec=validRows.find(r=>r.id===id);if(!rec)return;const state=await classify(rec);if(seq!==renderSeq)return;if(!state.ok){good("Документ помещён в карантин: "+state.reason,true);await refresh();return}const f=state.fixture;activeId=id;activePage=Math.max(1,Math.min(page,f.pages));$("items").querySelectorAll(".item").forEach((b,i)=>b.classList.toggle("active",b.querySelector("strong")?.textContent===f.title));const wrap=$("detail");wrap.replaceChildren();const head=label("div","detailhead",""),info=document.createElement("div"),h=label("h3","",f.title),sm=label("p","","Проверенные исходные PDF-байты · только QA");info.append(h,sm);head.append(info);const open=label("button","secondary","Оригинал PDF");open.onclick=()=>{releaseBlob();openBlob=URL.createObjectURL(new Blob([rec.sourceBytes.slice(0)],{type:"application/pdf"}));const a=document.createElement("a");a.href=openBlob;a.target="_blank";a.rel="noopener noreferrer";a.download=f.id+".pdf";document.body.append(a);a.click();a.remove()};head.append(open);
const nav=label("div","pager",""),prev=label("button","","← Назад"),at=label("span","",`Страница ${activePage} из ${f.pages}`),next=label("button","","Далее →");prev.disabled=activePage===1;next.disabled=activePage===f.pages;prev.onclick=()=>openDetail(id,activePage-1);next.onclick=()=>openDetail(id,activePage+1);nav.append(prev,at,next);
const viewer=label("div","preview",""),img=document.createElement("img");img.src=f.previews[activePage-1];img.alt=`${f.title}, страница ${activePage}`;img.loading="lazy";viewer.append(img);
const meta=label("div","meta",""),left=label("div","","Формат"),right=label("div","","Контроль оригинала");left.append(label("strong","","ArrayBuffer · IndexedDB"));right.append(label("strong","",f.sha256));meta.append(left,right);const provenance=label("p","catalogprovenance","Источник: локально добавленный учебный PDF. Связь с пациентом и дата исследования НЕ ПОДТВЕРЖДЕНЫ. "+window.PAE06Catalog.addedLabel(rec));wrap.append(head,nav,viewer,meta,provenance);
}
async function acceptBytes(bytes){if(busy)return;busy=true;$("addA").disabled=$("addB").disabled=true;try{if(!(bytes instanceof ArrayBuffer)||bytes.byteLength>1024*1024||bytes.byteLength<10)throw new Error("Недопустимый размер файла");const u=new Uint8Array(bytes);if(String.fromCharCode(...u.slice(0,5))!=="%PDF-")throw new Error("Это не PDF");const hash=await sha256(bytes),f=Object.values(FIXTURES).find(x=>x.sha256===hash);if(!f)throw new Error("Разрешены только учебные PDF QA-A и QA-B. Любые реальные документы отклоняются.");const exists=(await allRecords()).some(x=>x.id===f.id);if(exists){good("Учебный "+f.id.toUpperCase()+" уже сохранён. Дубликат отклонён.");await refresh(f.id);return}const now=new Date().toISOString();await addRecord({id:f.id,title:f.title,sha256:hash,sourceEncoding:"arraybuffer-v1",sourceBytes:bytes.slice(0),syntheticOnly:true,createdAt:now});await refresh(f.id);good(f.title+" сохранён в локальном хранилище. Оригинал SHA-256 проверен.")}catch(e){good("Ошибка: "+e.message,true)}finally{busy=false;$("addA").disabled=$("addB").disabled=false;$("file").value=""}}
async function addFixture(key){const f=FIXTURES[key];try{const r=await fetch(f.file,{cache:"default"});if(!r.ok)throw new Error("Не удалось открыть учебный PDF");await acceptBytes(await r.arrayBuffer())}catch(e){good("Не удалось открыть учебный PDF: "+e.message,true)}}
function base64(bytes){const a=new Uint8Array(bytes);let b="";for(let i=0;i<a.length;i+=4096)b+=String.fromCharCode(...a.slice(i,i+4096));return btoa(b)}
async function exportBackup(){try{const docs=[];for(const r of await allRecords()){const state=await classify(r);if(!state.ok)throw new Error("Целостность изменилась");docs.push({id:r.id,sha256:r.sha256,sourceEncoding:r.sourceEncoding,bytesBase64:base64(r.sourceBytes),syntheticOnly:true})}const data={format:"PAE06-CP082-SYNTHETIC-EXPORT-ONLY",version:1,clinicalAuthority:false,docs};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="PAE06_CP082_SYNTHETIC_EXPORT.json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);good("Учебная копия сформирована. Проверьте загрузки iPhone. Восстановление доступно на отдельном TEST-экране.")}catch(e){good("Экспорт не выполнен: "+e.message,true)}}

/* CP08.7: identifiers reflect the LOADED JS, not the server's newest release. */
const RUNTIME_BUILD=Object.freeze({version:"v0.8.15-test.0",checkpoint:"CP08.15",buildId:"20261121-restore-candidate-01",channel:"TEST"});
let versionCheckBusy=false,lastVersionCheck=0;
function paintRuntimeBuild(){
 $("versionText").textContent=`TEST ${RUNTIME_BUILD.version} · ${RUNTIME_BUILD.checkpoint}`;
 $("buildText").textContent=`Сборка ${RUNTIME_BUILD.buildId} · фактически загруженный код`;
 if(document.documentElement.dataset.pwaBuild!==RUNTIME_BUILD.buildId){
  $("versionState").textContent="ВНИМАНИЕ: HTML и JS разных сборок. Не оценивайте эту версию.";
  $("versionState").dataset.state="mismatch";
  return false;
 }
 return true;
}
const latestFields=["app","channel","version","checkpoint","buildId","syntheticOnly"];
function isReleaseMetadata(value){
 return value&&typeof value==="object"&&!Array.isArray(value)&&
  Object.keys(value).length===latestFields.length&&latestFields.every(k=>Object.prototype.hasOwnProperty.call(value,k))&&
  value.app==="PAE-06 Medical Archive PWA"&&value.channel==="TEST"&&value.syntheticOnly===true&&
  typeof value.version==="string"&&/^v[0-9]+\.[0-9]+\.[0-9]+-test\.[0-9]+$/.test(value.version)&&
  typeof value.checkpoint==="string"&&/^CP[0-9]{2}\.[0-9]+$/.test(value.checkpoint)&&
  typeof value.buildId==="string"&&/^[0-9]{8}-[0-9]{2}$/.test(value.buildId);
}
async function checkLatestBuild(){
 if(versionCheckBusy)return;
 const state=$("versionState"),btn=$("checkVersion");
 if(document.documentElement.dataset.pwaBuild!==RUNTIME_BUILD.buildId){
  state.textContent="HTML и JS от разных сборок. Нужна повторная загрузка приложения.";state.dataset.state="mismatch";return;
 }
 if(!navigator.onLine){expectedUpdate=null;hasDifferentServerRelease=false;$("applyUpdate").hidden=true;state.textContent="Офлайн: запущена локальная сборка, актуальность не проверена";state.dataset.state="offline";return;}
 versionCheckBusy=true;btn.disabled=true;
 state.textContent="Сверяю версию с TEST-сайтом…";
 try{
  // release.json is deliberately excluded from SW precache. Force a fresh network request.
  const url=new URL("./release.json",location.href);
  url.searchParams.set("check",String(Date.now()));
  const response=await fetch(url.href,{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const metadata=await response.json();
  if(!isReleaseMetadata(metadata))throw new Error("Неверные данные о сборке");
  const equal=metadata.version===RUNTIME_BUILD.version&&metadata.checkpoint===RUNTIME_BUILD.checkpoint&&metadata.buildId===RUNTIME_BUILD.buildId;
  state.textContent=equal?"Версия совпадает с TEST-сервером":"Есть другая версия на сервере: "+metadata.version+" · "+metadata.buildId+". Перезапустите PWA без удаления данных.";
  state.dataset.state=equal?"current":"newer-or-different";
  if(equal){$("applyUpdate").hidden=true;hasDifferentServerRelease=false;expectedUpdate=null}
  else{hasDifferentServerRelease=true;expectedUpdate={version:metadata.version,buildId:metadata.buildId};void stageNewUpdate()}
  lastVersionCheck=Date.now();
 }catch(err){
  expectedUpdate=null;hasDifferentServerRelease=false;$("applyUpdate").hidden=true;
  state.textContent="Не удалось сверить с сервером. Показан номер локальной сборки.";
  state.dataset.state="unverified";
 }finally{versionCheckBusy=false;btn.disabled=false;}
}

/* CP08.10: only prepare a replacement after validated same-origin release metadata.
   No auto-activation of waiting workers, no IndexedDB change or global caches.clear. */
let hasDifferentServerRelease=false;
let expectedUpdate=null;
let trackedRegistration=null;
let applyingUpdate=false;
function markWaiting(reg){
 if(!hasDifferentServerRelease||!reg||!reg.waiting)return;
 $("applyUpdate").hidden=false;
 $("versionState").textContent="Обновление загружено. Примените его после закрытия других вкладок PWA.";
 $("versionState").dataset.state="newer-or-different";
}
function watchWorker(reg){
 trackedRegistration=reg;
 reg.addEventListener("updatefound",()=>{
  const installing=reg.installing;
  if(installing)installing.addEventListener("statechange",()=>{
   if(installing.state==="installed")markWaiting(reg);
  });
 });
 markWaiting(reg);
}
async function stageNewUpdate(){
 if(!("serviceWorker" in navigator)||location.protocol!=="https:")return;
 try{
  const reg=trackedRegistration||await navigator.serviceWorker.getRegistration("./");
  if(!reg)return;
  if(!trackedRegistration)watchWorker(reg);
  await reg.update();
  markWaiting(reg);
 }catch(err){
  $("versionState").textContent="Обновление на сервере найдено, но загрузка пока не удалась. Старая версия продолжает работать.";
  $("versionState").dataset.state="unverified";
 }
}
async function applyPendingUpdate(){
 if(applyingUpdate||!hasDifferentServerRelease||!expectedUpdate)return;
 const reg=trackedRegistration||await navigator.serviceWorker.getRegistration("./");
 if(!reg||!reg.waiting){$("versionState").textContent="Новая версия ещё не подготовлена. Проверьте обновления снова.";return}
 applyingUpdate=true;$("applyUpdate").disabled=true;
 const state=$("versionState");state.textContent="Применяю проверенную сборку…";
 let changed=null;
 try{
  if(typeof MessageChannel!=="function")throw new Error("MESSAGE_CHANNEL_UNAVAILABLE");
  const waiting=reg.waiting;
  // Capture the old controller and install listener BEFORE the worker may activate.
  const priorController=navigator.serviceWorker.controller;
  let completed=false;
  changed=()=>{if(completed)return;completed=true;location.reload()};
  navigator.serviceWorker.addEventListener("controllerchange",changed,{once:true});
  const msg=await new Promise((resolve,reject)=>{
   const ch=new MessageChannel();
   const timer=setTimeout(()=>{ch.port1.close();reject(new Error("ACTIVATION_TIMEOUT"))},5000);
   ch.port1.onmessage=e=>{clearTimeout(timer);ch.port1.close();resolve(e.data)};
   waiting.postMessage({type:"PAE06_PWA_ACTIVATE_V1",expectedVersion:expectedUpdate.version,expectedBuildId:expectedUpdate.buildId},[ch.port2]);
  });
  if(!msg||!msg.ok){
   navigator.serviceWorker.removeEventListener("controllerchange",changed);
   state.textContent=msg?.reason==="MULTIPLE_OR_NO_CLIENTS"?
    "Откройте только одну вкладку PWA и повторите обновление.":
    "Активация не разрешена. Текущая версия сохранена.";
   state.dataset.state="unverified";return;
  }
  state.textContent="Обновление принято. При смене Service Worker страница обновится.";
  state.dataset.state="newer-or-different";
  if(navigator.serviceWorker.controller!==priorController)changed();
 }catch(err){
   // CP08.13: a rejected/expired activation must not leave a reload trigger behind.
   if(changed)navigator.serviceWorker.removeEventListener("controllerchange",changed);
   state.textContent="Обновление пока не применилось. Рабочая версия сохранена.";
   state.dataset.state="unverified"
  }
 finally{applyingUpdate=false;$("applyUpdate").disabled=false}
}

function updateNetwork(){$("network").textContent=navigator.onLine?"Локально · онлайн":"Локально · офлайн"}
async function init(){
 const consistent=paintRuntimeBuild();
 $("checkVersion").onclick=checkLatestBuild;
 $("applyUpdate").onclick=applyPendingUpdate;
 if(!consistent){
  for(const id of ["addA","addB","search","export","file"])$(id).disabled=true;
  good("HTML и JavaScript разных сборок; загрузка документов заблокирована. Закройте PWA и откройте заново.",true);
  return;
 }
 updateNetwork();window.addEventListener("online",()=>{updateNetwork();void checkLatestBuild()});window.addEventListener("focus",()=>{if(Date.now()-lastVersionCheck>60000)void checkLatestBuild()});window.addEventListener("offline",updateNetwork);$("addA").onclick=()=>addFixture("A");$("addB").onclick=()=>addFixture("B");$("file").onchange=async()=>{const f=$("file").files[0];if(f)await acceptBytes(await f.arrayBuffer())};$("search").oninput=()=>refresh(activeId);$("sortMode").onchange=()=>refresh(activeId);$("export").onclick=exportBackup;try{await refresh();good("TEST готов: храним только QA-A/QA-B; медицинские данные не принимаются.")}catch(e){good("IndexedDB недоступна: "+e.message,true)}if("serviceWorker" in navigator&&location.protocol==="https:"){try{const reg=await navigator.serviceWorker.register("./sw.js",{scope:"./"});watchWorker(reg);await navigator.serviceWorker.ready;$("offline").textContent="Кэш установлен; офлайн требует проверки на устройстве"}catch(e){$("offline").textContent="Сервисный работник не запущен: "+e.message}}else{$("offline").textContent="Офлайн-кэш требует HTTPS и Safari"}void checkLatestBuild()}
init();
