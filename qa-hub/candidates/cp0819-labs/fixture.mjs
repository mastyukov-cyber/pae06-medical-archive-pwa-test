/* Purely synthetic fixed fixture. Does NOT contain patient records, real ranges, or verified Mac evidence. */
export const ANALYTES = Object.freeze([
  {code:'hb',name:'Гемоглобин',group:'Общий анализ крови'},
  {code:'glucose',name:'Глюкоза',group:'Биохимия'},
  {code:'creatinine',name:'Креатинин',group:'Биохимия'},
  {code:'crp',name:'С-реактивный белок',group:'Воспаление'},
  {code:'ferritin',name:'Ферритин',group:'Железо'},
  {code:'vitd',name:'Витамин D (25-OH)',group:'Витамины'}
]);
// All values and reference intervals below are invented solely for UI evaluation.
const specs=[
 {code:'hb',unit:'г/л',method:'Фотометрия',ref:[130,170],values:[145,146,142,149]},
 {code:'glucose',unit:'ммоль/л',method:'Ферментативный',ref:[3.8,5.8],values:[4.8,4.7,5.0,4.9]},
 {code:'creatinine',unit:'мкмоль/л',method:'Энзиматический',ref:[60,105],values:[76,79,77,80]},
 {code:'crp',unit:'мг/л',method:'Иммунотурбидиметрия',ref:[0,5],values:[1.6,2.1,1.3,1.8]},
 {code:'ferritin',unit:'мкг/л',method:'Иммунохимический',ref:[25,280],values:[92,88,103,97]},
 {code:'vitd',unit:'нг/мл',method:'Иммуноанализ',ref:[20,55],values:[28,31,34,32]}
];
const dates=['2025-09-15','2026-02-18','2026-06-11','2026-11-06'];
let counter=0;
function makeRow(x,i){counter++;return {
 id:'demo-row-'+String(counter).padStart(3,'0'),code:x.code,value:x.values[i],unit:x.unit,
 method:x.method,reference:{low:x.ref[0],high:x.ref[1],unit:x.unit},
 collectedOn:dates[i],lab:i%2?'Учебная лаборатория Б':'Учебная лаборатория А',
 status:'human-confirmed',syntheticOnly:true,
 source:{kind:'mac-human-reviewed',documentId:'demo-doc-'+(i+1),reviewedOn:'2026-11-12'}
}}
const primary=specs.flatMap(x=>dates.map((_,i)=>makeRow(x,i)));
export const SYNTHETIC_RECORDS=Object.freeze([
 ...primary,
 {id:'demo-alt-unit',code:'glucose',value:92,unit:'мг/дл',method:'Другая методика',reference:{low:70,high:110,unit:'мг/дл'},collectedOn:'2026-10-12',lab:'Учебная лаборатория В',status:'human-confirmed',syntheticOnly:true,source:{kind:'mac-human-reviewed',documentId:'demo-doc-alt',reviewedOn:'2026-11-12'}},
 {id:'demo-pending-ocr',code:'glucose',value:18.5,unit:'ммоль/л',method:'Ферментативный',reference:{low:3.8,high:5.8,unit:'ммоль/л'},collectedOn:'2026-11-06',lab:'Учебная лаборатория А',status:'ocr-pending',syntheticOnly:true,source:{kind:'ocr-raw',documentId:'demo-doc-ocr',reviewedOn:null}},
 {id:'demo-corrupted-date',code:'crp',value:2.4,unit:'мг/л',method:'Иммунотурбидиметрия',reference:{low:0,high:5,unit:'мг/л'},collectedOn:'2026-02-31',lab:'Учебная лаборатория Б',status:'human-confirmed',syntheticOnly:true,source:{kind:'mac-human-reviewed',documentId:'demo-doc-err',reviewedOn:'2026-11-12'}},
 {id:'demo-not-synthetic',code:'hb',value:150,unit:'г/л',method:'Фотометрия',reference:{low:130,high:170,unit:'г/л'},collectedOn:'2026-11-06',lab:'Учебная лаборатория А',status:'human-confirmed',syntheticOnly:false,source:{kind:'mac-human-reviewed',documentId:'demo-doc-unsafe',reviewedOn:'2026-11-12'}}
]);
export const FIXTURE_AS_OF='2026-11-22';
