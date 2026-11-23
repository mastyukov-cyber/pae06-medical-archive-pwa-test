/* PAE-06 CP08.30 — one NEW negative scenario; historic QA not replayed.
 * Run only after separately approved runtime QA; this is source-only handoff.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSyntheticSourceProvenance,QA_B} from './source-provenance-gate.mjs';
import {makeSyntheticFixture} from '../../../mac-derived-adapter.mjs';
import {envelope} from '../cp0822-bplus-contract/data-source.mjs';

test('QA-B screenshot SHA does not bind B+ lab row or attest Mac',()=>{
  const verdict=inspectSyntheticSourceProvenance({
    pdfEvidence:{
      sourceDocumentId:QA_B.sourceDocumentId,pwaDocumentId:QA_B.pwaDocumentId,
      pdfByteSize:QA_B.pdfByteSize,sha256:QA_B.sha256,
      scope:'SCREENSHOT_VERIFIED',independentMacReadback:false
    },
    macCard:makeSyntheticFixture('B'),
    labEnvelope:envelope,
    labRowId:'demo-row-001'
  });
  assert.equal(verdict.ok,false);
  assert.equal(verdict.disposition,'QUARANTINE');
  assert.equal(verdict.reason,'BLOCKED_NO_LAB_BINDING');
  assert.equal(verdict.canDisplayAsVerified,false);
  assert.equal(verdict.evidence.originalPdfBytesIndependentlyVerified,false);
  assert.equal(verdict.evidence.realMacIdentityVerified,false);
  assert.equal(verdict.evidence.independentMacTrustAnchorVerified,false);
  assert.equal(verdict.evidence.patientIdentityVerified,false);
  assert.equal(verdict.evidence.clinicalAuthority,false);
});
