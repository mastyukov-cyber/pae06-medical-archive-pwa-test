import {CONTRACT} from './adapter.mjs';
const src=(doc,review='2026-11-20')=>({kind:'mac-human-reviewed',documentId:doc,reviewedOn:review,revision:1,originalSha256:'a'.repeat(64)});
const make=(id,code,value,date,unit,method,specimen,source)=>({id,code,value,unit,method,specimen,lab:'Учебная лаборатория',collectedOn:date,
 reference:{low:code==='glucose'?3.5:0,high:code==='glucose'?6:10,unit},source,status:'human-confirmed',syntheticOnly:true});
export const rows=Object.freeze([
 make('demo-glu-01','glucose',4.4,'2026-01-12','ммоль/л','Энзиматический','Сыворотка',src('demo-doc-01')),
 make('demo-glu-02','glucose',5.0,'2026-11-12','ммоль/л','Энзиматический','Сыворотка',src('demo-doc-02')),
 make('demo-crp-01','crp',2.1,'2026-11-12','мг/л','Иммунотурбидиметрия','Сыворотка',src('demo-doc-02'))
]);
export const envelope=()=>({schema:CONTRACT,channel:'TEST',syntheticOnly:true,readOnly:true,patientBinding:'UNVERIFIED',
 producer:'PAE06_SYNTHETIC_QA',generatedAt:'2026-11-22T00:00:00.000Z',records:structuredClone(rows)});
