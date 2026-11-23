/* PAE-06 CP08.30 — SOURCE-ONLY, synthetic negative provenance gate.
 * This module is diagnostic only: it NEVER grants Mac identity, PDF byte
 * attestation, patient identity, clinical authority, or verified lab display.
 * No storage, network, filesystem, signature creation, or side effects.
 * CP08.29 B+ source files and historic QA must remain unchanged.
 */
import {classifySyntheticCard} from '../../../mac-derived-adapter.mjs';
import {classifySyntheticLabEnvelope} from '../cp0822-bplus-contract/adapter.mjs';

export const GATE = 'PAE06_CP0830_SOURCE_PROVENANCE_NEGATIVE_ONLY_V1';
export const QA_B = Object.freeze({
  sourceDocumentId:'SYNTHETIC_MAC_QA_B',
  pwaDocumentId:'qa-b',
  pdfByteSize:27827,
  sha256:'3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982'
});
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>hasOwn(o,k));
const INPUT=['pdfEvidence','macCard','labEnvelope','labRowId'];
const PDF=['sourceDocumentId','pwaDocumentId','pdfByteSize','sha256','scope','independentMacReadback'];
const deny=reason=>Object.freeze({
  ok:false,reason,disposition:'QUARANTINE',canDisplayAsVerified:false,
  evidence:Object.freeze({
    syntheticOnly:true,originalPdfBytesIndependentlyVerified:false,
    realMacIdentityVerified:false,independentMacTrustAnchorVerified:false,
    patientIdentityVerified:false,clinicalAuthority:false
  })
});

/**
 * An explicitly non-authoritative preflight, not a medical trust decision.
 * The current B+ rows use demo-doc-* and invented SHA labels, not the QA-B
 * original. Even matching labels would NOT verify a real Mac or PDF bytes.
 */
export function inspectSyntheticSourceProvenance(input) {
  if(!exact(input,INPUT))return deny('BLOCKED_INPUT_FIELDS');
  const {pdfEvidence,macCard,labEnvelope,labRowId}=input;
  if(!exact(pdfEvidence,PDF)||pdfEvidence.scope!=='SCREENSHOT_VERIFIED'||
     pdfEvidence.independentMacReadback!==false||
     pdfEvidence.sourceDocumentId!==QA_B.sourceDocumentId||
     pdfEvidence.pwaDocumentId!==QA_B.pwaDocumentId||
     pdfEvidence.pdfByteSize!==QA_B.pdfByteSize||
     pdfEvidence.sha256!==QA_B.sha256)
    return deny('BLOCKED_PDF_EVIDENCE_NOT_ATTESTED');
  const card=classifySyntheticCard(macCard);
  if(!card.ok||card.preview.sourceDocumentId!==QA_B.sourceDocumentId||
     card.preview.originalSha256!==QA_B.sha256)
    return deny('BLOCKED_MAC_CARD_MISMATCH');
  const lab=classifySyntheticLabEnvelope(labEnvelope);
  if(!lab.ok)return deny('BLOCKED_LAB_CONTRACT');
  if(typeof labRowId!=='string'||!/^demo-(?:row-[0-9]{3}|bplus-[0-9]+)$/.test(labRowId))
    return deny('BLOCKED_LAB_RESULT_ID');
  const matching=lab.accepted.filter(row=>row.id===labRowId);
  if(matching.length!==1)return deny('BLOCKED_LAB_RESULT_NOT_FOUND');
  const row=matching[0];
  if(row.source.documentId!==QA_B.sourceDocumentId||
     row.source.originalSha256!==QA_B.sha256)
    return deny('BLOCKED_NO_LAB_BINDING');
  // No independent Mac identity or external trust-anchor verification exists.
  // Never infer trust from the QA Ed25519 key bundled with the demo package.
  return deny('BLOCKED_INDEPENDENT_MAC_TRUST_ANCHOR');
}
