/* PAE-06 CP08.11: browser-compatible VERIFY-ONLY synthetic transfer gate.
   NO storage, fetch, OCR, Vault, identity binding, or production authorization.
   A key supplied through a caller's QA policy is NOT a trusted Mac identity.
   Requires WebCrypto Ed25519; Safari/browser compatibility remains NOT RUN. */
export const CONTRACT="pae06.mac-pwa.synthetic-preview.v0.1";
const SOURCE="PAE06_MAC_SYNTHETIC_QA", KEY_ID="CP0811_QA_EPHEMERAL_01";
const FIELD=["schema","channel","syntheticOnly","sourceSystem","transferId","generatedAt","keyId","cards","payloadSha256","signature"];
const CARD=["sourceDocumentId","sourceRevision","originalSha256","previewPageCount","title","documentDate","patientMapping","reviewStatus","labStatus","readOnly"];
const PATIENT=["status","patientId"];
const SHA=/^[0-9a-f]{64}$/;
const PINNED=Object.freeze({
 SYNTHETIC_MAC_QA_A:Object.freeze({title:"QA-A · Учебный документ",pages:1,sha:"4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153",date:null}),
 SYNTHETIC_MAC_QA_B:Object.freeze({title:"QA-B · Двухстраничный документ",pages:2,sha:"3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982",date:"2026-11-17"})
});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&[Object.prototype,null].includes(Object.getPrototypeOf(o));
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>own(o,k));
const fail=code=>Object.freeze({ok:false,reason:code});
const asHex=a=>Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,"0")).join("");
const b64url=b=>{let bin="";for(let i=0;i<b.length;i++)bin+=String.fromCharCode(b[i]);return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")};
const parseB64url=s=>{
 if(typeof s!=="string"||!/^[A-Za-z0-9_-]{86}$/.test(s))return null;
 try {const pad=s.replace(/-/g,"+").replace(/_/g,"/")+"==";const raw=Uint8Array.from(atob(pad),c=>c.charCodeAt(0));return raw.length===64&&b64url(raw)===s?raw:null}catch{return null}
};
function compactPayload(e){
 return {schema:e.schema,channel:e.channel,syntheticOnly:e.syntheticOnly,sourceSystem:e.sourceSystem,transferId:e.transferId,
  generatedAt:e.generatedAt,keyId:e.keyId,cards:e.cards};
}
function checkCard(c){
 if(!exact(c,CARD))return "CARD_FIELDS_NOT_EXACT";
 if(typeof c.sourceDocumentId!=="string"||!own(PINNED,c.sourceDocumentId))return "SOURCE_DOCUMENT_NOT_ALLOWED";
 const p=PINNED[c.sourceDocumentId];
 if(!Number.isSafeInteger(c.sourceRevision)||c.sourceRevision<1||c.sourceRevision>999)return "INVALID_SOURCE_REVISION";
 if(c.originalSha256!==p.sha||!SHA.test(c.originalSha256))return "SOURCE_HASH_LABEL_MISMATCH";
 if(c.title!==p.title||c.previewPageCount!==p.pages||c.documentDate!==p.date)return "SOURCE_PREVIEW_MISMATCH";
 if(!exact(c.patientMapping,PATIENT)||c.patientMapping.status!=="UNVERIFIED"||c.patientMapping.patientId!==null)return "PATIENT_NOT_VERIFIED";
 if(c.reviewStatus!=="NOT_REVIEWED"||c.labStatus!=="NOT_CONFIRMED"||c.readOnly!==true)return "UNAPPROVED_CLINICAL_STATE";
 return null;
}
export function fixtureCard(which){
 const id=which==="A"?"SYNTHETIC_MAC_QA_A":which==="B"?"SYNTHETIC_MAC_QA_B":null;
 if(!id)throw new TypeError("Unknown test fixture");
 const p=PINNED[id];
 return {sourceDocumentId:id,sourceRevision:1,originalSha256:p.sha,previewPageCount:p.pages,title:p.title,
  documentDate:p.date,patientMapping:{status:"UNVERIFIED",patientId:null},reviewStatus:"NOT_REVIEWED",
  labStatus:"NOT_CONFIRMED",readOnly:true};
}
export function mockPayload({transferId="SYNTHETIC-TRANSFER-001",generatedAt="2026-11-19T09:00:00.000Z",cards=[fixtureCard("A"),fixtureCard("B")]}={}){
 return {schema:CONTRACT,channel:"TEST",syntheticOnly:true,sourceSystem:SOURCE,transferId,generatedAt,keyId:KEY_ID,cards};
}
export async function verifySyntheticEnvelope(input,policy){
 if(!exact(input,FIELD))return fail("ENVELOPE_FIELDS_NOT_EXACT");
 if(!policy||policy.profile!=="ISOLATED_QA_ONLY"||policy.keyId!==KEY_ID||!(policy.publicKeyRaw instanceof Uint8Array)||policy.publicKeyRaw.length!==32)
   return fail("NO_TRUSTED_QA_CONTEXT");
 if(input.schema!==CONTRACT||input.channel!=="TEST"||input.syntheticOnly!==true||input.sourceSystem!==SOURCE||input.keyId!==KEY_ID)
   return fail("NOT_APPROVED_QA_SOURCE");
 if(typeof input.transferId!=="string"||!/^[A-Z0-9-]{8,64}$/.test(input.transferId))return fail("INVALID_TRANSFER_ID");
 if(typeof input.generatedAt!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.generatedAt)||
    !Number.isFinite(Date.parse(input.generatedAt))||new Date(input.generatedAt).toISOString()!==input.generatedAt)return fail("INVALID_GENERATION_TIME");
 const now=Date.parse(policy.nowIso);
 if(!Number.isFinite(now))return fail("INVALID_POLICY_TIME");
 const lag=now-Date.parse(input.generatedAt);
 if(lag>24*60*60*1000||lag< -5*60*1000)return fail("OUTSIDE_QA_TIME_WINDOW");
 if(!Array.isArray(input.cards)||input.cards.length<1||input.cards.length>2)return fail("INVALID_CARD_COUNT");
 const ids=new Set();
 for(const c of input.cards){const err=checkCard(c);if(err)return fail(err);if(ids.has(c.sourceDocumentId))return fail("DUPLICATE_DOCUMENT");ids.add(c.sourceDocumentId)}
 if(typeof input.payloadSha256!=="string"||!SHA.test(input.payloadSha256))return fail("INVALID_PAYLOAD_DIGEST");
 const bytes=new TextEncoder().encode(JSON.stringify(compactPayload(input)));
 if(bytes.length>8192)return fail("ENVELOPE_TOO_LARGE");
 const digest=asHex(await crypto.subtle.digest("SHA-256",bytes));
 if(digest!==input.payloadSha256)return fail("PAYLOAD_HASH_MISMATCH");
 const sig=parseB64url(input.signature);if(!sig)return fail("INVALID_SIGNATURE_ENCODING");
 let valid=false;
 try{
  const key=await crypto.subtle.importKey("raw",policy.publicKeyRaw,{name:"Ed25519"},false,["verify"]);
  valid=await crypto.subtle.verify({name:"Ed25519"},key,sig,bytes);
 }catch{return fail("ED25519_NOT_AVAILABLE")}
 if(!valid)return fail("SIGNATURE_INVALID");
 // Only after signature verification consult replay/rollback context.
 if(policy.seenTransferIds instanceof Set&&policy.seenTransferIds.has(input.transferId))return fail("REPLAY_TRANSFER");
 const known=policy.knownRevisions||{};
 if(!plain(known))return fail("INVALID_QA_REVISION_STATE");
 let changes=0;
 for(const c of input.cards){
  const prev=own(known,c.sourceDocumentId)?known[c.sourceDocumentId]:0;
  if(!Number.isSafeInteger(prev)||prev<0||prev>999)return fail("INVALID_QA_REVISION_STATE");
  if(c.sourceRevision<prev)return fail("REVISION_ROLLBACK");
  if(c.sourceRevision>prev)changes++;
 }
 const display=input.cards.map(c=>Object.freeze({
  sourceDocumentId:c.sourceDocumentId,sourceRevision:c.sourceRevision,title:PINNED[c.sourceDocumentId].title,
  pageCount:PINNED[c.sourceDocumentId].pages,documentDate:PINNED[c.sourceDocumentId].date,
  originalSha256:PINNED[c.sourceDocumentId].sha,patient:"НЕ ПОДТВЕРЖДЕН",
  review:"НЕ ПРОВЕРЕНО",lab:"НЕТ ПОДТВЕРЖДЕННЫХ АНАЛИЗОВ",clinicalAuthority:false
 }));
 return Object.freeze({ok:true,disposition:changes?"QA_PREVIEW_ONLY":"QA_ALREADY_PREVIEWED",
   cards:Object.freeze(display),audit:Object.freeze({transferId:input.transferId,keyId:input.keyId,verifiedEnvelopeSha256:digest,
     unsignedFileBytesVerified:false,realMacIdentityVerified:false,clinicalAuthority:false})});
}
export const BRIDGE_POLICY=Object.freeze({productionAllowed:false,macConnected:false,vaultAccess:false,persistenceAllowed:false});
