// PAE-06 CP08.6 — isolated preview-only synthetic Mac -> PWA adapter.
// This is NOT the live Shared Gateway contract, nor a clinical verifier.
export const SCHEMA="pae06.synthetic.derived-card.v1";
const SHA64=/^[a-f0-9]{64}$/;
const FROZEN=Object.freeze({
  "SYNTHETIC_MAC_QA_A": Object.freeze({key:"QA-A",title:"QA-A · Учебный документ",pages:1,sha256:"4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153"}),
  "SYNTHETIC_MAC_QA_B": Object.freeze({key:"QA-B",title:"QA-B · Двухстраничный документ",pages:2,sha256:"3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982"})
});
const REQUIRED=Object.freeze(["schema","syntheticOnly","sourceSystem","sourceDocumentId","sourceRevision","originalSha256","previewPageCount","title","documentDate","patientMapping","reviewStatus","labStatus","readOnly"]);
const PATIENT=Object.freeze(["status","patientId"]);
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const plain=o=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>own(o,k));
function canonicalDate(s){
  if(s===null)return true;
  if(typeof s!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s))return false;
  const d=new Date(s+"T00:00:00Z");
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function deny(reason){return {ok:false,reason};}
export function classifySyntheticCard(raw){
  if(!exact(raw,REQUIRED))return deny("SCHEMA_FIELDS_NOT_EXACT");
  if(raw.schema!==SCHEMA||raw.syntheticOnly!==true||raw.readOnly!==true||raw.sourceSystem!=="PAE06_MAC_SYNTHETIC_QA")
    return deny("NOT_AUTHORIZED_SYNTHETIC_PREVIEW");
  if(typeof raw.sourceDocumentId!=="string"||!own(FROZEN,raw.sourceDocumentId))
    return deny("SOURCE_ID_NOT_ALLOWLISTED");
  const allowed=FROZEN[raw.sourceDocumentId];
  if(!Number.isSafeInteger(raw.sourceRevision)||raw.sourceRevision<1||raw.sourceRevision>999)
    return deny("INVALID_SOURCE_REVISION");
  if(typeof raw.originalSha256!=="string"||!SHA64.test(raw.originalSha256)||raw.originalSha256!==allowed.sha256)
    return deny("ORIGINAL_HASH_LABEL_MISMATCH");
  if(raw.previewPageCount!==allowed.pages||raw.title!==allowed.title)
    return deny("PREVIEW_SOURCE_MISMATCH");
  if(!canonicalDate(raw.documentDate))return deny("INVALID_DOCUMENT_DATE");
  if(!exact(raw.patientMapping,PATIENT)||raw.patientMapping.status!=="UNVERIFIED"||raw.patientMapping.patientId!==null)
    return deny("PATIENT_LINK_NOT_UNVERIFIED");
  if(raw.reviewStatus!=="NOT_REVIEWED"||raw.labStatus!=="NOT_CONFIRMED")
    return deny("CLINICAL_CONFIRMATION_NOT_ALLOWED");
  // Whitelist-derived display data: no OCR, medical values, patient name, raw PDF or arbitrary path.
  return {ok:true,preview:Object.freeze({
    sourceDocumentId:raw.sourceDocumentId,revision:raw.sourceRevision,
    title:allowed.title,pageCount:allowed.pages,documentDate:raw.documentDate,
    originalSha256:allowed.sha256,patientMapping:"НЕ ПОДТВЕРЖДЕНА",
    review:"НЕ ПРОВЕРЕНО",lab:"НЕТ ПОДТВЕРЖДЁННЫХ АНАЛИЗОВ",
    syntheticOnly:true,clinicalAuthority:false
  })};
}
export function classifyBatch(cards){
  if(!Array.isArray(cards)||cards.length>20)return {accepted:[],quarantined:[{index:-1,reason:"INVALID_BATCH"}]};
  const results=cards.map(classifySyntheticCard);
  const counts=new Map();
  for(const v of results)if(v.ok){const id=v.preview.sourceDocumentId;counts.set(id,(counts.get(id)||0)+1);}
  const accepted=[],quarantined=[];
  results.forEach((v,i)=>{
    if(!v.ok)quarantined.push({index:i,reason:v.reason});
    else if(counts.get(v.preview.sourceDocumentId)!==1)quarantined.push({index:i,reason:"DUPLICATE_SOURCE_DOCUMENT"});
    else accepted.push(v.preview);
  });
  return {accepted,quarantined};
}
export function makeSyntheticFixture(key){
  const id=key==="A"?"SYNTHETIC_MAC_QA_A":key==="B"?"SYNTHETIC_MAC_QA_B":null;
  if(id===null)throw new TypeError("Unknown fictional fixture");
  const f=FROZEN[id];
  return {
    schema:SCHEMA,syntheticOnly:true,sourceSystem:"PAE06_MAC_SYNTHETIC_QA",
    sourceDocumentId:id,sourceRevision:1,originalSha256:f.sha256,
    previewPageCount:f.pages,title:f.title,documentDate:key==="A"?null:"2026-11-17",
    patientMapping:{status:"UNVERIFIED",patientId:null},
    reviewStatus:"NOT_REVIEWED",labStatus:"NOT_CONFIRMED",readOnly:true
  };
}
