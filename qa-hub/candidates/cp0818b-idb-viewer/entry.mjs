/* CP08.18-B2: synthetic same-origin TEST viewer; no IDB or service worker writes. */
import {verifyExistingQaPage,QA_SHA} from './src/idb-readonly-bridge.mjs';
import {renderStoredPdf} from './src/render-verified-pdf.mjs';
import {verifyPageLink} from '../cp0818-pagelink/src/pdf-page-link.mjs';
import * as pdfjs from '../cp0818-pagelink/vendor/pdfjs/pdf.mjs';
const QA_PAGES=Object.freeze({'qa-a':1,'qa-b':2});
const QA_NAMES=Object.freeze({'qa-a':'QA-A · Учебный документ','qa-b':'QA-B · Двухстраничный документ'});
const $=id=>document.getElementById(id);
function refuse(reason){
 $('status').dataset.state='blocked';$('status').textContent='ОТКАЗ: '+String(reason||'UNVERIFIED').slice(0,100);
 $('title').textContent='Документ не открыт';$('gate').textContent='Карантин';
 $('pages').textContent='Страница отклонена';$('sha').textContent='—';
 $('canvasbox').replaceChildren();
 for(const id of ['prev','next']){const el=$(id);el.removeAttribute('href');el.setAttribute('aria-disabled','true')}
}
function href(id,page){return '?doc='+encodeURIComponent(id)+'&page='+page}
async function main(){
 const verdict=await verifyExistingQaPage({search:location.search,idb:indexedDB,verifyPageLink});
 if(verdict.status!=='VERIFIED_READONLY'||verdict.canDisplay!==true){refuse(verdict.reason);return}
 const id=verdict.documentId;
 if(!Object.hasOwn(QA_PAGES,id)||verdict.sourceSha256!==QA_SHA[id]){refuse('UNKNOWN_ID_SHA');return}
 const rendered=await renderStoredPdf({verdict,pdfjs,canvas:$('pageCanvas'),
   expectedSha:QA_SHA[id],expectedPages:QA_PAGES[id],
   workerSrc:new URL('../cp0818-pagelink/vendor/pdfjs/pdf.worker.mjs',import.meta.url).href});
 $('pageCanvas').style.display='block';$('title').textContent=QA_NAMES[id];
 $('status').dataset.state='pass';$('status').textContent='Оригинал из существующей IndexedDB проверен · PDF.js';
 $('gate').textContent='Только чтение · SHA-256 PASS';
 $('pages').textContent='Страница '+rendered.pageNumber+' из '+rendered.actualPages;
 $('sha').textContent=rendered.sourceSha256;
 for(const [key,p] of [['prev',rendered.pageNumber-1],['next',rendered.pageNumber+1]]){
   const el=$(key),ok=p>=1&&p<=rendered.actualPages;
   el.setAttribute('aria-disabled',String(!ok));
   if(ok)el.setAttribute('href',href(id,p));else el.removeAttribute('href');
 }
}
void main().catch(error=>refuse(error?.message||'UNEXPECTED_REFUSAL'));
