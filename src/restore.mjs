/* PAE-06 CP08.15 — unshipped SYNTHETIC ONLY backup restore candidate.
 * No UI integration. No production/clinical use. No automatic import/overwrite/delete.
 * Formats pinned to exact published PAE-06 CP08.14 JSON export.
 */
const FORMAT = 'PAE06-CP082-SYNTHETIC-EXPORT-ONLY';
const DB_NAME = 'pae06_cp082_synthetic_only';
const FIXTURES = Object.freeze({
  'qa-a': Object.freeze({title:'QA-A · Учебный документ',sha256:'4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153'}),
  'qa-b': Object.freeze({title:'QA-B · Двухстраничный документ',sha256:'3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982'})
});
const MAX_JSON_BYTES = 3_000_000;
const MAX_DOCUMENT_BYTES = 1_048_576;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const ROW_FIELDS=['id','title','sha256','sourceEncoding','sourceBytes','syntheticOnly','createdAt'];

export class RestoreRefusal extends Error {
  constructor(code) { super(code); this.name='RestoreRefusal'; this.code=code; }
}
const refuse = code => { throw new RestoreRefusal(code); };
const isRecord = x => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const exact = (x, fields) => isRecord(x) && Object.keys(x).length===fields.length && fields.every(k=>Object.hasOwn(x,k));
function equalBytes(a,b){
  if (!(a instanceof ArrayBuffer) || !(b instanceof ArrayBuffer) || a.byteLength!==b.byteLength) return false;
  const x=new Uint8Array(a),y=new Uint8Array(b);
  for(let i=0;i<x.length;i++) if(x[i]!==y[i]) return false;
  return true;
}
async function digest(bytes){
  if(!globalThis.crypto?.subtle) refuse('WEBCRYPTO_UNAVAILABLE');
  const arr = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes));
  return Array.from(arr,b=>b.toString(16).padStart(2,'0')).join('');
}
function validTimestamp(x){
  if(typeof x!=='string'||!ISO_UTC.test(x)) return false;
  const d=new Date(x);return Number.isFinite(d.getTime())&&d.toISOString()===x;
}
function decodeBase64(value){
  if(typeof value!=='string'||value.length>Math.ceil(MAX_DOCUMENT_BYTES/3)*4+4||!B64.test(value))refuse('BASE64_INVALID');
  let raw;try{raw=atob(value);}catch{refuse('BASE64_INVALID');}
  if(raw.length<10||raw.length>MAX_DOCUMENT_BYTES)refuse('DOCUMENT_SIZE_INVALID');
  if(btoa(raw)!==value)refuse('BASE64_NONCANONICAL');
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')refuse('PDF_MAGIC_INVALID');
  return bytes.buffer;
}
export async function parseBackup(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>MAX_JSON_BYTES)refuse('BACKUP_SIZE_INVALID');
  let obj;try{obj=JSON.parse(text);}catch{refuse('JSON_INVALID');}
  if(!exact(obj,['format','version','clinicalAuthority','docs']))refuse('BACKUP_SCHEMA_INVALID');
  if(obj.format!==FORMAT||obj.version!==1||obj.clinicalAuthority!==false)refuse('BACKUP_AUTHORITY_INVALID');
  if(!Array.isArray(obj.docs)||obj.docs.length>2)refuse('DOCUMENT_COUNT_INVALID');
  const docs=[],ids=new Set();
  for(const rec of obj.docs){
    if(!exact(rec,['id','sha256','sourceEncoding','bytesBase64','syntheticOnly']))refuse('DOCUMENT_SCHEMA_INVALID');
    if(rec.syntheticOnly!==true||rec.sourceEncoding!=='arraybuffer-v1')refuse('DOCUMENT_SCOPE_INVALID');
    const fixture=FIXTURES[rec.id];
    if(!fixture||fixture.sha256!==rec.sha256)refuse('DOCUMENT_ID_SHA_NOT_ALLOWLISTED');
    if(ids.has(rec.id))refuse('DOCUMENT_DUPLICATE_ID');
    ids.add(rec.id);
    const bytes=decodeBase64(rec.bytesBase64);
    if(await digest(bytes)!==fixture.sha256)refuse('DOCUMENT_SHA_MISMATCH');
    docs.push({id:rec.id,sha256:fixture.sha256,sourceBytes:bytes,sourceEncoding:'arraybuffer-v1',title:fixture.title,syntheticOnly:true});
  }
  return docs;
}
async function validateExisting(rows){
  if(!Array.isArray(rows)||rows.length>2)refuse('EXISTING_COLLECTION_INVALID');
  const checked=[],ids=new Set();
  for(const row of rows){
    if(!exact(row,ROW_FIELDS)||typeof row.id!=='string'||ids.has(row.id))refuse('EXISTING_ROW_INVALID');
    ids.add(row.id);
    const f=FIXTURES[row.id];
    if(!f||row.sha256!==f.sha256||row.title!==f.title||row.syntheticOnly!==true||row.sourceEncoding!=='arraybuffer-v1'||!validTimestamp(row.createdAt)||!(row.sourceBytes instanceof ArrayBuffer)||row.sourceBytes.byteLength<10||row.sourceBytes.byteLength>MAX_DOCUMENT_BYTES)refuse('EXISTING_ROW_QUARANTINED');
    if(await digest(row.sourceBytes)!==f.sha256)refuse('EXISTING_ROW_SHA_MISMATCH');
    checked.push({id:row.id,title:row.title,sha256:row.sha256,syntheticOnly:true,sourceEncoding:row.sourceEncoding,createdAt:row.createdAt,sourceBytes:row.sourceBytes.slice(0)});
  }
  return checked;
}
function sameSnapshot(current,snapshot){
  if(!Array.isArray(current)||current.length!==snapshot.length) return false;
  const byId=new Map(snapshot.map(x=>[x.id,x]));
  const seen=new Set();
  for(const row of current){
    if(!exact(row,ROW_FIELDS)||seen.has(row.id))return false;
    seen.add(row.id);
    const old=byId.get(row?.id);
    if(!old||row.title!==old.title||row.sha256!==old.sha256||row.syntheticOnly!==old.syntheticOnly||row.sourceEncoding!==old.sourceEncoding||row.createdAt!==old.createdAt||!equalBytes(row.sourceBytes,old.sourceBytes))return false;
  }
  return true;
}
function checkDb(db){
  if(!db||db.name!==DB_NAME||db.version!==1||!db.objectStoreNames?.contains?.('documents')||typeof db.transaction!=='function')refuse('DATABASE_SCOPE_DENIED');
}
function readRows(db){
  return new Promise((resolve,reject)=>{
    let tx;try{tx=db.transaction('documents','readonly');}catch{reject(new RestoreRefusal('DATABASE_READ_DENIED'));return;}
    let result=null,done=false;
    tx.oncomplete=()=>{if(!done){done=true;resolve(result);}};
    tx.onabort=()=>{if(!done){done=true;reject(new RestoreRefusal('DATABASE_READ_ABORT'));}};
    tx.onerror=()=>{};
    const readFail=()=>{if(!done){done=true;reject(new RestoreRefusal('DATABASE_READ_REQUEST_FAILED'));}try{tx.abort();}catch{}};
    let req;try{req=tx.objectStore('documents').getAll();}catch{readFail();return;}
    req.onsuccess=()=>{result=req.result;};
    req.onerror=readFail;
  });
}
async function previewSeal(backupText,docs,snapshot){
  const rows=snapshot.map(r=>({id:r.id,title:r.title,sha256:r.sha256,sourceEncoding:r.sourceEncoding,syntheticOnly:r.syntheticOnly,createdAt:r.createdAt})).sort((a,b)=>a.id.localeCompare(b.id));
  const input=JSON.stringify({backupText,docs:docs.map(d=>({id:d.id,sha256:d.sha256})),rows});
  return digest(new TextEncoder().encode(input));
}
export async function previewRestore(backupText,db){
  checkDb(db);
  const docs=await parseBackup(backupText);
  const current=await validateExisting(await readRows(db));
  const known=new Map(current.map(r=>[r.id,r]));
  const additions=docs.filter(d=>!known.has(d.id));
  return {acceptedDocs:docs.length,alreadyPresent:docs.length-additions.length,wouldAdd:additions.map(x=>x.id),wouldOverwrite:0,wouldDelete:0,previewToken:await previewSeal(backupText,docs,current)};
}
export async function commitSyntheticRestore(backupText,db,{sandboxPermission=false,confirmation='',previewToken=null}={}){
  // The calling context must separately assert an isolated synthetic QA environment.
  // Backup metadata is never trusted as authorization to write.
  if(sandboxPermission!==true||confirmation!=='RESTORE_ONLY_PINNED_QA_FIXTURES')refuse('CONFIRMATION_REQUIRED');
  if(typeof previewToken!=='string'||!/^[a-f0-9]{64}$/.test(previewToken))refuse('PREVIEW_REQUIRED');
  checkDb(db);
  const docs=await parseBackup(backupText);
  const snapshot=await validateExisting(await readRows(db));
  if(await previewSeal(backupText,docs,snapshot)!==previewToken)refuse('PREVIEW_STALE');
  const present=new Map(snapshot.map(r=>[r.id,r]));
  const additions=docs.filter(d=>!present.has(d.id));
  if(!additions.length)return {inserted:0,alreadyPresent:docs.length,atomic:true};
  const now=new Date().toISOString();
  const records=additions.map(d=>({...d,sourceBytes:d.sourceBytes.slice(0),createdAt:now}));
  await new Promise((resolve,reject)=>{
    let tx;try{tx=db.transaction('documents','readwrite');}catch{reject(new RestoreRefusal('DATABASE_WRITE_DENIED'));return;}
    let rejection=null,settled=false;
    const fail=(code)=>{rejection=new RestoreRefusal(code);try{tx.abort();}catch{if(!settled){settled=true;reject(rejection);}}};
    tx.oncomplete=()=>{if(!settled){settled=true;resolve();}};
    tx.onabort=()=>{if(!settled){settled=true;reject(rejection||new RestoreRefusal('DATABASE_TRANSACTION_ABORT'));}};
    tx.onerror=()=>{};
    let req;try{req=tx.objectStore('documents').getAll();}catch{fail('DATABASE_TRANSACTION_READ_FAIL');return;}
    req.onerror=()=>fail('DATABASE_TRANSACTION_READ_FAIL');
    req.onsuccess=()=>{
      if(!sameSnapshot(req.result,snapshot)){fail('CONCURRENT_CHANGE_ABORTED');return;}
      try{const store=tx.objectStore('documents');for(const item of records)store.add(item);}catch{fail('DATABASE_TRANSACTION_ADD_FAIL');}
    };
  });
  // After completion, never claim readback success if concurrent changes occur.
  // The write transaction has already committed. A failed verification is
  // INDETERMINATE, not proof that the database was left unchanged.
  let reread;
  try { reread=await validateExisting(await readRows(db)); }
  catch { refuse('POST_COMMIT_UNVERIFIED'); }
  if(!records.every(x=>reread.some(y=>y.id===x.id&&equalBytes(y.sourceBytes,x.sourceBytes))))refuse('POST_COMMIT_UNVERIFIED');
  return {inserted:records.length,alreadyPresent:docs.length-records.length,atomic:true,verifiedReadback:true};
}
export const contract=Object.freeze({format:FORMAT,dbName:DB_NAME,maxJsonBytes:MAX_JSON_BYTES,maxDocumentBytes:MAX_DOCUMENT_BYTES,allowlistedIds:Object.freeze(Object.keys(FIXTURES))});
