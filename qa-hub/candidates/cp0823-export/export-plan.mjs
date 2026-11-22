/* PAE-06 CP08.23 — pure export selection and PREVIEW plan, synthetic only.
   No files, no blobs, no print, no IO, no browser/medical access. */
import {classifySyntheticLabEnvelope,compareDateResults} from '../cp0822-bplus-contract/adapter.mjs';

const GROUPS=Object.freeze({hb:'Общий анализ крови',glucose:'Биохимия',creatinine:'Биохимия',crp:'Воспаление',ferritin:'Железо',vitd:'Витамины'});
const NAMES=Object.freeze({hb:'Гемоглобин',glucose:'Глюкоза',creatinine:'Креатинин',crp:'С-реактивный белок',ferritin:'Ферритин',vitd:'Витамин D (25-OH)'});
const FORMATS=['PDF','XLSX','CSV'], TEMPLATES=['brief','full'];
const SCOPES=['one','indicator','group','study','dates','selection','all','doctor'];
const PERIODS=['latest','3y','all','custom'];
const OPTIONS=['format','template','scope','period','id','code','group','studyDate','selectedDates','selectedCodes','from','to','lab','includeGraphs','includePersonal','includeOriginals'];
const isPlain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const ymd=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const values=(arr)=>Array.isArray(arr)&&arr.length<=200&&arr.every(x=>typeof x==='string'&&x.length<=120)&&new Set(arr).size===arr.length;
const error=(reason)=>Object.freeze({ok:false,reason,rows:Object.freeze([]),warnings:Object.freeze([reason]),allowSave:false,allowSend:false});
export const OPTIONS_DEFAULT=Object.freeze({format:'PDF',template:'brief',scope:'all',period:'all',id:'',code:'',group:'',studyDate:'',selectedDates:[],selectedCodes:[],from:'',to:'',lab:'all',includeGraphs:true,includePersonal:false,includeOriginals:false});
export const LABELS=Object.freeze({groups:GROUPS,names:NAMES,formats:FORMATS,templates:TEMPLATES,scopes:SCOPES,periods:PERIODS});
function normalizedOptions(input){
 if(!isPlain(input)||Object.keys(input).some(k=>!OPTIONS.includes(k)))return null;
 const o={...OPTIONS_DEFAULT,...input};
 if(!FORMATS.includes(o.format)||!TEMPLATES.includes(o.template)||!SCOPES.includes(o.scope)||!PERIODS.includes(o.period))return null;
 if(!['id','code','group','studyDate','from','to','lab'].every(k=>typeof o[k]==='string'&&o[k].length<=120))return null;
 if(!values(o.selectedDates)||!values(o.selectedCodes)||o.selectedDates.some(x=>!ymd(x))||o.selectedCodes.some(x=>!own(GROUPS,x)))return null;
 if(['includeGraphs','includePersonal','includeOriginals'].some(k=>typeof o[k]!=='boolean'))return null;
 if(o.lab!== 'all' && !o.lab.trim())return null;
 if(o.from && !ymd(o.from) || o.to && !ymd(o.to) || o.from && o.to && o.from>o.to)return null;
 if(o.period==='custom'&&(!o.from||!o.to))return null;
 if(o.studyDate && !ymd(o.studyDate))return null;
 if(o.scope==='dates'&&!o.selectedDates.length || o.scope==='selection'&&!o.selectedCodes.length && !o.selectedDates.length)return null;
 if(o.scope==='one'&&!o.id||o.scope==='indicator'&&!own(GROUPS,o.code)||o.scope==='group'&&!Object.values(GROUPS).includes(o.group)||o.scope==='study'&&!o.studyDate)return null;
 return o;
}
function start3y(asOf){let year=Number(asOf.slice(0,4))-3,mon=asOf.slice(5,7),day=Number(asOf.slice(8));let m=Number(mon);let last=new Date(Date.UTC(year,m,0)).getUTCDate();return `${year}-${mon}-${String(Math.min(day,last)).padStart(2,'0')}`;}
const serial=r=>Object.freeze({id:r.id,code:r.code,name:NAMES[r.code],group:GROUPS[r.code],collectedOn:r.collectedOn,value:r.value,unit:r.unit,reference:Object.freeze({...r.reference}),method:r.method,specimen:r.specimen,lab:r.lab,sourceDocumentId:r.source.documentId,sourceRevision:r.source.revision,reviewedOn:r.source.reviewedOn,confirmedForSyntheticPreview:true});

export function buildExportPreview(envelope,selected={}){
 const o=normalizedOptions(selected);if(!o)return error('INVALID_EXPORT_OPTIONS');
 const result=classifySyntheticLabEnvelope(envelope);if(!result.ok)return error('SOURCE_'+result.reason);
 const warnings=[];
 if(result.quarantined.length)warnings.push(`Исключено неподтверждённых/неверных строк: ${result.quarantined.length}`);
 if(o.includePersonal)warnings.push('Персональные данные недоступны: привязка пациента не подтверждена; в предпросмотр не включены');
 if(o.includeOriginals)warnings.push('Оригинальные PDF недоступны и не прикреплены; требуется отдельное явное разрешение и проверка метаданных');
 if(o.format!=='PDF'&&o.includeGraphs)warnings.push('Графики отмечены для будущей реализации; для табличных форматов их содержание не сформировано');
 let rows=[...result.accepted];
 const asOf=envelope.generatedAt.slice(0,10);
 if(o.lab!=='all')rows=rows.filter(r=>r.lab===o.lab);
 // Period is independent from scope. Latest applies to selected laboratory's latest study.
 if(o.period==='latest'){const last=rows.map(r=>r.collectedOn).sort().at(-1);rows=rows.filter(r=>r.collectedOn===last)}
 if(o.period==='3y')rows=rows.filter(r=>r.collectedOn>=start3y(asOf)&&r.collectedOn<=asOf);
 if(o.period==='custom')rows=rows.filter(r=>r.collectedOn>=o.from&&r.collectedOn<=o.to);
 if(o.scope==='one')rows=rows.filter(r=>r.id===o.id);
 else if(o.scope==='indicator')rows=rows.filter(r=>r.code===o.code);
 else if(o.scope==='group')rows=rows.filter(r=>GROUPS[r.code]===o.group);
 else if(o.scope==='study')rows=rows.filter(r=>r.collectedOn===o.studyDate);
 else if(o.scope==='dates')rows=rows.filter(r=>o.selectedDates.includes(r.collectedOn));
 else if(o.scope==='selection'||o.scope==='doctor'){
  const codes=o.selectedCodes.length?o.selectedCodes:['hb','glucose','crp'];
  rows=rows.filter(r=>(o.scope==='doctor'?codes.includes(r.code):(!o.selectedCodes.length||codes.includes(r.code)))&&(!o.selectedDates.length||o.selectedDates.includes(r.collectedOn)));
 }
 rows.sort((a,b)=>a.collectedOn.localeCompare(b.collectedOn)||a.code.localeCompare(b.code)||a.id.localeCompare(b.id));
 const fullRows=rows;
 if(o.template==='brief'){
  const latest2=new Map();for(let i=rows.length-1;i>=0;i--){const r=rows[i];if(!latest2.has(r.code))latest2.set(r.code,[]);if(latest2.get(r.code).length<2)latest2.get(r.code).push(r.id)}
  const ids=new Set([...latest2.values()].flat());rows=rows.filter(r=>ids.has(r.id));
  if(rows.length<fullRows.length)warnings.push('Краткий шаблон показывает последние два значения каждого выбранного показателя; остальные значения не показаны в этом предпросмотре');
 }
 if(!rows.length)warnings.push('Нет подтверждённых синтетических результатов по выбранным условиям');
 const changes=[];
 for(const code of [...new Set(rows.map(r=>r.code))]){
  const items=rows.filter(r=>r.code===code).sort((a,b)=>b.collectedOn.localeCompare(a.collectedOn));
  if(items.length>1){const d=compareDateResults(items[0],items[1]);changes.push(Object.freeze({code,name:NAMES[code],latest:items[0].collectedOn,previous:items[1].collectedOn,comparable:d.comparable,delta:d.comparable?d.delta:null,unit:d.comparable?d.unit:null,reason:d.comparable?null:d.reason}));}
 }
 const display=Object.freeze(rows.map(serial));
 return Object.freeze({ok:true,reason:null,format:o.format,template:o.template,scope:o.scope,period:o.period,rows:display,
 changes:Object.freeze(changes),warnings:Object.freeze(warnings),studyDates:Object.freeze([...new Set(rows.map(r=>r.collectedOn))].sort().reverse()),
 labNames:Object.freeze([...new Set(rows.map(r=>r.lab))].sort()),
 acceptedSourceCount:result.accepted.length,quarantinedCount:result.quarantined.length,
 selectedCount:rows.length,availableBeforeTemplate:fullRows.length,
 privacy:Object.freeze({patientBindingVerified:false,personalFieldsIncluded:false,originalPdfsIncluded:false,metadataPrivacyReviewed:false}),
 evidence:Object.freeze({...result.evidence}),allowSave:false,allowSend:false,finalFileAvailable:false,
 actualPageCount:null,actualFileBytes:null,outputDisclaimer:'Состав и строки подтверждены только на синтетике. Финальный PDF/XLSX/CSV, точное число страниц и размер файла НЕ СОЗДАНЫ и НЕ РАССЧИТАНЫ.'});
}
