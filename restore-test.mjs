/* PAE-06 CP08.15 DELIVER-FIRST — R10.1 core on real synthetic IndexedDB. */
import {parseBackup,previewRestore,commitSyntheticRestore,contract} from './src/restore.mjs';
import {assertTestScope,openTestDb} from './src/test-idb-gate.mjs';
const el=id=>document.getElementById(id);
let selectedText=null,selectedDocs=[],db=null,plan=null,busy=false,locked=false,phase='idle';
const TITLES={'qa-a':'QA-A · Учебный документ','qa-b':'QA-B · Двухстраничный документ'};
const ERROR_LABELS={
 JSON_INVALID:'Неверный формат JSON.',BACKUP_SIZE_INVALID:'Файл слишком большой.',
 BACKUP_SCHEMA_INVALID:'Структура копии недопустима.',
 BACKUP_AUTHORITY_INVALID:'Поддерживаются только учебные копии этой версии.',
 DOCUMENT_ID_SHA_NOT_ALLOWLISTED:'Документ не входит в список QA-A/QA-B.',
 DOCUMENT_SHA_MISMATCH:'SHA-256 документа не совпал.',
 DOCUMENT_SCHEMA_INVALID:'Неверная структура документа.',
 EXISTING_ROW_QUARANTINED:'В базе есть запись, которую нельзя безопасно восстановить.',
 EXISTING_ROW_SHA_MISMATCH:'Проверка существующего документа не прошла.',
 PREVIEW_STALE:'Данные изменились после предпросмотра. Запись запрещена.',
 CONCURRENT_CHANGE_ABORTED:'База изменилась в другой вкладке. Запись отменена.',
 POST_COMMIT_UNVERIFIED:'Документы могли сохраниться, но проверка после записи не удалась. Не повторяйте восстановление вслепую.'
};
function closeDb(){if(db){try{db.close()}catch{}db=null}}
function message(text,error=false){el('message').textContent=text;el('message').dataset.kind=error?'error':'info'}
function setBusy(next){busy=next;for(const id of ['backupFile','sample','previewButton','storageConsent','commitButton','writeConsent','cancel'])el(id).disabled=next||locked;}
function showDocs(docs,added=[]){
 const list=el('documents');list.replaceChildren();
 if(!docs.length){const li=document.createElement('li');li.textContent='Копия пустая — добавлять нечего.';list.append(li);return}
 for(const doc of docs){const li=document.createElement('li'),strong=document.createElement('strong'),span=document.createElement('span');
 strong.textContent=TITLES[doc.id];span.textContent=added.includes(doc.id)?'Будет добавлен':'Уже сохранён / ещё не проверен';
 li.append(strong,span);list.append(li)}
}
function resetView({keepSelected=false}={}){
 closeDb();plan=null;el('writeConsent').checked=false;el('previewCard').hidden=true;el('doneCard').hidden=true;
 if(!keepSelected){selectedText=null;selectedDocs=[];el('backupFile').value='';el('fileName').textContent='Копия ещё не выбрана';el('sourceCard').hidden=true;el('storageConsent').checked=false;}
 el('previewButton').disabled=!selectedText||!el('storageConsent').checked;
 el('commitButton').disabled=true;
}
async function selectText(text,name){
 if(busy||locked)return;
 resetView();setBusy(true);
 try{
  if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>contract.maxJsonBytes)throw Error('BACKUP_SIZE_INVALID');
  const docs=await parseBackup(text);
  selectedText=text;selectedDocs=docs;el('fileName').textContent=String(name).slice(0,100);
  el('sourceCard').hidden=false;showDocs(docs);
  message('Файл проверен по формату и SHA-256. Пока никаких обращений к IndexedDB не было.');phase='file';
 }catch(e){phase='error';message(ERROR_LABELS[e.code||e.message]||'Копия отклонена без обращения к базе.',true)}
 finally{setBusy(false);el('previewButton').disabled=!selectedText||!el('storageConsent').checked}
}
function unlockPlan(){el('previewButton').disabled=busy||locked||!selectedText||!el('storageConsent').checked}
async function preview(){
 if(busy||locked||!selectedText||!el('storageConsent').checked)return;
 setBusy(true);plan=null;el('previewCard').hidden=true;
 try{
  db=await openTestDb({loc:location,topLevel:window.top===window.self,idb:indexedDB,manualConsent:true});
  const result=await previewRestore(selectedText,db);
  if(result.acceptedDocs!==selectedDocs.length||result.wouldDelete!==0||result.wouldOverwrite!==0||
     !Array.isArray(result.wouldAdd)||!/^[a-f0-9]{64}$/.test(result.previewToken))throw Error('PREVIEW_INTEGRITY_DENIED');
  plan=result;phase='preview';el('previewCard').hidden=false;
  el('countAll').textContent=String(result.acceptedDocs);
  el('countNew').textContent=String(result.wouldAdd.length);
  el('countAlready').textContent=String(result.alreadyPresent);
  showDocs(selectedDocs,result.wouldAdd);
  el('writeConsent').checked=false;
  message(result.wouldAdd.length?'Предварительный просмотр готов. Для записи нужна отдельная галочка.':'Все документы уже есть. Перезапись не требуется.');
 }catch(e){closeDb();phase='error';message(ERROR_LABELS[e.code||e.message]||'Предварительная проверка отклонена; запись не выполнялась.',true)}
 finally{setBusy(false);unlockPlan();el('commitButton').disabled=true}
}
async function commit(){
 if(busy||locked||!plan||!db||!selectedText||!el('storageConsent').checked||!el('writeConsent').checked||!plan.wouldAdd.length)return;
 const token=plan.previewToken;plan=null;phase='committing';setBusy(true);
 message('Выполняется атомарная запись двух разрешённых учебных документов. Не закрывайте страницу.');
 try{
  const result=await commitSyntheticRestore(selectedText,db,{sandboxPermission:true,confirmation:'RESTORE_ONLY_PINNED_QA_FIXTURES',previewToken:token});
  if(!result.atomic||result.verifiedReadback!==true)throw Error('POST_COMMIT_UNVERIFIED');
  phase='done';el('previewCard').hidden=true;el('doneCard').hidden=false;
  el('doneText').textContent=`Добавлено: ${result.inserted}. Уже было: ${result.alreadyPresent}. Удалений и перезаписей: 0.`;
  message('Проверено: документы сохранены в локальной синтетической IndexedDB.');
 }catch(e){
  phase='uncertain';locked=true;el('previewCard').hidden=true;
  message(ERROR_LABELS[e.code||e.message]||'Результат сохранения не подтверждён. Не повторяйте запись вслепую.',true);
 }finally{closeDb();setBusy(false);if(locked){for(const id of ['backupFile','sample','previewButton','storageConsent','commitButton','writeConsent'])el(id).disabled=true}}
}
try{assertTestScope(location,window.top===window.self);message('TEST-кандидат готов. Выберите учебную JSON-копию или встроенный пример.');}
catch{locked=true;message('Этот экран допускается только на разрешённом локальном адресе или в отдельной TEST PWA.',true);}
el('backupFile').addEventListener('change',async()=>{
 const file=el('backupFile').files?.[0];if(!file||busy||locked)return;
 if(!/\.json$/i.test(file.name)||file.size<=0||file.size>contract.maxJsonBytes){message('Нужен JSON не более 3 МБ.',true);return}
 try{await selectText(await file.text(),file.name)}catch{message('Не удалось прочитать файл.',true)}
});
el('sample').addEventListener('click',async()=>{
 if(locked||busy)return;
 try{const r=await fetch('./tests/fixtures/synthetic_export.json',{cache:'no-store'});if(!r.ok)throw Error('SAMPLE_UNAVAILABLE');
 await selectText(await r.text(),'QA-A + QA-B · учебный пример');}
 catch{message('Не удалось загрузить учебный пример. Данные не изменены.',true)}
});
el('storageConsent').addEventListener('change',()=>{
 if(!el('storageConsent').checked&&plan){
  resetView({keepSelected:true});
  phase='file';
  message('Согласие на проверку базы снято. Предпросмотр аннулирован; повторите проверку перед записью.');
 }
 unlockPlan();
});
el('previewButton').addEventListener('click',preview);
el('writeConsent').addEventListener('change',()=>{el('commitButton').disabled=busy||locked||!plan||!plan.wouldAdd.length||!el('writeConsent').checked});
el('commitButton').addEventListener('click',commit);
el('cancel').addEventListener('click',()=>{if(busy||locked)return;resetView();phase='idle';message('Отменено. Документы не добавлялись; пустая схема IndexedDB, если была создана, не удалялась.')});
window.addEventListener('pagehide',closeDb);
if(locked){for(const id of ['backupFile','sample','previewButton','storageConsent','commitButton','writeConsent'])el(id).disabled=true}
