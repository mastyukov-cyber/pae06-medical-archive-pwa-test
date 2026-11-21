/* PAE-06 CP08.17-AUTO: isolated Linux WebKit persistent IndexedDB and SW offline.
   Synthetic QA-A/QA-B only. No Chromium, real records, network, or retries. */
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {webkit} from 'playwright';

const DIR=dirname(fileURLToPath(import.meta.url));
const ROOT=join(DIR,'..'),RUN=join(DIR,'.run');
const ORIGIN='http://127.0.0.1:8768';
const TEST_SHA='7b7795f64e24432bc14e169cc28123a80acfd44b';
const PDF={
 'qa-a':{path:'fixtures/PAE06_QA_A_1_PAGE.pdf',sha:'4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153'},
 'qa-b':{path:'fixtures/PAE06_QA_B_2_PAGES.pdf',sha:'3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982'}
};
function check(ok,code){if(!ok)throw Error(code);}
async function verifySource(){
 const pins=[
  ['qa-hub.mjs','3324dcaea29332c83e329346be66cf16db85b0d1'],
  ['../sw.js','e6bdb9ed12eb5da3037cd9ef7f083d09a69b9c51'],
  ['../app.js','6065e80353734648d211b31582ec1462d264e046'],
  ['../src/test-idb-gate.mjs','7522a67cde97446b220cd06ccaa7c6fc420faf60'],
  ['../tests/fixtures/synthetic_export.json','ff433fe734cc0ae364f0346f4b1a322d3a46d45d']
 ];
 for(const [rel,sha] of pins){
  const b=await readFile(join(DIR,rel));
  const gitsha=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
  check(gitsha===sha,'SOURCE_SHA_DRIFT '+rel);
 }
 for(const [id,p] of Object.entries(PDF)){
  const b=await readFile(join(ROOT,p.path));
  check(b.subarray(0,5).toString('ascii')==='%PDF-'&&
    createHash('sha256').update(b).digest('hex')===p.sha,'PDF_SHA_MISMATCH '+id);
 }
 const rel=JSON.parse(await readFile(join(ROOT,'release.json'),'utf8'));
 check(rel.channel==='TEST'&&rel.syntheticOnly===true&&rel.version==='v0.8.15-test.0'&&
   rel.buildId==='20261121-restore-candidate-01','VERSION_DRIFT');
 const data=JSON.parse(await readFile(join(ROOT,'tests/fixtures/synthetic_export.json'),'utf8'));
 check(data.clinicalAuthority===false&&data.docs?.length===2&&
   data.docs.every(d=>PDF[d.id]&&d.syntheticOnly===true&&d.sha256===PDF[d.id].sha),
   'NON_SYNTHETIC_BACKUP');
 return {sourceSha:TEST_SHA,gitPins:pins.length,pdfSha256Verified:2};
}
async function startServer(){
 const p=spawn(process.execPath,['qa-hub.mjs','serve'],{cwd:DIR,stdio:['ignore','pipe','pipe']});
 return new Promise((resolve,reject)=>{
  let done=false,out='',err='';
  const timer=setTimeout(()=>finish(Error('SERVER_READY_TIMEOUT')),20000);
  function finish(e){
   if(done)return;done=true;clearTimeout(timer);
   if(e){p.kill('SIGTERM');reject(e);}else resolve(p);
  }
  p.stdout.on('data',b=>{
   out+=String(b);
   if(out.includes('"status":"LOCAL_ONLY"')&&out.includes('"port":8768'))finish();
   else if(out.length>4096)finish(Error('SERVER_UNEXPECTED_OUTPUT'));
  });
  p.stderr.on('data',b=>{err=(err+String(b)).slice(-300);});
  p.once('error',e=>finish(e));
  p.once('exit',code=>finish(Error('SERVER_EXIT_'+code+' '+err)));
 });
}
async function stopServer(p){
 if(!p||p.exitCode!==null)return;
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{p.kill('SIGKILL');reject(Error('SERVER_STOP_TIMEOUT'));},7000);
  p.once('exit',()=>{clearTimeout(timer);resolve();});
  p.kill('SIGTERM');
 });
}
async function snapshot(page){
 return page.evaluate(async()=>{
  const rec=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('pae06_cp082_synthetic_only',1);
   req.onerror=()=>reject(Error('DB_OPEN_FAILED'));
   req.onblocked=()=>reject(Error('DB_BLOCKED'));
   req.onupgradeneeded=()=>{try{req.transaction.abort()}catch{}reject(Error('DB_MISSING'));};
   req.onsuccess=()=>{
    const db=req.result;
    try{
     if(db.version!==1||db.objectStoreNames.length!==1||
        !db.objectStoreNames.contains('documents'))throw Error('DB_SCHEMA');
     const tx=db.transaction('documents','readonly'),store=tx.objectStore('documents');
     if(store.keyPath!=='id'||store.autoIncrement||store.indexNames.length!==0)
       throw Error('DB_STORE_SCHEMA');
     let rows=null;
     const get=store.getAll();
     get.onsuccess=()=>{rows=get.result;};
     get.onerror=()=>reject(Error('DB_READ_FAIL'));
     tx.oncomplete=()=>{db.close();resolve(rows);};
     tx.onabort=()=>{db.close();reject(Error('DB_ABORT'));};
    }catch(e){db.close();reject(e);}
   };
  });
  const rows=await Promise.all(rec.map(async x=>{
   if(!(x.sourceBytes instanceof ArrayBuffer))throw Error('NO_ARRAYBUFFER');
   const b=await crypto.subtle.digest('SHA-256',x.sourceBytes);
   const digest=Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
   return {id:x.id,sha:x.sha256,observed:digest,encoding:x.sourceEncoding,
     synthetic:x.syntheticOnly,createdAt:x.createdAt,byteLength:x.sourceBytes.byteLength};
  }));
  return rows.sort((a,b)=>a.id.localeCompare(b.id));
 });
}
function verifyRows(rows){
 check(rows.length===2&&rows.map(x=>x.id).join(',')==='qa-a,qa-b','ROWS_NOT_EXACTLY_TWO');
 for(const r of rows){
  check(r.sha===PDF[r.id].sha&&r.observed===PDF[r.id].sha&&r.encoding==='arraybuffer-v1'&&
    r.synthetic===true&&r.byteLength>10&&Number.isFinite(Date.parse(r.createdAt)),
    'ROW_SHA_OR_TYPE_MISMATCH '+r.id);
 }
}
async function loadApp(page){
 page.setDefaultTimeout(20000);
 await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#versionText')?.textContent?.includes('v0.8.15-test.0'));
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('TEST готов'));
}
async function cacheWorker(page){
 const ready=await page.evaluate(async()=>{
  const registration=await Promise.race([
   navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(()=>navigator.serviceWorker.ready),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('SW_INSTALL_TIMEOUT')),22000))
  ]);
  return {scope:registration.scope,state:registration.active?.state};
 });
 check(ready.scope===ORIGIN+'/','SERVICE_WORKER_SCOPE');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller));
 const cached=await page.evaluate(async()=>{
  const c=await caches.open('pae06-cp0815-restore-assets-v1');
  const files=['index.html','restore-test.html','restore-test.mjs',
   'tests/fixtures/synthetic_export.json','fixtures/PAE06_QA_A_1_PAGE.pdf',
   'fixtures/PAE06_QA_B_2_PAGES.pdf','assets/qa-b-page-2.webp'];
  const found=[];
  for(const f of files)found.push(Boolean(await c.match(new URL(f,location.href).href)));
  return found;
 });
 check(cached.length===7&&cached.every(Boolean),'SW_PRECACHED_ASSET_MISSING');
 return {scope:ready.scope,cached:cached.length,controlled:true};
}
async function preview(page,id,n,total){
 await page.locator('#items .item').filter({hasText:id.toUpperCase()}).click();
 await page.waitForFunction(s=>document.querySelector('#detail .pager')?.textContent?.includes(s),
   'Страница '+n+' из '+total);
 await page.waitForFunction(()=>{const img=document.querySelector('#detail img');
   return img?.complete&&img.naturalWidth>0;});
}
async function test(report){
 let server=null,context=null;
 try{
  report.source=await verifySource();
  server=await startServer();
  const profile=await mkdtemp(join(tmpdir(),'pae06-cp0817-'));
  context=await webkit.launchPersistentContext(profile,{headless:true,
   viewport:{width:390,height:844},serviceWorkers:'allow'});
  const online=context.pages()[0]||await context.newPage();
  const errors=[];
  online.on('pageerror',e=>errors.push('online:'+String(e.message).slice(0,120)));
  await loadApp(online);
  check((await online.locator('#count').textContent()).trim()==='0','PROFILE_NOT_EMPTY');
  await online.locator('#addA').click();
  await online.waitForFunction(()=>document.querySelector('#count')?.textContent?.trim()==='1');
  await online.locator('#addB').click();
  await online.waitForFunction(()=>document.querySelector('#count')?.textContent?.trim()==='2');
  const before=await snapshot(online);verifyRows(before);
  const worker=await cacheWorker(online);
  check(JSON.stringify(await snapshot(online))===JSON.stringify(before),'SW_CHANGED_ROWS');
  await context.close();context=null;
  await stopServer(server);server=null;
  report.originStoppedBeforeRestart=true;
  context=await webkit.launchPersistentContext(profile,{headless:true,
   viewport:{width:390,height:844},serviceWorkers:'allow'});
  const offline=context.pages()[0]||await context.newPage();
  offline.on('pageerror',e=>errors.push('offline:'+String(e.message).slice(0,120)));
  await loadApp(offline);
  check((await offline.locator('#count').textContent()).trim()==='2','OFFLINE_DOC_COUNT');
  check(await offline.evaluate(()=>Boolean(navigator.serviceWorker?.controller)),
    'SW_NO_OFFLINE_CONTROLLER');
  const after=await snapshot(offline);verifyRows(after);
  check(JSON.stringify(after)===JSON.stringify(before),'PERSISTED_IDB_CHANGED');
  await preview(offline,'qa-a',1,1);
  await preview(offline,'qa-b',1,2);
  await offline.locator('#detail .pager button').last().click();
  await offline.waitForFunction(()=>document.querySelector('#detail .pager')?.textContent?.includes('Страница 2 из 2'));
  await offline.waitForFunction(()=>{const i=document.querySelector('#detail img');
    return i?.complete&&i.naturalWidth>0;});
  const restore=await context.newPage();
  restore.on('pageerror',e=>errors.push('restore:'+String(e.message).slice(0,120)));
  await restore.goto(ORIGIN+'/restore-test.html',{waitUntil:'domcontentloaded',timeout:20000});
  await restore.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('TEST-кандидат готов'));
  await restore.locator('#sample').click();
  await restore.locator('#sourceCard').waitFor({state:'visible'});
  await restore.locator('#storageConsent').check();
  await restore.locator('#previewButton').click();
  await restore.locator('#previewCard').waitFor({state:'visible'});
  const parts=await Promise.all(['countAll','countNew','countAlready']
    .map(async id=>(await restore.locator('#'+id).textContent()).trim()));
  check(parts.join('/')==='2/0/2','OFFLINE_PREVIEW_NOT_2_0_2');
  check(await restore.locator('#commitButton').isDisabled(),'WRITE_ENABLED');
  const final=await snapshot(offline);verifyRows(final);
  check(JSON.stringify(final)===JSON.stringify(before),'OFFLINE_DUPLICATE_OR_MUTATION');
  check(errors.length===0,'PAGE_ERRORS '+errors.join(';'));
  report.status='PASS_SCOPED';
  report.evidence={worker,originStoppedBeforeRestart:true,seeded:2,
   afterContextRestart:after.length,afterPreview:final.length,
   offlineMain:'PASS',offlineRestore:'PASS',offlinePages:{'qa-a':'1/1','qa-b':'2/2'},
   offlineRestorePreview:parts.join('/'),ids:final.map(x=>x.id),
   pdfSha256:final.map(x=>x.observed),noDuplicate:true,pageErrors:[]};
 }finally{
  if(context)await context.close();
  if(server)await stopServer(server);
 }
}
const report={project:'PAE-06',checkpoint:'CP08.17-AUTO',browser:'Linux WebKit ONLY',
 status:'NOT_RUN',startedAt:new Date().toISOString(),retryCount:0,
 realIphoneSafari:'NOT_RUN',priorQaReplayed:false,sourceCommit:TEST_SHA};
try{await test(report);}
catch(e){report.status='FAIL_STOP_FIRST';report.error=String(e?.message||e).slice(0,320);process.exitCode=1;}
finally{
 report.finishedAt=new Date().toISOString();
 try{
  await mkdir(RUN,{recursive:true});
  const name='cp0817-'+randomUUID()+'.json';
  await writeFile(join(RUN,name),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  report.reportFile='qa-hub/.run/'+name;
 }catch(e){report.status='FAIL_STOP_FIRST';report.reportWriteError=String(e?.message||e).slice(0,160);process.exitCode=1;}
 console.log(JSON.stringify(report,null,2));
}
