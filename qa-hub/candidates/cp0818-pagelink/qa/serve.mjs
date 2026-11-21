/* CP08.18-A isolated same-origin loopback server. Exact static allowlist only. */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const ROOT=resolve(fileURLToPath(new URL('../../../../',import.meta.url)));
const BASE='/qa-hub/candidates/cp0818-pagelink/';
const allow=new Map([
 ['index.html','text/html; charset=utf-8'],['ui.css','text/css; charset=utf-8'],['viewer.mjs','text/javascript; charset=utf-8'],
 ['src/pdf-page-link.mjs','text/javascript; charset=utf-8'],['vendor/pdfjs/pdf.mjs','text/javascript; charset=utf-8'],
 ['vendor/pdfjs/pdf.worker.mjs','text/javascript; charset=utf-8']
].map(([n,t])=>[BASE+n,t]));
allow.set('/mac-derived-adapter.mjs','text/javascript; charset=utf-8');
for(const p of ['PAE06_QA_A_1_PAGE.pdf','PAE06_QA_B_2_PAGES.pdf'])allow.set('/fixtures/'+p,'application/pdf');
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method!=='GET'||!allow.has(new URL(req.url,'http://127.0.0.1').pathname)){res.writeHead(404);res.end('Not found');return;}
  const pathname=new URL(req.url,'http://127.0.0.1').pathname,filename=join(ROOT,pathname.slice(1));
  if(!filename.startsWith(ROOT+'/'))throw Error('OUTSIDE_ROOT');
  const bytes=await readFile(filename);res.writeHead(200,{'Content-Type':allow.get(pathname),'Content-Length':bytes.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin'});res.end(bytes);
 }catch(e){res.writeHead(500);res.end('Read refused');}
});
const PORT=8768;server.listen(PORT,'127.0.0.1',()=>console.log(JSON.stringify({status:'CP0818_LOOPBACK_READY',port:PORT})));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));
