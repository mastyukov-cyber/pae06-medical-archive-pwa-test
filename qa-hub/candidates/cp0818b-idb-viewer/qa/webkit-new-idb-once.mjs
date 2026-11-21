/* CP08.18-B2: NEW integration-only WebKit QA, intentionally NOT RUN in source-only phase. */
import {webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
const HERE=dirname(fileURLToPath(import.meta.url));
const BASE='http://127.0.0.1:8769/';
const VIEW=BASE+'qa-hub/candidates/cp0818b-idb-viewer/index.html';
const report={project:'PAE-06',checkpoint:'CP08.18-B2',browser:'Linux WebKit',
 status:'NOT_RUN',checks:[],syntheticOnly:true,iosSafari:'NOT_RUN',rerunCount:0};
const check=(condition,id)=>{report.checks.push({id,pass:!!condition});if(!condition)throw Error('STOP_FIRST_'+id)};
let srv,browser;
async function ready(){
 srv=spawn(process.execPath,['serve.mjs'],{cwd:HERE,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  let done=false;const timer=setTimeout(()=>finish(Error('SERVER_TIMEOUT')),15000);
  function finish(e){if(done)return;done=true;clearTimeout(timer);e?reject(e):resolve()}
  srv.stdout.on('data',d=>{if(d.toString().includes('CP0818B2_LOOPBACK_READY'))finish()});
  srv.on('error',finish);srv.on('exit',c=>finish(Error('SERVER_EXIT_'+c)));
 });
}
async function status(page,suffix){
 await page.goto(VIEW+suffix,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>['pass','blocked'].includes(document.querySelector('#status')?.dataset.state),null,{timeout:35000});
 return page.locator('#status').getAttribute('data-state');
}
try{
 await ready();browser=await webkit.launch({headless:true});
 const context=await browser.newContext();const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#addA').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='1');
 await page.locator('#addB').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='2');
 check((await page.locator('#count').innerText())==='2','PREEXISTING_APP_SEEDS_2_DOCS');
 check(await status(page,'?doc=qa-b&page=2')==='pass','STORED_QAB_REAL_PDFJS_PAGE2');
 check((await page.locator('#pages').innerText()).includes('2 из 2'),'STORED_QAB_COUNT_2');
 check(await page.locator('canvas').evaluate(x=>x.width>100&&x.height>100&&x.style.display==='block'),'STORED_QAB_CANVAS');
 check(await page.locator('#prev').getAttribute('href')==='?doc=qa-b&page=1','STORED_QAB_PREV_LINK');
 check(await status(page,'?doc=qa-b&page=3')==='blocked','STORED_PAGE3_REFUSAL');
 check(await page.locator('canvas').count()===0,'NO_CANVAS_AFTER_REFUSAL');
 check(await status(page,'?doc=unlisted&page=1')==='blocked','UNKNOWN_DOC_REFUSAL');
 const listed=await page.evaluate(async()=>{const x=await indexedDB.databases();return x.filter(y=>y.name==='pae06_cp082_synthetic_only').length});
 check(listed===1,'NO_DB_REPLACEMENT_OR_DUPLICATE');
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 check((await page.locator('#count').innerText())==='2','EXISTING_RECORDS_STILL_TWO');
 const empty=await browser.newContext();const p2=await empty.newPage();
 check(await status(p2,'?doc=qa-a&page=1')==='blocked','NO_DB_REFUSAL');
 const after=await p2.evaluate(async()=>await indexedDB.databases());
 check(after.every(x=>x.name!=='pae06_cp082_synthetic_only'),'NO_SILENT_DB_CREATION');
 check(errors.length===0,'NO_PAGEERRORS');
 await empty.close();await context.close();report.status='PASS_SCOPED';
}catch(e){report.status='FAIL_STOP_FIRST';report.error=String(e?.stack||e).slice(0,700);process.exitCode=1;}
finally{if(browser)await browser.close();if(srv){srv.kill('SIGTERM');await new Promise(r=>{const t=setTimeout(r,2000);srv.once('exit',()=>{clearTimeout(t);r()})})}
 console.log(JSON.stringify({...report,pass:report.checks.filter(x=>x.pass).length,total:report.checks.length},null,2));}
