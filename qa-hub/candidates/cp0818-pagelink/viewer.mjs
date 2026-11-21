/* PAE-06 CP08.18-A: browser display of pinned synthetic Mac QA PDFs only.
 * No IndexedDB, localStorage, external calls, real Mac files or migrations. */
import {verifyPageLink} from './src/pdf-page-link.mjs';
import * as pdfjs from './vendor/pdfjs/pdf.mjs';
import {classifyBatch,makeSyntheticFixture} from '../../../mac-derived-adapter.mjs';

const FROZEN=Object.freeze({
  'qa-a':Object.freeze({id:'qa-a',source:'SYNTHETIC_MAC_QA_A',name:'QA-A · Учебный документ',sha:'4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153',file:'../../../fixtures/PAE06_QA_A_1_PAGE.pdf',pages:1}),
  'qa-b':Object.freeze({id:'qa-b',source:'SYNTHETIC_MAC_QA_B',name:'QA-B · Двухстраничный документ',sha:'3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982',file:'../../../fixtures/PAE06_QA_B_2_PAGES.pdf',pages:2})
});
const ALLOWED=Object.freeze({'qa-a':FROZEN['qa-a'].sha,'qa-b':FROZEN['qa-b'].sha});
const $=id=>document.getElementById(id);
function refuse(reason){$('status').dataset.state='blocked';$('status').textContent='ОТКАЗ: '+reason;$('title').textContent='Документ не открыт';$('gate').textContent='Карантин';$('pages').textContent='Страница отклонена';$('canvasbox').replaceChildren();$('sha').textContent='—';$('prev').setAttribute('aria-disabled','true');$('next').setAttribute('aria-disabled','true');}
function urlFor(doc,page){return '?doc='+encodeURIComponent(doc)+'&page='+page;}
function strictLink(){const q=new URLSearchParams(location.search),keys=[...q.keys()];if(keys.length===0)return {documentId:'qa-a',pageNumber:1};if(keys.length!==2||keys[0]!=='doc'||keys[1]!=='page')throw Error('PAGELINK_PARAMETERS_INVALID');const id=q.get('doc'),p=q.get('page');if(!Object.hasOwn(FROZEN,id)||!/^[1-9][0-9]*$/.test(p)||p.length>3)throw Error('PAGELINK_VALUE_INVALID');return {documentId:id,pageNumber:Number(p)};}
async function main(){
 let link;try{link=strictLink();}catch(e){refuse(e.message);return;}
 const f=FROZEN[link.documentId];$('title').textContent=f.name;
 $('link-a').setAttribute('aria-current',f.id==='qa-a'?'page':'false');$('link-b').setAttribute('aria-current',f.id==='qa-b'?'page':'false');
 const batch=classifyBatch([makeSyntheticFixture('A'),makeSyntheticFixture('B')]);
 if(batch.quarantined.length!==0||batch.accepted.length!==2){refuse('SYNTHETIC_MAC_CARD_GATE');return;}
 const card=batch.accepted.find(x=>x.sourceDocumentId===f.source);
 if(!card||card.originalSha256!==f.sha||card.pageCount!==f.pages||card.syntheticOnly!==true||card.clinicalAuthority!==false){refuse('SYNTHETIC_MAC_CARD_MISMATCH');return;}
 let response,bytes;try{response=await fetch(f.file,{cache:'no-store'});if(!response.ok)throw Error('FIXTURE_NOT_FOUND');const len=response.headers.get('content-length');if(len&&Number(len)>1024*1024)throw Error('FILE_TOO_LARGE');bytes=await response.arrayBuffer();}catch(e){refuse('SOURCE_FETCH_FAILED');return;}
 const record={id:f.id,sha256:f.sha,sourceEncoding:'arraybuffer-v1',sourceBytes:bytes,syntheticOnly:true};
 const verdict=await verifyPageLink({record,link:{...link,sha256:f.sha},allowed:ALLOWED});
 if(verdict.status!=='VERIFIED_READONLY'){refuse(verdict.reason||'UNVERIFIED_PDF');return;}
 if(verdict.actualPages!==f.pages){refuse('MAC_PDF_PREVIEW_PAGECOUNT_MISMATCH');return;}
 let task;
 try{
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  task=pdfjs.getDocument({data:new Uint8Array(bytes.slice(0)),isEvalSupported:false,disableAutoFetch:true,disableStream:true,stopAtErrors:true,useSystemFonts:false});
  const pdf=await task.promise;
  if(pdf.numPages!==verdict.actualPages)throw Error('PDF_RENDER_PAGECOUNT_DRIFT');
  const page=await pdf.getPage(link.pageNumber),vp=page.getViewport({scale:1.35});
  if(!Number.isFinite(vp.width)||!Number.isFinite(vp.height)||vp.width<=0||vp.height<=0||vp.width*vp.height>6_000_000)throw Error('INVALID_PDF_VIEWPORT');
  const canvas=$('pageCanvas'),ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('NO_CANVAS_CONTEXT');
  canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
  await page.render({canvasContext:ctx,canvas,viewport:vp}).promise;
  canvas.style.display='block';
  $('pages').textContent='Страница '+link.pageNumber+' из '+pdf.numPages;
  $('sha').textContent=verdict.sourceSha256;
  $('origin').textContent='Синтетический Mac QA · ArrayBuffer · без записи';
  $('gate').textContent='PDF.js · SHA-256 PASS';
  $('status').dataset.state='pass';$('status').textContent='Проверен оригинальный PDF · '+canvas.width+' × '+canvas.height+' пикселей';
  for(const [id,p] of [['prev',link.pageNumber-1],['next',link.pageNumber+1]]){
    const el=$(id),ok=p>=1&&p<=pdf.numPages;
    el.setAttribute('aria-disabled',String(!ok));
    if(ok)el.href=urlFor(f.id,p);else el.removeAttribute('href');
  }
 }catch(e){refuse('PDF_RENDER_FAILED');console.warn('CP08.18 synthetic render refused:',String(e?.message||e).slice(0,120));}
 finally{if(task){try{await task.destroy();}catch{}}}
}
void main().catch(()=>refuse('UNEXPECTED_TEST_REFUSAL'));
