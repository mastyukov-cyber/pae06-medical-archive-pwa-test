/* PAE-06 CP08.21. Fail-closed SYNTHETIC-only lab handoff.
 * No network, persistence, real Mac attestation, PDF access or clinical inference.
 */
export const CONTRACT='pae06.synthetic.lab-results.v1';
const CODES=new Set(['hb','glucose','creatinine','crp','ferritin','vitd']);
const TOP=['schema','channel','syntheticOnly','readOnly','patientBinding','producer','generatedAt','records'];
const ROW=['id','code','value','unit','method','specimen','lab','collectedOn','reference','source','status','syntheticOnly'];
const REF=['low','high','unit'];
const SRC=['kind','documentId','reviewedOn','revision','originalSha256'];
const SHA=/^[a-f0-9]{64}$/;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&[Object.prototype,null].includes(Object.getPrototypeOf(o));
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>own(o,k));
const txt=(x)=>typeof x==='string'&&x.trim()===x&&x.length>0&&x.length<=120&&!/[\u0000-\u001f]/.test(x);
const ymd=x=>{
 if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
 const d=new Date(x+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x;
};
const time=x=>typeof x==='string'&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString()===x;
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1000000;
const flags=Object.freeze({syntheticOnly:true,realMacIdentityVerified:false,originalPdfBytesVerified:false,clinicalAuthority:false});
const deny=(reason)=>Object.freeze({ok:false,reason,accepted:Object.freeze([]),quarantined:Object.freeze([]),evidence:flags});

export function validateSyntheticRow(r){
 if(!exact(r,ROW))return 'ROW_FIELDS_NOT_EXACT';
 if(r.syntheticOnly!==true||r.status!=='human-confirmed'||r.source?.kind!=='mac-human-reviewed')return 'NOT_SYNTHETIC_REVIEWED';
 if(!txt(r.id)||!/^demo-[a-z0-9-]+$/.test(r.id))return 'INVALID_SYNTHETIC_ID';
 if(!CODES.has(r.code))return 'UNKNOWN_ANALYTE';
 if(!finite(r.value))return 'INVALID_VALUE';
 if(!txt(r.unit)||!txt(r.method)||!txt(r.specimen)||!txt(r.lab))return 'INVALID_METADATA';
 if(!ymd(r.collectedOn))return 'INVALID_COLLECTION_DATE';
 if(!exact(r.reference,REF)||!finite(r.reference.low)||!finite(r.reference.high)||r.reference.low>r.reference.high||r.reference.unit!==r.unit)return 'INVALID_REFERENCE';
 if(!exact(r.source,SRC))return 'SOURCE_FIELDS_NOT_EXACT';
 if(!/^demo-doc-[a-z0-9-]+$/.test(r.source.documentId))return 'INVALID_SYNTHETIC_DOCUMENT';
 if(!ymd(r.source.reviewedOn)||r.source.reviewedOn<r.collectedOn)return 'INVALID_REVIEW_DATE';
 if(!Number.isSafeInteger(r.source.revision)||r.source.revision<1||r.source.revision>999)return 'INVALID_REVISION';
 if(typeof r.source.originalSha256!=='string'||!SHA.test(r.source.originalSha256))return 'INVALID_HASH_LABEL';
 return null;
}
function copyRow(r){
 return Object.freeze({id:r.id,code:r.code,value:r.value,unit:r.unit,method:r.method,specimen:r.specimen,lab:r.lab,
  collectedOn:r.collectedOn,reference:Object.freeze({low:r.reference.low,high:r.reference.high,unit:r.reference.unit}),
  source:Object.freeze({kind:r.source.kind,documentId:r.source.documentId,reviewedOn:r.source.reviewedOn,
    revision:r.source.revision,originalSha256:r.source.originalSha256}),status:r.status,syntheticOnly:true});
}
export function classifySyntheticLabEnvelope(payload){
 if(!exact(payload,TOP))return deny('ENVELOPE_FIELDS_NOT_EXACT');
 if(payload.schema!==CONTRACT||payload.channel!=='TEST'||payload.syntheticOnly!==true||payload.readOnly!==true||
  payload.patientBinding!=='UNVERIFIED'||payload.producer!=='PAE06_SYNTHETIC_QA')return deny('NOT_AUTHORIZED_TEST_ENVELOPE');
 if(!time(payload.generatedAt))return deny('INVALID_GENERATED_AT');
 if(!Array.isArray(payload.records)||payload.records.length>200)return deny('INVALID_RECORD_BATCH');
 const accepted=[],quarantined=[],seen=new Set();
 payload.records.forEach((r,i)=>{
  let reason=validateSyntheticRow(r);
  if(!reason&&seen.has(r.id))reason='DUPLICATE_ID';
  if(reason){quarantined.push(Object.freeze({index:i,reason}));return;}
  seen.add(r.id);accepted.push(copyRow(r));
 });
 accepted.sort((a,b)=>a.collectedOn.localeCompare(b.collectedOn)||a.code.localeCompare(b.code)||a.id.localeCompare(b.id));
 return Object.freeze({ok:true,reason:null,accepted:Object.freeze(accepted),quarantined:Object.freeze(quarantined),evidence:flags});
}
export function compareDateResults(a,b){
 if(!a||!b)return Object.freeze({comparable:false,reason:'MISSING_RESULT'});
 if(validateSyntheticRow(a)||validateSyntheticRow(b))return Object.freeze({comparable:false,reason:'UNVERIFIED_RESULT'});
 if(a.collectedOn===b.collectedOn)return Object.freeze({comparable:false,reason:'SAME_DATE'});
 if(a.code!==b.code)return Object.freeze({comparable:false,reason:'DIFFERENT_ANALYTE'});
 if(a.unit!==b.unit)return Object.freeze({comparable:false,reason:'INCOMPATIBLE_UNIT'});
 if(a.method!==b.method)return Object.freeze({comparable:false,reason:'INCOMPATIBLE_METHOD'});
 if(a.specimen!==b.specimen)return Object.freeze({comparable:false,reason:'INCOMPATIBLE_SPECIMEN'});
 return Object.freeze({comparable:true,delta:a.value-b.value,unit:a.unit,dates:Object.freeze([a.collectedOn,b.collectedOn])});
}
