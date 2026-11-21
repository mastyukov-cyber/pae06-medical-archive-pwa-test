/* PAE-06 CP08.16-R2 R2-TX-01. ONE WebKit context, TWO tabs, real IndexedDB.
 * Synthetic QA-A/QA-B only. No Chromium, Safari impersonation, network, retries.
 * Browser context is ephemeral, and source app/backup modules are immutable.
 */
import {createHash,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {dirname,extname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {webkit} from 'playwright';

const DIR=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(DIR,'..');
const RUN=join(DIR,'.run');
const HOST='127.0.0.1',PORT=8768,ORIGIN='http://127.0.0.1:8768';
const SOURCE_COMMIT='7b7795f64e24432bc14e169cc28123a80acfd44b';
const PINS=Object.freeze({
  'restore-test.html':'2cc351cfad6cb89ea3a88350da6577a3d9ce50ec',
  'restore-test.css':'dfbe8ffc441d79923455cca4de551c7dea3d1fe3',
  'restore-test.mjs':'cf7adb356fadbaa10d11fc44257e50c80de69a2f',
  'src/restore.mjs':'2cdbc7223f96978d4cc823ad6ef434ccb8b76ce6',
  'src/test-idb-gate.mjs':'7522a67cde97446b220cd06ccaa7c6fc420faf60',
  'tests/fixtures/synthetic_export.json':'ff433fe734cc0ae364f0346f4b1a322d3a46d45d',
  'release.json':'1ebfaba39fc115ef46a026aff24369f452f847b7'
});
const ACCESS=new Set(Object.keys(PINS));
const PDF_HASHES=Object.freeze({
  'qa-a':'4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153',
  'qa-b':'3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982'
});
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
function assert(ok,code){if(!ok)throw Error(code);}
async function verifySources(){
  for(const [rel,sha] of Object.entries(PINS)){
    const bytes=await readFile(join(ROOT,rel));
    assert(bytes.length>0&&bytes.length<150000,'SOURCE_SIZE_DRIFT '+rel);
    const digest=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    assert(digest===sha,'SOURCE_BLOB_MISMATCH '+rel);
  }
  const rel=JSON.parse(await readFile(join(ROOT,'release.json'),'utf8'));
  assert(rel.channel==='TEST'&&rel.syntheticOnly===true&&rel.version==='v0.8.15-test.0'&&
    rel.buildId==='20261121-restore-candidate-01','VERSION_DRIFT');
  const sample=JSON.parse(await readFile(join(ROOT,'tests/fixtures/synthetic_export.json'),'utf8'));
  assert(sample.format==='PAE06-CP082-SYNTHETIC-EXPORT-ONLY'&&sample.version===1&&
    sample.clinicalAuthority===false&&sample.docs?.length===2,'BACKUP_SCOPE');
  const seen=new Set();
  for(const d of sample.docs){
    assert(Object.hasOwn(PDF_HASHES,d.id)&&!seen.has(d.id)&&d.syntheticOnly===true&&
      d.sourceEncoding==='arraybuffer-v1'&&d.sha256===PDF_HASHES[d.id],'BACKUP_ALLOWLIST');
    seen.add(d.id);
    const bytes=Buffer.from(d.bytesBase64,'base64');
    assert(bytes.subarray(0,5).toString('ascii')==='%PDF-'&&
      createHash('sha256').update(bytes).digest('hex')===PDF_HASHES[d.id],'BACKUP_PDF_HASH');
  }
  return {sourceCommit:SOURCE_COMMIT,sourcePins:Object.keys(PINS).length,syntheticDocs:[...seen].sort()};
}
async function startServer(){
  const server=createServer(async(req,res)=>{
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(req.headers.host!==HOST+':'+PORT||req.method!=='GET'){
      res.writeHead(403,headers);res.end();return;
    }
    let rel=null;
    try{
      const url=new URL(req.url,ORIGIN);
      if(url.origin===ORIGIN&&!url.search&&!url.hash)
        rel=url.pathname.startsWith('/')?decodeURIComponent(url.pathname.slice(1)):null;
    }catch{}
    if(!ACCESS.has(rel)){res.writeHead(404,headers);res.end();return;}
    try{
      const bytes=await readFile(join(ROOT,rel));
      res.writeHead(200,{...headers,'Content-Type':MIME[extname(rel)]||'application/octet-stream',
        'Content-Length':String(bytes.length)});
      res.end(bytes);
    }catch{res.writeHead(404,headers);res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(PORT,HOST,resolve);});
  return server;
}
async function snapshot(page){
  return page.evaluate(async()=>{
    const rows=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('pae06_cp082_synthetic_only',1);
      req.onerror=()=>reject(Error('IDB_OPEN_FAIL'));
      req.onblocked=()=>reject(Error('IDB_BLOCKED'));
      req.onupgradeneeded=()=>{try{req.transaction.abort()}catch{}reject(Error('UNEXPECTED_IDB_UPGRADE'));};
      req.onsuccess=()=>{
        const db=req.result;
        try{
          if(db.version!==1||db.objectStoreNames.length!==1||
             !db.objectStoreNames.contains('documents'))throw Error('IDB_SCHEMA');
          const tx=db.transaction('documents','readonly');
          const get=tx.objectStore('documents').getAll();
          let records=null;
          get.onsuccess=()=>{records=get.result;};
          get.onerror=()=>reject(Error('IDB_GETALL_FAIL'));
          tx.oncomplete=()=>{db.close();resolve(records);};
          tx.onabort=()=>{db.close();reject(Error('IDB_TX_ABORT'));};
        }catch(e){db.close();reject(e);}
      };
    });
    return Promise.all(rows.map(async row=>{
      if(!(row.sourceBytes instanceof ArrayBuffer))throw Error('NOT_ARRAYBUFFER');
      const hash=await crypto.subtle.digest('SHA-256',row.sourceBytes);
      const measured=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
      return {id:row.id,title:row.title,sha256:row.sha256,observedSHA:measured,
        sourceEncoding:row.sourceEncoding,syntheticOnly:row.syntheticOnly,createdAt:row.createdAt};
    })).then(x=>x.sort((a,b)=>a.id.localeCompare(b.id)));
  });
}
function validateRows(rows){
  assert(Array.isArray(rows)&&rows.length===2,'ROW_COUNT_NOT_TWO');
  assert(rows.map(x=>x.id).join(',')==='qa-a,qa-b','ROW_IDS_NOT_QA_A_B');
  for(const r of rows){
    assert(r.sha256===PDF_HASHES[r.id]&&r.observedSHA===PDF_HASHES[r.id]&&
      r.syntheticOnly===true&&r.sourceEncoding==='arraybuffer-v1'&&
      typeof r.createdAt==='string'&&Number.isFinite(Date.parse(r.createdAt)),
      'ROW_INTEGRITY_FAIL '+r.id);
  }
}
async function prepare(page){
  page.setDefaultTimeout(20000);
  await page.goto(ORIGIN+'/restore-test.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#message')?.textContent?.includes('TEST-кандидат готов'));
  await page.locator('#sample').click();
  await page.locator('#sourceCard').waitFor({state:'visible'});
  await page.locator('#storageConsent').check();
  await page.locator('#previewButton').click();
  await page.locator('#previewCard').waitFor({state:'visible'});
  assert((await page.locator('#countAll').textContent()).trim()==='2','PREVIEW_TOTAL_NOT_TWO');
  assert((await page.locator('#countNew').textContent()).trim()==='2','PREVIEW_NEW_NOT_TWO');
  assert((await page.locator('#countAlready').textContent()).trim()==='0','PREVIEW_ALREADY_NOT_ZERO');
  assert(await page.locator('#commitButton').isDisabled(),'WRITE_BEFORE_SECOND_CONSENT');
  await page.locator('#writeConsent').check();
  assert(await page.locator('#commitButton').isEnabled(),'WRITE_NOT_ENABLED_AFTER_CONSENT');
}
async function runWebKit(report){
  let browser=null,server=null;
  try{
    report.source=await verifySources();
    server=await startServer();
    browser=await webkit.launch({headless:true});
    const context=await browser.newContext();
    const tabA=await context.newPage();
    const tabB=await context.newPage();
    const errors=[];
    for(const [name,page] of [['A',tabA],['B',tabB]])
      page.on('pageerror',e=>errors.push(name+':'+String(e.message).slice(0,180)));
    await prepare(tabA);
    await prepare(tabB);
    const before=await snapshot(tabA);
    assert(before.length===0,'BEFORE_SNAPSHOT_NOT_EMPTY');
    await tabA.locator('#commitButton').click();
    await tabA.locator('#doneCard').waitFor({state:'visible'});
    assert((await tabA.locator('#doneText').textContent()).includes('Добавлено: 2'),
      'FIRST_RESTORE_NOT_TWO');
    const afterFirst=await snapshot(tabA);
    validateRows(afterFirst);
    await tabB.locator('#commitButton').click();
    await tabB.waitForFunction(()=>/Данные изменились после предпросмотра|База изменилась в другой вкладке/.test(
      document.querySelector('#message')?.textContent||''),null,{timeout:20000});
    const rejection=(await tabB.locator('#message').textContent()).trim();
    assert(!(await tabB.locator('#doneCard').isVisible())&&
      await tabB.locator('#commitButton').isDisabled(),'SECOND_TAB_NOT_LOCKED');
    const afterSecond=await snapshot(tabA);
    validateRows(afterSecond);
    assert(JSON.stringify(afterSecond)===JSON.stringify(afterFirst),'SECOND_TAB_MUTATED_ROWS');
    assert(errors.length===0,'PAGE_ERRORS '+errors.join(';'));
    report.evidence={firstPreview:'2 new',secondPreview:'2 new',beforeCount:0,
      afterFirstCount:afterFirst.length,afterSecondCount:afterSecond.length,
      secondTabRejected:true,refusal:rejection.includes('предпросмотра')?'PREVIEW_STALE':'CONCURRENT_CHANGE_ABORTED',
      finalIds:afterSecond.map(x=>x.id),finalSha256:afterSecond.map(x=>x.observedSHA),
      unchangedAfterSecond:true,pageErrors:[]};
    report.status='PASS_SCOPED';
  }finally{
    if(browser)await browser.close();
    if(server)await new Promise(resolve=>server.close(resolve));
  }
}
const report={project:'PAE-06',checkpoint:'CP08.16-R2',scenario:'R2-TX-01',
  browser:'Playwright Linux WebKit ONLY',sourceCommit:SOURCE_COMMIT,
  status:'NOT_RUN',startedAt:new Date().toISOString(),
  oldQaReplayed:false,negativeS01S07Replayed:false,realIphoneSafari:'NOT_RUN',retryCount:0};
try{await runWebKit(report);}
catch(e){report.status='FAIL_STOP_FIRST';report.error=String(e?.message||e).slice(0,320);process.exitCode=1;}
finally{
  report.finishedAt=new Date().toISOString();
  try{
    await mkdir(RUN,{recursive:true});
    const filename='r2-tx01-'+randomUUID()+'.json';
    await writeFile(join(RUN,filename),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    report.reportFile='qa-hub/.run/'+filename;
  }catch(e){report.reportWriteError=String(e?.message||e).slice(0,160);report.status='FAIL_STOP_FIRST';process.exitCode=1;}
  console.log(JSON.stringify(report,null,2));
}
