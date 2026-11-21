/* PAE-06 CP08.18-B DATA SAFE: source-only, synthetic read-only IndexedDB bridge.
 * Intended as an ADD-ONLY companion to frozen CP08.18-A pdf-page-link.mjs.
 * No create, put, delete, clear, migration, network, Mac or clinical authority.
 */
export const DATABASE = 'pae06_cp082_synthetic_only';
export const STORE = 'documents';
export const VERSION = 1;
export const QA_SHA = Object.freeze({
  'qa-a': '4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153',
  'qa-b': '3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982'
});
const fail = code => { throw new Error(code); };

export function parseStrictPageLink(search) {
  if (typeof search !== 'string' || search.length > 80) fail('INVALID_QUERY');
  const query = new URLSearchParams(search);
  const keys = [...query.keys()];
  if (keys.length !== 2 || keys[0] !== 'doc' || keys[1] !== 'page') fail('INVALID_QUERY_KEYS');
  const id = query.get('doc'), value = query.get('page');
  if (!Object.hasOwn(QA_SHA, id)) fail('UNKNOWN_SYNTHETIC_DOCUMENT');
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,2}$/.test(value)) fail('INVALID_PAGE_NUMBER');
  return Object.freeze({ documentId: id, pageNumber: Number(value), sha256: QA_SHA[id] });
}

/* Require discovery before opening: an absent database must not be created by a viewer. */
export async function readExistingQaRecord(idb, documentId, timeoutMs = 3000) {
  if (!Object.hasOwn(QA_SHA, documentId)) fail('UNKNOWN_SYNTHETIC_DOCUMENT');
  if (!idb || typeof idb.databases !== 'function' || typeof idb.open !== 'function')
    fail('SAFE_IDB_DISCOVERY_UNAVAILABLE');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) fail('INVALID_TIMEOUT');
  let databases;
  try { databases = await idb.databases(); } catch { fail('IDB_DISCOVERY_FAILED'); }
  if (!Array.isArray(databases) || !databases.some(d => d?.name === DATABASE && d?.version === VERSION))
    fail('EXISTING_QA_DATABASE_NOT_FOUND');
  return await new Promise((resolve, reject) => {
    let db, complete = false;
    const finish = (err, rec) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      try { db?.close(); } catch {}
      if (err) reject(new Error(err)); else resolve(rec);
    };
    const timer = setTimeout(() => finish('IDB_READ_TIMEOUT'), timeoutMs);
    let request;
    try { request = idb.open(DATABASE, VERSION); }
    catch { finish('IDB_OPEN_FAILED'); return; }
    request.onupgradeneeded = () => {
      try { request.transaction?.abort(); } catch {}
      finish('IDB_UPGRADE_FORBIDDEN');
    };
    request.onblocked = () => finish('IDB_OPEN_BLOCKED');
    request.onerror = () => finish('IDB_OPEN_ERROR');
    request.onsuccess = () => {
      db = request.result;
      if (complete) { try { db?.close(); } catch {} return; }
      if (db.version !== VERSION || [...db.objectStoreNames].join(',') !== STORE) {
        finish('IDB_SCHEMA_MISMATCH'); return;
      }
      let tx, store, get;
      try {
        tx = db.transaction(STORE, 'readonly');
        store = tx.objectStore(STORE);
        if (store.keyPath !== 'id' || store.autoIncrement !== false || [...store.indexNames].length !== 0) {
          finish('IDB_STORE_SCHEMA_MISMATCH'); return;
        }
        get = store.get(documentId);
      } catch { finish('IDB_READ_FAILED'); return; }
      tx.oncomplete = () => {
        const record = get.result;
        if (!record || record.id !== documentId) { finish('IDB_RECORD_NOT_FOUND'); return; }
        finish(null, record);
      };
      tx.onabort = () => finish('IDB_READ_ABORTED');
      tx.onerror = () => finish('IDB_READ_ERROR');
    };
  });
}

/* Dependency injection enables independent synthetic tests. The production
 * verifier is the pre-existing hash-and-PDF.js PageLink module, NOT a mock. */
export async function verifyExistingQaPage({search, idb, verifyPageLink, parsePages}) {
  if (typeof verifyPageLink !== 'function') fail('MISSING_ORIGINAL_PAGELINK_VERIFIER');
  const link = parseStrictPageLink(search);
  const record = await readExistingQaRecord(idb, link.documentId);
  const verdict = await verifyPageLink({record, link, allowed: {...QA_SHA}, ...(parsePages ? {parsePages} : {})});
  if (!verdict || verdict.status !== 'VERIFIED_READONLY' || verdict.canDisplay !== true)
    return Object.freeze({status: 'REFUSED', reason: verdict?.reason || verdict?.status || 'UNVERIFIED', canDisplay: false});
  if (verdict.documentId !== link.documentId || verdict.pageNumber !== link.pageNumber ||
      verdict.sourceSha256 !== QA_SHA[link.documentId])
    return Object.freeze({status: 'REFUSED', reason: 'VERDICT_IDENTITY_MISMATCH', canDisplay: false});
  return Object.freeze({status: 'VERIFIED_READONLY', canDisplay: true,
    documentId: link.documentId, pageNumber: link.pageNumber, actualPages: verdict.actualPages,
    sourceSha256: verdict.sourceSha256, renderBytes: record.sourceBytes.slice(0)});
}
