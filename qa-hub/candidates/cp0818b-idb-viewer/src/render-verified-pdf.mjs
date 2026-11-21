/* CP08.18-B2: render only AFTER frozen IndexedDB -> PageLink verifies the original bytes.
 * Pure, dependency-injected for NEW narrow synthetic renderer QA. No persistence.
 */
const fail=code=>{throw new Error(code)};
export async function renderStoredPdf({verdict,pdfjs,canvas,workerSrc,expectedSha,expectedPages,scale=1.35}={}){
 if(!verdict||verdict.status!=='VERIFIED_READONLY'||verdict.canDisplay!==true)
   fail('UNVERIFIED_SOURCE');
 if(typeof expectedSha!=='string'||verdict.sourceSha256!==expectedSha)
   fail('SOURCE_SHA_NOT_PINNED');
 if(!Number.isInteger(expectedPages)||expectedPages<1||expectedPages>5||
    verdict.actualPages!==expectedPages)fail('SOURCE_PAGECOUNT_NOT_PINNED');
 if(!Number.isInteger(verdict.pageNumber)||verdict.pageNumber<1||verdict.pageNumber>expectedPages)
   fail('OUT_OF_RANGE_PAGELINK');
 if(!(verdict.renderBytes instanceof ArrayBuffer)||verdict.renderBytes.byteLength<10||
    verdict.renderBytes.byteLength>1024*1024)fail('INVALID_VERIFIED_BYTES');
 if(!pdfjs||typeof pdfjs.getDocument!=='function'||!pdfjs.GlobalWorkerOptions||
    typeof workerSrc!=='string'||!workerSrc.length)fail('PDFJS_UNAVAILABLE');
 if(!canvas||typeof canvas.getContext!=='function')fail('CANVAS_UNAVAILABLE');
 if(!Number.isFinite(scale)||scale<0.5||scale>2)fail('INVALID_SCALE');
 let task;
 try {
   pdfjs.GlobalWorkerOptions.workerSrc=workerSrc;
   // Only a copy is handed to PDF.js; the already verified original remains untouched.
   task=pdfjs.getDocument({data:new Uint8Array(verdict.renderBytes.slice(0)),isEvalSupported:false,
     disableAutoFetch:true,disableStream:true,stopAtErrors:true,useSystemFonts:false});
   const pdf=await task.promise;
   if(!pdf||pdf.numPages!==expectedPages)fail('PDF_RENDER_PAGECOUNT_DRIFT');
   const page=await pdf.getPage(verdict.pageNumber);
   const viewport=page.getViewport({scale});
   if(!viewport||![viewport.width,viewport.height].every(Number.isFinite)||
      viewport.width<=0||viewport.height<=0)fail('INVALID_PDF_VIEWPORT');
   const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
   if(width*height>6_000_000||width>6000||height>6000)fail('PDF_VIEWPORT_LIMIT');
   const context=canvas.getContext('2d',{alpha:false});
   if(!context)fail('CANVAS_CONTEXT_UNAVAILABLE');
   canvas.width=width;canvas.height=height;
   await page.render({canvasContext:context,canvas,viewport}).promise;
   return Object.freeze({status:'RENDERED',pageNumber:verdict.pageNumber,
     actualPages:pdf.numPages,width,height,sourceSha256:verdict.sourceSha256});
 }finally{if(task){try{await task.destroy()}catch{/* cleanup must not mask source error */}}}
}
