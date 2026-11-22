/* CP08.19 model: deterministic, pure, no IndexedDB/file/network APIs and no clinical inference. */
import {ANALYTES,FIXTURE_AS_OF} from './fixture.mjs';
const codes=new Set(ANALYTES.map(x=>x.code));
const isText=x=>typeof x==='string'&&x.trim().length>0&&x.length<=120;
const dateString=x=>{
 if(typeof x!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x))return false;
 const date=new Date(x+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===x;
};
export function validate(row){
 if(!row||typeof row!=='object'||Array.isArray(row))return 'INVALID_ROW';
 if(row.syntheticOnly!==true)return 'NOT_SYNTHETIC';
 if(row.status!=='human-confirmed'||row.source?.kind!=='mac-human-reviewed')return 'UNCONFIRMED_OR_OCR';
 if(!isText(row.id)||!row.id.startsWith('demo-'))return 'INVALID_ID';
 if(!codes.has(row.code))return 'UNKNOWN_ANALYTE';
 if(!dateString(row.collectedOn)||!dateString(row.source?.reviewedOn))return 'INVALID_DATE';
 if(!Number.isFinite(row.value)||Math.abs(row.value)>1000000)return 'INVALID_VALUE';
 if(!isText(row.unit)||!isText(row.method)||!isText(row.lab))return 'INVALID_METADATA';
 if(!row.reference||!Number.isFinite(row.reference.low)||!Number.isFinite(row.reference.high)||row.reference.high<row.reference.low||row.reference.unit!==row.unit)return 'INCOMPATIBLE_REFERENCE';
 if(!/^demo-doc-[a-z0-9-]+$/.test(row.source?.documentId||''))return 'UNVERIFIED_PROVENANCE';
 return null;
}
export function ingest(rows){
 if(!Array.isArray(rows))throw Error('INVALID_ROWS');
 const accepted=[],rejected=[],ids=new Set();
 for(const row of rows){let reason=validate(row);
  if(!reason&&ids.has(row.id))reason='DUPLICATE_ID';
  if(reason){rejected.push({id:typeof row?.id==='string'?row.id:'unknown',reason});continue}
  ids.add(row.id);
  accepted.push(Object.freeze({...row,reference:Object.freeze({...row.reference}),source:Object.freeze({...row.source})}));
 }
 accepted.sort((a,b)=>a.collectedOn.localeCompare(b.collectedOn)||a.code.localeCompare(b.code)||a.id.localeCompare(b.id));
 return Object.freeze({accepted:Object.freeze(accepted),rejected:Object.freeze(rejected)});
}
export const ANALYTE_META=Object.freeze(Object.fromEntries(ANALYTES.map(x=>[x.code,x])));
export function dateWindow(period='all',asOf=FIXTURE_AS_OF){
 if(!dateString(asOf))throw Error('INVALID_REFERENCE_DATE');
 if(period==='all')return null;
 if(!['6m','12m'].includes(period))throw Error('INVALID_PERIOD');
 const d=new Date(asOf+'T00:00:00Z');const month=d.getUTCMonth()-(period==='6m'?6:12);
 const originalDay=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(month);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(originalDay,last));
 return d.toISOString().slice(0,10);
}
export function periodRows(rows,period='all',asOf=FIXTURE_AS_OF){
 const cutoff=dateWindow(period,asOf);return rows.filter(r=>(!cutoff||r.collectedOn>=cutoff)&&r.collectedOn<=asOf);
}
export function series(rows,code,period='all',asOf=FIXTURE_AS_OF){
 if(!codes.has(code))throw Error('UNKNOWN_ANALYTE');
 const groups=new Map();for(const r of periodRows(rows,period,asOf)){
  if(r.code!==code)continue;
  // Unit + method are strict grouping keys. No cross-unit conversion or silent method merge.
  const key=JSON.stringify([r.unit,r.method]);if(!groups.has(key))groups.set(key,{code,label:ANALYTE_META[code].name,unit:r.unit,method:r.method,rows:[]});
  groups.get(key).rows.push(r);
 }
 return [...groups.values()].map(g=>({...g,rows:g.rows.sort((a,b)=>a.collectedOn.localeCompare(b.collectedOn)),latest:g.rows.at(-1)}));
}
export function comparison(rows,selected,period='all',asOf=FIXTURE_AS_OF){
 if(!Array.isArray(selected)||selected.length<1||selected.length>4||new Set(selected).size!==selected.length)throw Error('BAD_COMPARISON_SELECTION');
 return selected.flatMap(code=>series(rows,code,period,asOf));
}
export function overview(rows,{query='',period='all',lab='all'}={}){
 const q=String(query).trim().toLocaleLowerCase('ru-RU');const all=periodRows(rows,period);
 return all.filter(r=>(lab==='all'||r.lab===lab)&&(!q||(ANALYTE_META[r.code].name+' '+r.unit+' '+r.lab+' '+r.collectedOn).toLocaleLowerCase('ru-RU').includes(q)))
  .sort((a,b)=>b.collectedOn.localeCompare(a.collectedOn)||ANALYTE_META[a.code].name.localeCompare(ANALYTE_META[b.code].name,'ru-RU'));
}
export function countAnalytes(rows){return new Set(rows.map(r=>r.code)).size}
export function buildChartPoints(rows){
 if(!Array.isArray(rows)||!rows.length)return [];
 const values=rows.map(r=>r.value),lo=Math.min(...values),hi=Math.max(...values),margin=Math.max((hi-lo)*.15,.5),min=lo-margin,max=hi+margin;
 return rows.map((r,i)=>({x:rows.length===1?260:55+i*(470/(rows.length-1)),y:195-(r.value-min)/(max-min)*160,row:r}));
}
