/* Exactly one NEW browser QA. No historical test suites. No Mac/iPhone. */
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {webkit} from 'playwright';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const HERE=dirname(fileURLToPath(import.meta.url)),BASE='http://127.0.0.1:8768/qa-hub/candidates/cp0818-pagelink/index.html';
const sha={a:'4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153',b:'3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982'};
let srv=null,browser=null;
const report={project:'PAE-06',checkpoint:'CP08.18-A',browser:'Linux WebKit',status:'NOT_RUN',checks:[],syntheticOnly:true,realSafariIpad:'NOT_RUN',rerunCount:0};
function check(ok,id,detail){report.checks.push({id,pass:!!ok,detail:detail??null});if(!ok)throw Error('QA_FAIL_'+id);}
async function waitReady(){srv=spawn(process.execPath,['serve.mjs'],{cwd:HERE,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{let buf='',done=false;const timer=setTimeout(()=>finish(Error('SERVER_READY_TIMEOUT')),15000);function finish(err){if(done)return;done=true;clearTimeout(timer);if(err)reject(err);else resolve();}srv.stdout.on('data',d=>{buf+=d.toString();if(buf.includes('CP0818_LOOPBACK_READY'))finish();});srv.on('error',finish);srv.on('exit',c=>finish(Error('SERVER_EXIT_'+c)));});}
async function open(page,suffix){await page.goto(BASE+suffix,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForFunction(()=>['pass','blocked'].includes(document.querySelector('#status')?.dataset.state),null,{timeout:35000});return page.locator('#status').getAttribute('data-state');}
try{
 const paths=[['a','../../../fixtures/PAE06_QA_A_1_PAGE.pdf'],['b','../../../fixtures/PAE06_QA_B_2_PAGES.pdf']];
 for(const [id,rel] of paths){const root=join(HERE,'..'),b=await readFile(join(root,rel));check(createHash('sha256').update(b).digest('hex')===sha[id],'SOURCE_SHA_'+id);}
 await waitReady();browser=await webkit.launch({headless:true});const page=await browser.newPage({viewport:{width:1180,height:840}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,160)));
 check(await open(page,'?doc=qa-a&page=1')==='pass','QA_A_ACTUAL_PDF_RENDER');
 check((await page.locator('#pages').innerText()).includes('1 из 1'),'QA_A_PAGECOUNT');
 check((await page.locator('#sha').innerText())===sha.a,'QA_A_DISPLAY_SHA');
 check(await page.locator('canvas').evaluate(c=>c.width>100&&c.height>100&&c.style.display==='block'),'QA_A_CANVAS_RENDER');
 check(await open(page,'?doc=qa-b&page=1')==='pass','QA_B_FIRST_RENDER');
 check((await page.locator('#pages').innerText()).includes('1 из 2'),'QA_B_PAGECOUNT');
 check((await page.locator('#sha').innerText())===sha.b,'QA_B_DISPLAY_SHA');
 check(await page.locator('#next').getAttribute('href')==='?doc=qa-b&page=2','NEXT_PAGE_LINK');
 await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='pass');
 check((await page.locator('#pages').innerText()).includes('2 из 2'),'QA_B_SECOND_RENDER');
 check(await page.locator('#next').getAttribute('aria-disabled')==='true','PAGE_2_END');
 check(await open(page,'?doc=qa-b&page=3')==='blocked','PAGE_3_OF_2_DENIED');
 check((await page.locator('#status').innerText()).includes('SOURCE_PDF_PAGE_OUT_OF_BOUNDS'),'PAGE_3_EXPLICIT_FAIL');
 check(await page.locator('canvas').count()===0,'NO_CANVAS_AFTER_DENIAL');
 check(await open(page,'?doc=qa-b&page=0')==='blocked','PAGE_ZERO_DENIED');
 check(await open(page,'?doc=qa-b&page=1&extra=1')==='blocked','EXTRA_QUERY_DENIED');
 check(await open(page,'?doc=other&page=1')==='blocked','UNLISTED_ID_DENIED');
 check(errors.length===0,'NO_PAGEERRORS',errors.join(';'));
 report.status='PASS_SCOPED';
}catch(e){report.status='FAIL_STOP_FIRST';report.error=String(e?.stack||e).slice(0,700);process.exitCode=1;}
finally{if(browser)await browser.close();if(srv){srv.kill('SIGTERM');await new Promise(r=>{const t=setTimeout(r,2000);srv.once('exit',()=>{clearTimeout(t);r()})})}console.log(JSON.stringify({...report,pass:report.checks.filter(c=>c.pass).length,total:report.checks.length},null,2));}
