import test from 'node:test';
import assert from 'node:assert/strict';
import {ANALYTES,SYNTHETIC_RECORDS} from '../cp0819-labs/fixture.mjs';
import {ingest} from '../cp0819-labs/lab-core.mjs';
import {CONTRACT,classifySyntheticLabEnvelope,validateSyntheticRow,compareDateResults} from './adapter.mjs';
import {envelope,gate,accepted,excludedCount,evidence} from './data-source.mjs';
import {envelope as originalCP21} from './fixture.mjs';

const pick=(code,date,unit)=>accepted.find(r=>r.code===code&&r.collectedOn===date&&(!unit||r.unit===unit));
const clone=o=>structuredClone(o);
const checks=[
 ['contract unchanged',()=>assert.equal(CONTRACT,'pae06.synthetic.lab-results.v1')],
 ['envelope valid',()=>assert.equal(gate.ok,true)],
 ['TEST only',()=>assert.equal(envelope.channel,'TEST')],
 ['synthetic-only',()=>assert.equal(envelope.syntheticOnly,true)],
 ['patient UNVERIFIED',()=>assert.equal(envelope.patientBinding,'UNVERIFIED')],
 ['read only',()=>assert.equal(envelope.readOnly,true)],
 ['accepted count = 27',()=>assert.equal(accepted.length,27)],
 ['excluded count = 3',()=>assert.equal(excludedCount,3)],
 ['quarantine reasons explicit',()=>assert.deepEqual(gate.quarantined.map(x=>x.reason).sort(),['INVALID_COLLECTION_DATE','NOT_SYNTHETIC_REVIEWED','NOT_SYNTHETIC_REVIEWED'])],
 ['distinct analytes = 6',()=>assert.equal(new Set(accepted.map(x=>x.code)).size,ANALYTES.length)],
 ['date order monotonic',()=>assert.deepEqual(accepted.map(x=>x.collectedOn),accepted.map(x=>x.collectedOn).toSorted())],
 ['no unconfirmed content',()=>assert.ok(accepted.every(x=>x.status==='human-confirmed'&&x.syntheticOnly&&x.source.kind==='mac-human-reviewed'))],
 ['source hash explicitly demo',()=>assert.ok(accepted.every(x=>x.source.originalSha256==='a'.repeat(64)))],
 ['source provenance revision',()=>assert.ok(accepted.every(x=>x.source.revision===1))],
 ['no clinical authority',()=>assert.equal(evidence.clinicalAuthority,false)],
 ['Mac identity not verified',()=>assert.equal(evidence.realMacIdentityVerified,false)],
 ['PDF bytes not verified',()=>assert.equal(evidence.originalPdfBytesVerified,false)],
 ['all accepted rows pass CP08.21',()=>assert.ok(accepted.every(r=>validateSyntheticRow(r)===null))],
 ['original CP08.21 fixture still accepted',()=>assert.equal(classifySyntheticLabEnvelope(originalCP21()).accepted.length,3)],
 ['same accepted IDs as old B+ display',()=>{const extra=envelope.records.filter(x=>x.id.startsWith('demo-bplus-'));const legacy=ingest([...SYNTHETIC_RECORDS,...extra]);assert.deepEqual(accepted.map(r=>r.id).toSorted(),legacy.accepted.map(r=>r.id).toSorted());}],
 ['positive glucose comparison',()=>{const a=pick('glucose','2026-11-06','ммоль/л'),b=pick('glucose','2026-06-11');const r=compareDateResults(a,b);assert.equal(r.comparable,true);assert.ok(Math.abs(r.delta+0.1)<1e-8);assert.equal(r.unit,'ммоль/л');}],
 ['cross-unit comparison denied',()=>{const a=pick('glucose','2026-10-12','мг/дл'),b=pick('glucose','2026-11-06','ммоль/л');assert.equal(compareDateResults(a,b).reason,'INCOMPATIBLE_UNIT');}],
 ['cross-analyte comparison denied',()=>{const a=pick('glucose','2026-11-06'),b=pick('crp','2026-06-11');assert.equal(compareDateResults(a,b).reason,'DIFFERENT_ANALYTE');}],
 ['same-day comparison denied',()=>{const a=pick('glucose','2026-11-06');assert.equal(compareDateResults(a,a).reason,'SAME_DATE');}],
 ['incompatible method denied',()=>{const a=pick('glucose','2026-11-06'),b=clone(pick('glucose','2026-06-11'));b.method='Другой метод';assert.equal(compareDateResults(a,b).reason,'INCOMPATIBLE_METHOD');}],
 ['incompatible specimen denied',()=>{const a=pick('glucose','2026-11-06'),b=clone(pick('glucose','2026-06-11'));b.specimen='Плазма';assert.equal(compareDateResults(a,b).reason,'INCOMPATIBLE_SPECIMEN');}],
 ['no records for unauthorized channel',()=>{const e=clone(envelope);e.channel='FINAL';const r=classifySyntheticLabEnvelope(e);assert.equal(r.ok,false);assert.equal(r.accepted.length,0);}],
 ['no records for bound patient',()=>{const e=clone(envelope);e.patientBinding='VERIFIED';assert.equal(classifySyntheticLabEnvelope(e).accepted.length,0);}],
 ['no records for external producer',()=>{const e=clone(envelope);e.producer='REAL_MAC';assert.equal(classifySyntheticLabEnvelope(e).accepted.length,0);}],
 ['no records for unknown envelope field',()=>{const e=clone(envelope);e.patientName='REAL';assert.equal(classifySyntheticLabEnvelope(e).reason,'ENVELOPE_FIELDS_NOT_EXACT');}],
 ['unknown row fields quarantined',()=>{const e=clone(envelope);e.records[0].patientName='REAL';const r=classifySyntheticLabEnvelope(e);assert.equal(r.accepted.length,26);assert.equal(r.quarantined.length,4);}],
 ['OCR pending excluded',()=>assert.ok(!accepted.some(r=>r.id==='demo-pending-ocr'))],
 ['nonsynthetic excluded',()=>assert.ok(!accepted.some(r=>r.id==='demo-not-synthetic'))],
 ['bad calendar date excluded',()=>assert.ok(!accepted.some(r=>r.id==='demo-corrupted-date'))],
 ['arrays frozen',()=>assert.ok(Object.isFrozen(accepted)&&Object.isFrozen(gate.accepted))],
 ['no implicit source fetch',()=>assert.ok(evidence.readOnly&&evidence.syntheticOnly)]
];
for(const [name,fn] of checks)test(name,fn);
