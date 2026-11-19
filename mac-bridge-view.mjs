/* CP08.11: READ ONLY. Local SHA-pinned sample JSON from this TEST site.
   This is a QA proof of cryptographic operations, NOT trusted Mac identity.
   No local/remote archive import, IndexedDB writes or network gateway calls. */
import {verifySyntheticEnvelope} from "./mac-bridge.mjs";
const status=document.getElementById("macBridgeStatus");
const list=document.getElementById("macBridgeList");
function text(tag,value,cls=""){
 const item=document.createElement(tag);item.textContent=value;if(cls)item.className=cls;return item;
}
if(status&&list){
 try{
  const [rKey,rEnvelope]=await Promise.all([
   fetch("./qa/qa_public_key.json",{cache:"default"}),
   fetch("./qa/signed_transfer.json",{cache:"default"})
  ]);
  if(!rKey.ok||!rEnvelope.ok)throw new Error("QA_FIXTURES_UNAVAILABLE");
  const key=await rKey.json(),envelope=await rEnvelope.json();
  if(key.profile!=="ISOLATED_QA_ONLY"||key.syntheticOnly!==true||key.notClinicalIdentity!==true||
     key.keyId!=="CP0811_QA_EPHEMERAL_01"||typeof key.rawKeyBase64url!=="string"||
     !/^[A-Za-z0-9_-]{43}$/.test(key.rawKeyBase64url))throw new Error("QA_PUBLIC_KEY_NOT_ALLOWED");
  const bin=atob(key.rawKeyBase64url.replace(/-/g,"+").replace(/_/g,"/")+"=");
  const publicKeyRaw=Uint8Array.from(bin,c=>c.charCodeAt(0));
  if(publicKeyRaw.length!==32)throw new Error("QA_KEY_LENGTH_INVALID");
  const verdict=await verifySyntheticEnvelope(envelope,{
   profile:"ISOLATED_QA_ONLY",keyId:key.keyId,publicKeyRaw,
   nowIso:"2026-11-19T09:00:00.000Z",seenTransferIds:new Set(),knownRevisions:{}
  });
  if(!verdict.ok)throw new Error(verdict.reason);
  list.replaceChildren();
  for(const card of verdict.cards){
   const el=document.createElement("article");el.className="macbridge-card";
   el.append(text("strong",card.title),
    text("span",`Ревизия ${card.sourceRevision}; страниц ${card.pageCount}`),
    text("span",`Связь с пациентом: ${card.patient}`),
    text("span",`Медицинская проверка: ${card.review}`),
    text("span",`Эталонный SHA-256 (без сверки реальных PDF): ${card.originalSha256}`));
   list.append(el);
  }
  status.textContent=`QA Ed25519/SHA-256: ПРОВЕРЕНО ${verdict.cards.length}/2. Ключ учебный, не удостоверяет настоящий Mac.`;
 }catch(err){
  list.replaceChildren();
  status.textContent="BLOCKED: подпись или учебный пакет не прошли проверку ("+String(err.message||"error")+").";
 }
}
