/* CP08.15 DELIVER-FIRST adapter: exact TEST origin, synthetic-only, no automatic writes. */
import {contract,RestoreRefusal} from './restore.mjs';
const fail=(s)=>{throw new RestoreRefusal(s)};
function allowed(loc){
  if(!loc||loc.search||loc.hash)return false;
  const local=loc.protocol==='http:'&&loc.hostname==='127.0.0.1'&&
    /^\d{4,5}$/.test(loc.port)&&Number(loc.port)>=1024&&
    Number(loc.port)<=65535&&loc.pathname==='/restore-test.html';
  const test=loc.protocol==='https:'&&loc.origin==='https://mastyukov-cyber.github.io'&&
    loc.pathname==='/pae06-medical-archive-pwa-test/restore-test.html';
  return local||test;
}
export function assertTestScope(loc,topLevel){
 if(!topLevel||!allowed(loc))fail('TEST_ORIGIN_OR_FRAME_DENIED');
 return loc.origin;
}
export function openTestDb({loc,topLevel=false,idb,manualConsent=false}={}){
 assertTestScope(loc,topLevel);
 if(manualConsent!==true)fail('EXPLICIT_STORAGE_CONSENT_REQUIRED');
 if(!idb||typeof idb.open!=='function')fail('INDEXEDDB_UNAVAILABLE');
 return new Promise((resolve,reject)=>{
  let done=false,request;
  const stop=(code)=>{if(!done){done=true;reject(new RestoreRefusal(code))}};
  try{request=idb.open(contract.dbName,1)}catch{stop('DB_OPEN_DENIED');return;}
  request.onblocked=()=>stop('DB_BLOCKED');
  request.onerror=()=>stop('DB_OPEN_FAILED');
  request.onupgradeneeded=(event)=>{
   if(done){try{request.transaction?.abort()}catch{}return;}
   try{
    if(event.oldVersion!==0)throw Error('UNEXPECTED_MIGRATION');
    const db=request.result;
    if(db.objectStoreNames.length!==0)throw Error('UNEXPECTED_PREEXISTING_SCHEMA');
    db.createObjectStore('documents',{keyPath:'id'});
   }catch{try{request.transaction?.abort()}catch{}stop('DB_SCHEMA_DENIED')}
  };
  request.onsuccess=()=>{
   const db=request.result;
   if(done){db.close();return;}
   try{
    if(db.name!==contract.dbName||db.version!==1||
       db.objectStoreNames.length!==1||!db.objectStoreNames.contains('documents'))throw Error('SCOPE');
    const tx=db.transaction('documents','readonly');const store=tx.objectStore('documents');
    if(store.keyPath!=='id'||store.autoIncrement!==false||store.indexNames.length!==0)throw Error('STORE');
    db.onversionchange=()=>{try{db.close()}catch{}};
    done=true;resolve(db);
   }catch{db.close();stop('DB_SCHEMA_DENIED')}
  };
 });
}
