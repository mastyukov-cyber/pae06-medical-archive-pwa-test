/* CP08.18-B2: localhost allowlist, intended for one future approved Linux WebKit run. */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const ROOT=resolve(fileURLToPath(new URL('../../../../',import.meta.url)));
const NEW='/qa-hub/candidates/cp0818b-idb-viewer/';
const OLD='/qa-hub/candidates/cp0818-pagelink/';
const map=new Map();
const add=(name,type)=>map.set(name,type);
const JS='text/javascript; charset=utf-8',HTML='text/html; charset=utf-8';
for(const p of ['index.html','ui.css','entry.mjs','src/idb-readonly-bridge.mjs','src/render-verified-pdf.mjs'])
 add(NEW+p,p.endsWith('.html')?HTML:p.endsWith('.css')?'text/css; charset=utf-8':JS);
for(const p of ['src/pdf-page-link.mjs','vendor/pdfjs/pdf.mjs','vendor/pdfjs/pdf.worker.mjs'])add(OLD+p,JS);
for(const p of ['index.html','style.css','app.js','catalog.js','mac-derived-adapter.mjs',
 'mac-preview.mjs','mac-bridge.mjs','mac-bridge-view.mjs','release.json','manifest.webmanifest',
 'restore-test.html','restore-test.css','restore-test.mjs','src/restore.mjs','src/test-idb-gate.mjs',
 'qa/qa_public_key.json','qa/signed_transfer.json','tests/fixtures/synthetic_export.json',
 'assets/qa-a-page-1.webp','assets/qa-b-page-1.webp','assets/qa-b-page-2.webp',
 'icon-192.png','icon-512.png'])
 add('/'+p,p.endsWith('.html')?HTML:p.endsWith('.css')?'text/css; charset=utf-8':
 p.endsWith('.json')?'application/json':p.endsWith('.png')?'image/png':
 p.endsWith('.webp')?'image/webp':p.endsWith('.webmanifest')?'application/manifest+json':JS);
for(const p of ['PAE06_QA_A_1_PAGE.pdf','PAE06_QA_B_2_PAGES.pdf'])add('/fixtures/'+p,'application/pdf');
add('/',HTML);
const server=http.createServer(async(req,res)=>{
 try{
   if(req.method!=='GET'){res.writeHead(405);res.end('Method not allowed');return}
   const pathname=new URL(req.url,'http://127.0.0.1').pathname;
   if(!map.has(pathname)){res.writeHead(404);res.end('Not found');return}
   const name=pathname==='/'?'index.html':pathname.slice(1);
   const full=join(ROOT,name);if(!full.startsWith(ROOT+'/'))throw Error('OUTSIDE_ROOT');
   const bytes=await readFile(full);
   res.writeHead(200,{'Content-Type':map.get(pathname),'Content-Length':bytes.length,
     'Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff'});
   res.end(bytes);
 }catch{res.writeHead(500);res.end('QA read refused')}
});
server.listen(8769,'127.0.0.1',()=>console.log('CP0818B2_LOOPBACK_READY'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
