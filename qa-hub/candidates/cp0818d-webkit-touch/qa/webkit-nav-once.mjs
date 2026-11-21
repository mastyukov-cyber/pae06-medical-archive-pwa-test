/* PAE-06 CP08.18-D: NEW, NARROW WebKit iPhone-emulation touch-navigation QA.
 * Diagnose old CP08.18-C FAIL; original failed run remains immutable.
 * One synthetic QA-B, one WebKit browser, same-origin local IndexedDB and original PDF.js.
 * No Safari/macOS/iOS simulator, no real records, no site publication.
 */
import {webkit,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT='http://127.0.0.1:8769/';
const VIEW=ROOT+'qa-hub/candidates/cp0818b-idb-viewer/index.html';
const SERVER=fileURLToPath(new URL('../../cp0818b-idb-viewer/qa/serve.mjs',import.meta.url));
const report={project:'PAE-06',checkpoint:'CP08.18-D-WEBKIT-TOUCH',status:'NOT_RUN',
  profile:'Linux WebKit + iPhone 13 emulation (NOT iOS Simulator / Safari)',
  syntheticOnly:true,iosSafari:'NOT_RUN',macSafari:'NOT_RUN',
  historicalWebKitFail:'PRESERVED_RUN_44949487461',rerunCount:0,checks:[],navigationEvidence:[]};
let server,browser;
function check(condition,label,details){
  const valid=Boolean(condition);
  report.checks.push({id:label,pass:valid,details:details??null});
  if(!valid)throw Error('STOP_FIRST_'+label);
}
async function ready(){
  server=spawn(process.execPath,[SERVER],{stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    let completed=false,output='';
    const timer=setTimeout(()=>finish(Error('LOOPBACK_TIMEOUT')),15000);
    function finish(error){
      if(completed)return;
      completed=true;clearTimeout(timer);error?reject(error):resolve();
    }
    server.stdout.on('data',d=>{
      output+=d.toString();
      if(output.includes('CP0818B2_LOOPBACK_READY'))finish();
    });
    server.on('error',finish);
    server.on('exit',code=>finish(Error('LOOPBACK_EXIT_'+code)));
  });
}
async function waitRendered(page,doc,pageNumber,expectedLabel){
  await page.waitForURL(url=>
    url.pathname.endsWith('/cp0818b-idb-viewer/index.html')&&
    url.searchParams.get('doc')===doc&&
    url.searchParams.get('page')===String(pageNumber),
    {waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(text=>{
    const status=document.querySelector('#status')?.dataset.state;
    const label=document.querySelector('#pages')?.textContent;
    const canvas=document.querySelector('#pageCanvas');
    return status==='pass'&&label===text&&canvas instanceof HTMLCanvasElement&&
      canvas.width>100&&canvas.height>100&&getComputedStyle(canvas).display!=='none';
  },expectedLabel,{timeout:35000});
}
try{
  await ready();
  browser=await webkit.launch({headless:true});
  const phone=devices['iPhone 13'];
  if(!phone?.isMobile||!phone?.hasTouch)throw Error('IPHONE_EMULATION_PROFILE_UNAVAILABLE');
  const context=await browser.newContext({...phone,viewport:{width:390,height:844},locale:'ru-RU'});
  try {
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error.message).slice(0,160)));
    page.on('framenavigated',frame=>{
      if(frame===page.mainFrame())report.navigationEvidence.push(frame.url());
    });
    await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#addB').tap();
    await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='1',
      null,{timeout:15000});
    await page.goto(VIEW+'?doc=qa-b&page=2',{waitUntil:'domcontentloaded',timeout:30000});
    await waitRendered(page,'qa-b',2,'Страница 2 из 2');
    const before=await page.locator('#prev').getAttribute('href');
    check(before==='?doc=qa-b&page=1','PINNED_PREVIOUS_LINK',before);

    // Critically, arm the URL wait BEFORE tapping and wait for PDF.js rendering AFTER navigation.
    await Promise.all([
      page.waitForURL(url=>url.searchParams.get('doc')==='qa-b'&&
        url.searchParams.get('page')==='1',
        {waitUntil:'domcontentloaded',timeout:15000}),
      page.locator('#prev').tap()
    ]);
    await waitRendered(page,'qa-b',1,'Страница 1 из 2');
    check((await page.locator('#pages').innerText())==='Страница 1 из 2',
      'WEBKIT_TOUCH_PREVIOUS_NAVIGATION_AND_PDFJS',
      {url:page.url(),latestNavigation:report.navigationEvidence.at(-1)});
    const next=await page.locator('#next').getAttribute('href');
    check(next==='?doc=qa-b&page=2','PINNED_NEXT_LINK',next);
    await Promise.all([
      page.waitForURL(url=>url.searchParams.get('doc')==='qa-b'&&
        url.searchParams.get('page')==='2',
        {waitUntil:'domcontentloaded',timeout:15000}),
      page.locator('#next').tap()
    ]);
    await waitRendered(page,'qa-b',2,'Страница 2 из 2');
    check((await page.locator('#pages').innerText())==='Страница 2 из 2',
      'WEBKIT_TOUCH_NEXT_NAVIGATION_AND_PDFJS',
      {url:page.url(),latestNavigation:report.navigationEvidence.at(-1)});
    const docCount=await page.evaluate(async()=>{
      const databases=await indexedDB.databases();
      const names=databases.filter(d=>d.name==='pae06_cp082_synthetic_only');
      if(names.length!==1||names[0].version!==1)return -1;
      return await new Promise(resolve=>{
        const request=indexedDB.open('pae06_cp082_synthetic_only',1);
        request.onupgradeneeded=()=>{try{request.transaction?.abort()}catch{};resolve(-2)};
        request.onerror=()=>resolve(-3);
        request.onsuccess=()=>{
          const db=request.result;
          try{
            const transaction=db.transaction('documents','readonly');
            const count=transaction.objectStore('documents').count();
            count.onsuccess=()=>{const n=count.result;db.close();resolve(n)};
            count.onerror=()=>{db.close();resolve(-4)};
          }catch{db.close();resolve(-5)}
        };
      });
    });
    check(docCount===1,'READONLY_QAB_REMAINS_SINGLE_RECORD',docCount);
    check(errors.length===0,'NO_BROWSER_PAGE_ERRORS',errors);
  }finally{await context.close();}
  report.status='PASS_SCOPED_WEBKIT_TOUCH_WITH_EXPLICIT_NAVIGATION_WAIT';
}catch(error){
  report.status='FAIL_STOP_FIRST';
  report.error=String(error?.stack||error).slice(0,900);
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  if(server){
    server.kill('SIGTERM');
    await new Promise(resolve=>{
      const timer=setTimeout(resolve,2000);
      server.once('exit',()=>{clearTimeout(timer);resolve()});
    });
  }
  console.log(JSON.stringify({...report,pass:report.checks.filter(x=>x.pass).length,
    total:report.checks.length},null,2));
}
