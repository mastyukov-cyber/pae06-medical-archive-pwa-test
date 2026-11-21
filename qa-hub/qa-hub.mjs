/* PAE-06 QA HUB v1 synthetic-only candidate. NO AUTO-RUN. Exact source pins.
 * No Mac/Vault/Gateway, no real records, no HTTP connections beyond localhost.
 * Source restore gate stays UNCHANGED; offline NOT RUN on HTTP.
 */
import {createHash,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {dirname,extname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const DIR=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(DIR,'..'),RUN=join(DIR,'.run');
const SOURCE_COMMIT='7b7795f64e24432bc14e169cc28123a80acfd44b',PINS={
  "app.js": "6065e80353734648d211b31582ec1462d264e046",
  "assets/qa-a-page-1.webp": "f8c5050dcf3166cdd158e6afad4384679a58dfab",
  "assets/qa-b-page-1.webp": "a85abeadf68f7766b59bc2d848f12d5606a11a90",
  "assets/qa-b-page-2.webp": "aa8ce0456d42e0e39ffb346bfa0ca96b1b1f9260",
  "catalog.js": "e0ccd7d4aa1c875255d97b5abf1d8a008cab1a25",
  "fixtures/PAE06_QA_A_1_PAGE.pdf": "0b0243e0a034eebc01d48fcfadc7d37386ae843f",
  "fixtures/PAE06_QA_B_2_PAGES.pdf": "4560d45b53e2cdf94e7aaab77441e5bcf70851da",
  "icon-192.png": "03b036d6ccc31dfc642a1f5be176612780951391",
  "icon-512.png": "d46f0a0bbfcedf97c3345c969a37adea96b96b0b",
  "index.html": "3d8700677dcf8903d0f04c5fb7ff13f1bef60f84",
  "mac-bridge-view.mjs": "943dcedf96289df3e406570b375cab0fb846180c",
  "mac-bridge.mjs": "52409ba45069241e1a836ada32e6169d7f4a3002",
  "mac-derived-adapter.mjs": "f9c0d43ba0467bbd1beeb435d6b7d1373eb4e771",
  "mac-preview.mjs": "c5f2903ec3977718fc50fd1eb20fb52a3f8f9df5",
  "manifest.webmanifest": "a8073826cf1ba995bba9f5245eec1402f8480d64",
  "qa/qa_public_key.json": "fe815d83a6caa1734983a7ba93dbab2c2c1e1d67",
  "qa/signed_transfer.json": "ac351d0e0b36c7d0ab58a864e5a7c5c4d82b1553",
  "release.json": "1ebfaba39fc115ef46a026aff24369f452f847b7",
  "restore-test.css": "dfbe8ffc441d79923455cca4de551c7dea3d1fe3",
  "restore-test.html": "2cc351cfad6cb89ea3a88350da6577a3d9ce50ec",
  "restore-test.mjs": "cf7adb356fadbaa10d11fc44257e50c80de69a2f",
  "src/restore.mjs": "2cdbc7223f96978d4cc823ad6ef434ccb8b76ce6",
  "src/test-idb-gate.mjs": "7522a67cde97446b220cd06ccaa7c6fc420faf60",
  "style.css": "f5b4ab1b02b1e7f7bd960f46f9fe16aa2da82ba2",
  "sw.js": "e6bdb9ed12eb5da3037cd9ef7f083d09a69b9c51",
  "tests/fixtures/synthetic_export.json": "ff433fe734cc0ae364f0346f4b1a322d3a46d45d"
},ALLOW=new Set(Object.keys(PINS));
const HOST='127.0.0.1',PORT=8768,ORIGIN='http://127.0.0.1:8768';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json','.webmanifest':'application/manifest+json',
 '.pdf':'application/pdf','.png':'image/png','.webp':'image/webp'};
function deny(msg){throw Error(msg)}
async function verify(){
 let total=0;
 for(const [rel,sha] of Object.entries(PINS)){
   if(rel.startsWith('/')||rel.includes('..'))deny('INVALID_PATH '+rel);
   const b=await readFile(join(ROOT,rel));
   if(b.length>150000)deny('SIZE_GUARD '+rel);
   const blob=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
   if(blob!==sha)deny('GIT_BLOB_SHA_MISMATCH '+rel);
   total+=b.length;
 }
 const gate=await readFile(join(ROOT,'src/test-idb-gate.mjs'),'utf8');
 const app=await readFile(join(ROOT,'app.js'),'utf8');
 if(!gate.includes("loc.hostname==='127.0.0.1'")||
    !gate.includes("loc.pathname==='/restore-test.html'")||
    !gate.includes('EXPLICIT_STORAGE_CONSENT_REQUIRED')||
    !gate.includes('loc.search||loc.hash'))deny('RESTORE_ORIGIN_GUARD_DRIFT');
 if(!app.includes('location.protocol==="https:"')||
    !app.includes('pae06_cp082_synthetic_only'))deny('APP_SCOPE_DRIFT');
 const metadata=JSON.parse(await readFile(join(ROOT,'release.json'),'utf8'));
 if(metadata.version!=='v0.8.15-test.0'||metadata.buildId!=='20261121-restore-candidate-01'||
    metadata.syntheticOnly!==true||metadata.channel!=='TEST')deny('VERSION_DRIFT');
 const data=JSON.parse(await readFile(join(ROOT,'tests/fixtures/synthetic_export.json'),'utf8'));
 if(data.clinicalAuthority!==false||data.docs?.length!==2||
    new Set(data.docs.map(x=>x.id)).size!==2||
    data.docs.some(x=>!['qa-a','qa-b'].includes(x.id)||x.syntheticOnly!==true))
    deny('NON_SYNTHETIC_SOURCE');
 for(const [path,sha] of [
  ['fixtures/PAE06_QA_A_1_PAGE.pdf','4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153'],
  ['fixtures/PAE06_QA_B_2_PAGES.pdf','3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982']]){
   const b=await readFile(join(ROOT,path));
   if(b.subarray(0,5).toString('ascii')!=='%PDF-'||
      createHash('sha256').update(b).digest('hex')!==sha)deny('PDF_SHA_256_MISMATCH '+path);
 }
 return {sourceCommit:SOURCE_COMMIT,assets:Object.keys(PINS).length,sourceBytes:total};
}
function allowed(req){
 if(typeof req.url!=='string'||!req.url.startsWith('/'))return null;
 let url;try{url=new URL(req.url,ORIGIN)}catch{return null}
 if(url.origin!==ORIGIN||url.hash)return null;
 let p;try{p=decodeURIComponent(url.pathname)}catch{return null}
 if(p==='/')p='/index.html';
 const rel=p.slice(1);
 if(!ALLOW.has(rel))return null;
 if(url.search&&rel!=='restore-test.html'&&rel!=='release.json')return null;
 return rel;
}
async function serve(){
 const srv=createServer(async(req,res)=>{
  const hdr={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(req.headers.host!==HOST+':'+PORT||!['GET','HEAD'].includes(req.method)){
   res.writeHead(403,hdr);res.end();return;
  }
  const rel=allowed(req);
  if(!rel){res.writeHead(404,hdr);res.end();return}
  try{
   const path=resolve(ROOT,rel);
   if(!path.startsWith(ROOT+sep))deny('PATH_ESCAPE');
   const b=await readFile(path);
   res.writeHead(200,{...hdr,'Content-Type':MIME[extname(path)]||
     'application/octet-stream','Content-Length':String(b.length)});
   res.end(req.method==='HEAD'?undefined:b);
  }catch{res.writeHead(404,hdr);res.end()}
 });
 await new Promise((ok,bad)=>{srv.once('error',bad);srv.listen(PORT,HOST,ok)});
 return srv;
}
async function hasText(page,selector,sub){
 await page.waitForFunction(([selector,sub])=>
  document.querySelector(selector)?.textContent?.includes(sub),[selector,sub]);
}
async function browserRun(name,engine){
 const browser=await engine.launch({headless:true}),checks=[],errors=[];
 try{
  const c=await browser.newContext();
  try{
   const p=await c.newPage();p.setDefaultTimeout(20000);
   p.on('pageerror',e=>errors.push(String(e.message)));
   await p.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
   await hasText(p,'#versionText','v0.8.15-test.0');
   await hasText(p,'#status','TEST готов');
   checks.push('test-build-and-db');
   await p.locator('#addA').click();await hasText(p,'#count','1');
   await p.locator('#addB').click();await hasText(p,'#count','2');
   checks.push('synthetic-pdfs-a-and-b');
   await p.locator('#search').fill('QA-B');await hasText(p,'#matchCount','1 из 2');
   await p.locator('#search').fill('');
   await p.reload({waitUntil:'domcontentloaded'});await hasText(p,'#count','2');
   checks.push('search-and-reload-preservation');
  }finally{await c.close()}
  const c2=await browser.newContext();
  try{
   const p=await c2.newPage();p.setDefaultTimeout(20000);
   p.on('pageerror',e=>errors.push(String(e.message)));
   await p.goto(ORIGIN+'/restore-test.html',{waitUntil:'domcontentloaded'});
   await hasText(p,'#message','TEST-кандидат готов');
   if(!await p.locator('#commitButton').isDisabled())deny('PREMATURE_WRITE_ENABLED');
   await p.locator('#sample').click();await p.locator('#sourceCard').waitFor({state:'visible'});
   if(!await p.locator('#previewButton').isDisabled())deny('READ_CONSENT_MISSING');
   checks.push('sha-synthetic-sample-and-read-consent');
   await p.locator('#storageConsent').check();
   await p.locator('#previewButton').click();
   await p.locator('#previewCard').waitFor({state:'visible'});
   await hasText(p,'#countNew','2');
   if(!await p.locator('#commitButton').isDisabled())deny('PREVIEW_WRITES');
   checks.push('preview-without-write');
   await p.locator('#writeConsent').check();await p.locator('#commitButton').click();
   await p.locator('#doneCard').waitFor({state:'visible'});
   await hasText(p,'#doneText','Добавлено: 2');
   await p.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
   await hasText(p,'#count','2');
   checks.push('confirmed-restore-and-app-readback');
   await p.goto(ORIGIN+'/restore-test.html',{waitUntil:'domcontentloaded'});
   await p.locator('#sample').click();await p.locator('#sourceCard').waitFor({state:'visible'});
   await p.locator('#storageConsent').check();await p.locator('#previewButton').click();
   await p.locator('#previewCard').waitFor({state:'visible'});
   await hasText(p,'#countNew','0');
   if(!await p.locator('#commitButton').isDisabled())deny('DUPLICATE_WRITE_ALLOWED');
   checks.push('no-overwrite-on-repeat');
  }finally{await c2.close()}
  const c3=await browser.newContext();
  try{
   const p=await c3.newPage();p.setDefaultTimeout(20000);
   await p.goto(ORIGIN+'/restore-test.html?invalid=1',{waitUntil:'domcontentloaded'});
   await hasText(p,'#message','только на разрешённом локальном адресе');
   if(!await p.locator('#sample').isDisabled())deny('ORIGIN_GUARD_BYPASSED');
   checks.push('query-origin-denied');
  }finally{await c3.close()}
  if(errors.length)deny('PAGE_ERRORS '+errors.join(';').slice(0,250));
  return {browser:name,status:'PASS_SCOPED',checks,errors:[]};
 }finally{await browser.close()}
}
async function qa(){
 const report={project:'PAE-06',sourceCommit:SOURCE_COMMIT,
  status:'NOT_RUN',startedAt:new Date().toISOString(),results:[],
  offline:'NOT_RUN_HTTP_LOCALHOST_HTTPS_REQUIRED',realSafari:'NOT_RUN'};
 let srv=null;
 try{
  report.source=await verify();srv=await serve();
  const {chromium,webkit}=await import('playwright');
  for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]])
   report.results.push(await browserRun(name,engine));
  report.status='PASS_SCOPED';
 }catch(e){report.status='FAIL_STOP_FIRST';report.error=String(e?.message||e).slice(0,320);process.exitCode=1}
 finally{
  if(srv)await new Promise(ok=>srv.close(ok));
  report.finishedAt=new Date().toISOString();
  await mkdir(RUN,{recursive:true});
  const file='qa-'+randomUUID()+'.json';
  await writeFile(join(RUN,file),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({...report,reportFile:'qa-hub/.run/'+file},null,2));
 }
}
const cmd=process.argv[2];
if(cmd==='verify')console.log(JSON.stringify({status:'PASS_STATIC_SOURCE_ONLY',...(await verify()),browser:'NOT_RUN'}));
else if(cmd==='serve'){await verify();await serve();console.log(JSON.stringify({status:'LOCAL_ONLY',host:HOST,port:PORT}));}
else if(cmd==='qa')await qa();
else deny('Allowed commands: verify | qa | serve');
