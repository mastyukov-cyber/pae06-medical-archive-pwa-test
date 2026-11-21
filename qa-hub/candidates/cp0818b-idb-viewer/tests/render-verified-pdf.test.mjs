import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderStoredPdf} from '../src/render-verified-pdf.mjs';
const SHA='3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982';
const src=new Uint8Array([37,80,68,70,45,49,46,48,10,10]).buffer;
const ok=()=>({status:'VERIFIED_READONLY',canDisplay:true,documentId:'qa-b',pageNumber:2,
 actualPages:2,sourceSha256:SHA,renderBytes:src.slice(0)});
function fixture(opts={}){
 const t={called:0,destroyed:0,rendered:0,pages:[],bytes:null};
 const pdf={numPages:opts.numPages??2,async getPage(n){t.pages.push(n);return {
   getViewport(){return {width:opts.width??420,height:opts.height??580}},
   render(){t.rendered++;return {promise:opts.renderError?Promise.reject(Error('RENDER_BAD')):Promise.resolve()}}
 }}};
 const pdfjs={GlobalWorkerOptions:{},getDocument(x){t.called++;t.bytes=x.data;return {promise:Promise.resolve(pdf),async destroy(){t.destroyed++}}}};
 const canvas={width:0,height:0,getContext(){return opts.contextFailure?null:{}}};
 return {t,pdfjs,canvas};
}
async function run(f,extra={}){return renderStoredPdf({verdict:ok(),pdfjs:f.pdfjs,canvas:f.canvas,
  workerSrc:'http://127.0.0.1:8769/pdf.worker.mjs',expectedSha:SHA,expectedPages:2,...extra})}
test('new integration: render QA-B page 2 and destroy PDF task',async()=>{
 const f=fixture();const x=await run(f);assert.equal(x.status,'RENDERED');assert.equal(x.pageNumber,2);
 assert.equal(f.canvas.width,420);assert.equal(f.canvas.height,580);assert.equal(f.t.rendered,1);
 assert.equal(f.t.destroyed,1);assert.deepEqual(f.t.pages,[2]);assert.equal(f.t.bytes.length,10);
 assert.notEqual(f.t.bytes.buffer,src);
});
test('new: pinned sha mismatch fails before PDF.js',async()=>{
 const f=fixture();await assert.rejects(run(f,{expectedSha:'0'.repeat(64)}),{message:'SOURCE_SHA_NOT_PINNED'});
 assert.equal(f.t.called,0);
});
test('new: unverified response never renders',async()=>{
 const f=fixture();await assert.rejects(run(f,{verdict:{...ok(),status:'REFUSED'}}),{message:'UNVERIFIED_SOURCE'});
 assert.equal(f.t.called,0);
});
test('new: forged page 3/2 is refused before rendering',async()=>{
 const f=fixture();await assert.rejects(run(f,{verdict:{...ok(),pageNumber:3}}),{message:'OUT_OF_RANGE_PAGELINK'});
 assert.equal(f.t.called,0);
});
test('new: stale PageLink actual pages refused before rendering',async()=>{
 const f=fixture();await assert.rejects(run(f,{verdict:{...ok(),actualPages:1}}),{message:'SOURCE_PAGECOUNT_NOT_PINNED'});
 assert.equal(f.t.called,0);
});
test('new: PDF.js independently changed page count is rejected',async()=>{
 const f=fixture({numPages:1});await assert.rejects(run(f),{message:'PDF_RENDER_PAGECOUNT_DRIFT'});
 assert.equal(f.t.rendered,0);assert.equal(f.t.destroyed,1);
});
test('new: unexpectedly huge canvas refused',async()=>{
 const f=fixture({width:4900,height:1900});await assert.rejects(run(f),{message:'PDF_VIEWPORT_LIMIT'});
 assert.equal(f.t.rendered,0);assert.equal(f.t.destroyed,1);
});
test('new: missing context rejected, PDF task destroyed',async()=>{
 const f=fixture({contextFailure:true});await assert.rejects(run(f),{message:'CANVAS_CONTEXT_UNAVAILABLE'});
 assert.equal(f.t.rendered,0);assert.equal(f.t.destroyed,1);
});
test('new: failed page render rejected, PDF task destroyed',async()=>{
 const f=fixture({renderError:true});await assert.rejects(run(f),{message:'RENDER_BAD'});
 assert.equal(f.t.destroyed,1);
});
test('new: invalid verified bytes rejected before parsing',async()=>{
 const f=fixture();await assert.rejects(run(f,{verdict:{...ok(),renderBytes:new ArrayBuffer(0)}}),{message:'INVALID_VERIFIED_BYTES'});
 assert.equal(f.t.called,0);
});
test('new: invalid canvas scale fails preflight',async()=>{
 const f=fixture();await assert.rejects(run(f,{scale:3}),{message:'INVALID_SCALE'});
 assert.equal(f.t.called,0);
});
test('new: exact safe PDF.js options and source copy',async()=>{
 const f=fixture();await run(f);assert.equal(f.t.called,1);
 assert.equal(f.pdfjs.GlobalWorkerOptions.workerSrc,'http://127.0.0.1:8769/pdf.worker.mjs');
});
