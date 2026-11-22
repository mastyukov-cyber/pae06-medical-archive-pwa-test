/* CP08.22: strict TEST-only handoff to unchanged B+ rendering, no storage/network. */
import {ANALYTES,SYNTHETIC_RECORDS} from '../cp0819-labs/fixture.mjs';
import {ingest} from '../cp0819-labs/lab-core.mjs';
import {CONTRACT,classifySyntheticLabEnvelope} from './adapter.mjs';

// Only the same frozen demo rows displayed by CP08.20; the CP08.19 fixture stays immutable.
const exampleRows=[
 {code:'crp',value:6.2,unit:'мг/л',method:'Иммунотурбидиметрия',reference:{low:0,high:5,unit:'мг/л'}},
 {code:'ferritin',value:21,unit:'мкг/л',method:'Иммунохимический',reference:{low:25,high:280,unit:'мкг/л'}}
].map((r,i)=>({...r,id:'demo-bplus-'+String(i+1),collectedOn:'2026-11-18',lab:'Учебная лаборатория А',status:'human-confirmed',syntheticOnly:true,source:{kind:'mac-human-reviewed',documentId:'demo-doc-bplus-'+String(i+1),reviewedOn:'2026-11-19'}}));
const specimenByCode=Object.freeze({hb:'Цельная кровь',glucose:'Сыворотка',creatinine:'Сыворотка',crp:'Сыворотка',ferritin:'Сыворотка',vitd:'Сыворотка'});
// These 64 hex characters are only a DEMO LABEL; no real PDF bytes are verified.
const DEMO_HASH_LABEL='a'.repeat(64);
const candidates=[...SYNTHETIC_RECORDS,...exampleRows].map(row=>({
 ...row,specimen:specimenByCode[row.code]||'Не указан',
 source:{kind:row.source?.kind,documentId:row.source?.documentId,reviewedOn:row.source?.reviewedOn,revision:1,originalSha256:DEMO_HASH_LABEL}
}));
export const envelope=Object.freeze({
 schema:CONTRACT,channel:'TEST',syntheticOnly:true,readOnly:true,patientBinding:'UNVERIFIED',
 producer:'PAE06_SYNTHETIC_QA',generatedAt:'2026-11-22T00:00:00.000Z',records:candidates
});
export const gate=classifySyntheticLabEnvelope(envelope);
const intake=gate.ok?ingest(gate.accepted):Object.freeze({accepted:[],rejected:[]});
export const accepted=Object.freeze(intake.accepted);
export const excludedCount=gate.ok?gate.quarantined.length+intake.rejected.length:candidates.length;
export const evidence=Object.freeze({
 syntheticOnly:true,readOnly:true,realMacIdentityVerified:false,originalPdfBytesVerified:false,
 clinicalAuthority:false,source:gate.ok?'CP0821_SYNTHETIC_ONLY':'BLOCKED'
});
// Never fall back to unverified input: a failed envelope produces an empty dataset.
