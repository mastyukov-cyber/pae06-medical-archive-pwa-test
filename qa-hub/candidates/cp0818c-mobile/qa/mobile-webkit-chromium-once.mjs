/* PAE-06 CP08.18-C MOBILE: new mobile-only WebKit+Chromium QA, one run, synthetic TEST.
 * Not an iOS Safari or actual iPhone Simulator. No live medical data.
 * Tests responsive touch navigation, actual PDF.js rendering and existing same-origin IndexedDB.
 */
import {webkit, chromium, devices} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const origin='http://127.0.0.1:8769/';
const viewer=origin+'qa-hub/candidates/cp0818b-idb-viewer/index.html';
const serverScript=fileURLToPath(new URL('../../cp0818b-idb-viewer/qa/serve.mjs',import.meta.url));
const report={project:'PAE-06',checkpoint:'CP08.18-C-MOBILE',profile:'iPhone 13 EMULATION (NOT iOS Simulator)',
  status:'NOT_RUN',syntheticOnly:true,iosSafari:'NOT_RUN',macSafari:'NOT_RUN',rerunCount:0,checks:[],metrics:[]};
let server;
function check(ok,id,detail=null){
  report.checks.push({id,pass:!!ok,detail});
  if(!ok)throw Error('STOP_FIRST_'+id+(detail?'_'+JSON.stringify(detail).slice(0,120):''));
}
async function ready(){
  server=spawn(process.execPath,[serverScript],{stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    let completed=false,output='';
    const timeout=setTimeout(()=>finish(Error('LOOPBACK_SERVER_TIMEOUT')),15000);
    function finish(err){if(completed)return;completed=true;clearTimeout(timeout);err?reject(err):resolve();}
    server.stdout.on('data',d=>{
      output+=d.toString();
      if(output.includes('CP0818B2_LOOPBACK_READY'))finish();
    });
    server.on('error',finish);
    server.on('exit',code=>finish(Error('LOOPBACK_EXIT_'+code)));
  });
}
async function waitViewer(page){
  await page.waitForFunction(()=>['pass','blocked'].includes(document.querySelector('#status')?.dataset.state),null,{timeout:35000});
  return page.locator('#status').getAttribute('data-state');
}
async function runMobile(engine,label){
  const browser=await engine.launch({headless:true});
  try {
    const phone=devices['iPhone 13'];
    if(!phone||phone.isMobile!==true||phone.hasTouch!==true)throw Error('IPHONE_PROFILE_MISSING');
    const context=await browser.newContext({...phone,viewport:{width:390,height:844},locale:'ru-RU'});
    try {
      const page=await context.newPage();
      const pageErrors=[];
      page.on('pageerror',e=>pageErrors.push(String(e.message).slice(0,200)));
      await page.goto(origin,{waitUntil:'domcontentloaded',timeout:30000});
      await page.locator('#addA').tap();
      await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='1',null,{timeout:15000});
      await page.locator('#addB').tap();
      await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='2',null,{timeout:15000});
      // Seeding is prerequisite, not a duplicate counted QA case.
      await page.goto(viewer+'?doc=qa-b&page=2',{waitUntil:'domcontentloaded',timeout:30000});
      check(await waitViewer(page)==='pass',label+'_PHONE_WEBKIT_PDFJS_PAGE2');
      const portrait=await page.evaluate(()=>{
        const canvas=document.querySelector('#pageCanvas');
        const rect=canvas?.getBoundingClientRect();
        return {innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
          canvasWidth:canvas?.width,canvasHeight:canvas?.height,
          canvasCssWidth:rect?.width,canvasVisible:getComputedStyle(canvas).display!=='none',
          viewportMeta:document.querySelector('meta[name="viewport"]')?.content,
          touch:matchMedia('(pointer:coarse)').matches};
      });
      report.metrics.push({engine:label,orientation:'portrait',...portrait});
      check(portrait.canvasVisible&&portrait.canvasWidth>100&&portrait.canvasHeight>100,
        label+'_PHONE_REAL_PDF_CANVAS',portrait);
      check(portrait.innerWidth>=375&&portrait.innerWidth<=430&&portrait.scrollWidth<=portrait.innerWidth+2,
        label+'_PHONE_NO_HORIZONTAL_OVERFLOW',portrait);
      check(portrait.canvasCssWidth>100&&portrait.canvasCssWidth<=portrait.innerWidth,
        label+'_PHONE_CANVAS_RESPONSIVE',portrait);
      check(portrait.touch&&portrait.viewportMeta?.includes('width=device-width'),
        label+'_PHONE_TOUCH_VIEWPORT_META',portrait);
      await page.locator('#prev').tap();
      check(await waitViewer(page)==='pass'&&
        (await page.locator('#pages').innerText()).includes('1 из 2'),
        label+'_PHONE_TOUCH_PREVIOUS_PAGE');
      await page.locator('#next').tap();
      check(await waitViewer(page)==='pass'&&
        (await page.locator('#pages').innerText()).includes('2 из 2'),
        label+'_PHONE_TOUCH_NEXT_PAGE');
      await page.setViewportSize({width:844,height:390});
      const landscape=await page.evaluate(()=>{
        const canvas=document.querySelector('#pageCanvas');
        return {innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
          canvasCssWidth:canvas.getBoundingClientRect().width};
      });
      report.metrics.push({engine:label,orientation:'landscape',...landscape});
      check(landscape.innerWidth>=810&&landscape.scrollWidth<=landscape.innerWidth+2&&
        landscape.canvasCssWidth<=landscape.innerWidth,
        label+'_PHONE_LANDSCAPE_RESPONSIVE',landscape);
      await page.setViewportSize({width:390,height:844});
      await page.goto(viewer+'?doc=qa-b&page=3',{waitUntil:'domcontentloaded',timeout:30000});
      check(await waitViewer(page)==='blocked'&&(await page.locator('canvas').count())===0,
        label+'_PHONE_BAD_PAGE_NO_CANVAS');
      await page.goto(viewer+'?doc=qa-a&page=1',{waitUntil:'domcontentloaded',timeout:30000});
      check(await waitViewer(page)==='pass',label+'_PHONE_SECOND_DOCUMENT_OPEN');
      await page.locator('a.back').tap();
      await page.waitForURL(/\/index\.html$/,{timeout:15000});
      await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='2',null,{timeout:15000});
      check((await page.locator('#count').innerText())==='2',label+'_PHONE_RETURN_TO_EXISTING_CATALOG');
      check(pageErrors.length===0,label+'_PHONE_NO_JS_EXCEPTIONS',pageErrors);
    }finally{await context.close();}
  }finally{await browser.close();}
}
try{
  await ready();
  await runMobile(webkit,'WEBKIT');
  await runMobile(chromium,'CHROMIUM');
  report.status='PASS_SCOPED_MOBILE_EMULATION';
}catch(e){
  report.status='FAIL_STOP_FIRST';
  report.error=String(e?.stack||e).slice(0,900);
  process.exitCode=1;
}finally{
  if(server){
    server.kill('SIGTERM');
    await new Promise(resolve=>{
      const t=setTimeout(resolve,2000);
      server.once('exit',()=>{clearTimeout(t);resolve();});
    });
  }
  console.log(JSON.stringify({...report,pass:report.checks.filter(x=>x.pass).length,total:report.checks.length},null,2));
}
