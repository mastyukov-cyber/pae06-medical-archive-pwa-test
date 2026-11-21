/* CP08.18-C-CHROME: one new independent Chromium mobile touch-navigation diagnostic.
 * Purely synthetic / loopback; does NOT rerun the previous failed WebKit job.
 * iPhone 13 browser EMULATION, not actual iOS Safari or a Simulator.
 */
import {chromium,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const ROOT='http://127.0.0.1:8769/';
const VIEW=ROOT+'qa-hub/candidates/cp0818b-idb-viewer/index.html';
const SERVER=fileURLToPath(new URL('../../cp0818b-idb-viewer/qa/serve.mjs',import.meta.url));
const report={project:'PAE-06',checkpoint:'CP08.18-C-CHROME',
 browser:'Chromium Linux / iPhone 13 emulation',status:'NOT_RUN',
 physicalIPhone:'NOT_RUN',macSafari:'NOT_RUN',syntheticOnly:true,
 runCount:1,rerunCount:0,checks:[],metrics:[]};
let server,browser;
function check(ok,id,detail=null){
 report.checks.push({id,pass:!!ok,detail});
 if(!ok)throw Error('STOP_FIRST_'+id+(detail?'_'+JSON.stringify(detail).slice(0,200):''));
}
async function ready(){
 server=spawn(process.execPath,[SERVER],{stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  let completed=false,output='';
  const timer=setTimeout(()=>finish(Error('LOOPBACK_TIMEOUT')),15000);
  function finish(err){if(completed)return;completed=true;clearTimeout(timer);err?reject(err):resolve();}
  server.stdout.on('data',d=>{output+=d.toString();if(output.includes('CP0818B2_LOOPBACK_READY'))finish()});
  server.on('error',finish);server.on('exit',c=>finish(Error('SERVER_EXIT_'+c)));
 });
}
async function waitPass(page,needle){
 await page.waitForFunction(expected=>{
   const state=document.querySelector('#status')?.dataset.state;
   return state==='pass'&&document.querySelector('#pages')?.textContent?.includes(expected);
 },needle,{timeout:35000});
}
try{
 await ready();
 browser=await chromium.launch({headless:true});
 const phone=devices['iPhone 13'];
 if(!phone?.isMobile||!phone?.hasTouch)throw Error('PHONE_PROFILE_UNAVAILABLE');
 const ctx=await browser.newContext({...phone,viewport:{width:390,height:844},locale:'ru-RU'});
 try {
  const page=await ctx.newPage(),errors=[],navigations=[];
  page.on('pageerror',e=>errors.push(String(e.message).slice(0,160)));
  page.on('framenavigated',f=>{if(f===page.mainFrame())navigations.push(f.url())});
  await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#addA').tap();
  await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='1');
  await page.locator('#addB').tap();
  await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='2');
  await page.goto(VIEW+'?doc=qa-b&page=2',{waitUntil:'domcontentloaded'});
  await waitPass(page,'2 из 2');
  const metrics=await page.evaluate(()=>{
    const canvas=document.querySelector('#pageCanvas');
    const box=canvas.getBoundingClientRect();
    return {innerWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      canvasCssWidth:box.width,canvasPixels:[canvas.width,canvas.height],
      coarsePointer:matchMedia('(pointer:coarse)').matches};
  });
  report.metrics.push({orientation:'portrait',...metrics});
  check(metrics.innerWidth===390&&metrics.scrollWidth<=392&&metrics.canvasCssWidth<=390,
    'CHROME_PHONE_LAYOUT_NO_OVERFLOW',metrics);
  check(metrics.canvasPixels[0]>100&&metrics.canvasPixels[1]>100&&metrics.coarsePointer,
    'CHROME_PHONE_REAL_PDFJS_CANVAS',metrics);
  const prevHref=await page.locator('#prev').getAttribute('href');
  check(prevHref==='?doc=qa-b&page=1','CHROME_PREVIOUS_LINK_EXACT',prevHref);
  await page.locator('#prev').tap();
  await page.waitForURL(url=>url.searchParams.get('doc')==='qa-b'&&url.searchParams.get('page')==='1',{timeout:15000});
  await waitPass(page,'1 из 2');
  check((await page.locator('#pages').innerText()).includes('1 из 2'),
    'CHROME_TOUCH_PREVIOUS_WAIT_URL_AND_RENDER',{url:page.url(),navigations:navigations.slice(-3)});
  await page.locator('#next').tap();
  await page.waitForURL(url=>url.searchParams.get('doc')==='qa-b'&&url.searchParams.get('page')==='2',{timeout:15000});
  await waitPass(page,'2 из 2');
  check((await page.locator('#pages').innerText()).includes('2 из 2'),
    'CHROME_TOUCH_NEXT_WAIT_URL_AND_RENDER',{url:page.url(),navigations:navigations.slice(-3)});
  await page.setViewportSize({width:844,height:390});
  const landscape=await page.evaluate(()=>{
    return {innerWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      canvasCssWidth:document.querySelector('#pageCanvas').getBoundingClientRect().width};
  });
  report.metrics.push({orientation:'landscape',...landscape});
  check(landscape.innerWidth>=810&&landscape.scrollWidth<=landscape.innerWidth+2&&
    landscape.canvasCssWidth<=landscape.innerWidth,
    'CHROME_PHONE_LANDSCAPE_LAYOUT',landscape);
  await page.setViewportSize({width:390,height:844});
  await page.goto(VIEW+'?doc=qa-b&page=3',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='blocked',{timeout:35000});
  check((await page.locator('canvas').count())===0,'CHROME_BAD_PAGE_NO_CANVAS');
  await page.goto(VIEW+'?doc=qa-a&page=1',{waitUntil:'domcontentloaded'});
  await waitPass(page,'1 из 1');
  await page.locator('a.back').tap();
  await page.waitForURL(url=>url.pathname.endsWith('/index.html')&&url.search==='',{timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='2',{timeout:15000});
  check((await page.locator('#count').innerText())==='2','CHROME_TOUCH_RETURN_CATALOG_WITH_2_ROWS');
  check(errors.length===0,'CHROME_NO_PAGEERRORS',errors);
 }finally{await ctx.close();}
 report.status='PASS_SCOPED_CHROMIUM_MOBILE';
}catch(e){report.status='FAIL_STOP_FIRST';report.error=String(e?.stack||e).slice(0,800);process.exitCode=1;}
finally{
 if(browser)await browser.close();
 if(server){server.kill('SIGTERM');await new Promise(r=>{const t=setTimeout(r,2000);server.once('exit',()=>{clearTimeout(t);r()})})}
 console.log(JSON.stringify({...report,pass:report.checks.filter(x=>x.pass).length,total:report.checks.length},null,2));
}
