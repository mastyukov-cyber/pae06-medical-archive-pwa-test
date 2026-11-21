/* PAE-06 CP08.18-A synthetic read-only PDF PageLink candidate.
 * Original bytes must never be written, migrated, replaced or detached.
 * For development fixtures only. Does not confer clinical authority.
 * PDF.js vendor modules are copied byte-for-byte from original CP06.8.
 */
const MAX_BYTES = 1024 * 1024;
const MAX_TEST_PAGES = 5; // Deliberate original CP06.8 synthetic QA limit.

const deny = (reason) => Object.freeze({status: 'QUARANTINE',reason,canDisplay:false,canAutoMigrate:false});
export const legacyReview = (reason='LEGACY_BLOB_REQUIRES_REVIEW') =>
  Object.freeze({status:'LEGACY_REVIEW',reason,canDisplay:false,canAutoMigrate:false});

export async function hashOriginal(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice(0));
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2,'0')).join('');
}

/* No IndexedDB, localStorage, network fetch, writing, or automatic migration.
 * Caller passes an already-read record, the requested immutable PageLink and
 * an exact allowlist of synthetic document IDs + frozen SHA-256 hashes.
 */
export async function verifyPageLink({record,link,allowed,parsePages=localPdfPageCount}={}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return deny('MISSING_RECORD');
  if (!link || typeof link !== 'object' || Array.isArray(link)) return deny('MISSING_LINK');
  if (record.syntheticOnly !== true) return deny('NON_SYNTHETIC_RECORD');
  if (!allowed || Object.getPrototypeOf(allowed)!==Object.prototype) return deny('MISSING_SYNTHETIC_ALLOWLIST');
  if (typeof record.id!=='string' || typeof record.sha256!=='string' ||
      !Object.prototype.hasOwnProperty.call(allowed,record.id) ||
      allowed[record.id]!==record.sha256) return deny('UNKNOWN_SOURCE_ID_OR_SHA');
  if (link.documentId!==record.id || link.sha256!==record.sha256) return deny('LINK_SOURCE_MISMATCH');
  if (!Number.isInteger(link.pageNumber) || link.pageNumber<1) return deny('BAD_PAGE_NUMBER');

  // Fail closed on a malformed versioned record: never fall back to Blob.
  if (record.sourceEncoding==='arraybuffer-v1') {
    if (!(record.sourceBytes instanceof ArrayBuffer)) return deny('MISSING_VERSIONED_BYTES');
  } else if ((record.sourceEncoding===undefined || record.sourceEncoding===null) &&
             typeof Blob!=='undefined' && record.blob instanceof Blob) {
    return legacyReview(); // Read-only classification. No bytes are accessed.
  } else return deny('UNSUPPORTED_SOURCE_ENCODING');

  const bytes = record.sourceBytes;
  if (bytes.byteLength<10 || bytes.byteLength>MAX_BYTES) return deny('INVALID_BYTES_LENGTH');
  const head = new Uint8Array(bytes,0,5);
  if (String.fromCharCode(...head)!=='%PDF-') return deny('INVALID_PDF_SIGNATURE');
  let originalSHA;
  try { originalSHA = await hashOriginal(bytes); }
  catch { return deny('SHA256_UNAVAILABLE'); }
  if (originalSHA!==record.sha256) return deny('ORIGINAL_PDF_SHA_MISMATCH');

  let pageCount;
  try {
    // Parsing sees only a COPY. The original ArrayBuffer remains intact.
    pageCount=await parsePages(bytes.slice(0));
  } catch { return deny('PDF_PARSE_FAILED'); }
  if (!Number.isInteger(pageCount)||pageCount<1||pageCount>MAX_TEST_PAGES)
    return deny('INVALID_ACTUAL_PAGE_COUNT');
  if (link.pageNumber>pageCount) return deny('SOURCE_PDF_PAGE_OUT_OF_BOUNDS');
  try { if (await hashOriginal(bytes)!==originalSHA) return deny('SOURCE_CHANGED_DURING_PARSE'); }
  catch { return deny('SHA256_RECHECK_FAILED'); }
  return Object.freeze({status:'VERIFIED_READONLY',documentId:record.id,pageNumber:link.pageNumber,
    actualPages:pageCount,sourceSha256:originalSHA,canDisplay:true,canAutoMigrate:false});
}

export async function localPdfPageCount(bytesCopy) {
  if (!(bytesCopy instanceof ArrayBuffer)) throw Error('PDF_BYTES_REQUIRED');
  const pdfjs = await import('../vendor/pdfjs/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  let task;
  try {
    task=pdfjs.getDocument({data:new Uint8Array(bytesCopy),isEvalSupported:false,
      disableAutoFetch:true,disableStream:true,useSystemFonts:false,stopAtErrors:true});
    const pdf=await task.promise;
    return pdf.numPages;
  } finally {if (task) try {await task.destroy();} catch { /* do not mask parse refusal */ }}
}
