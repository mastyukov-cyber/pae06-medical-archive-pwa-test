/* All additional rows are invented. The original CP08.22 fixture remains unchanged. */
import {envelope as original} from '../cp0822-bplus-contract/fixture.mjs';
const source=(n,date)=>({kind:'mac-human-reviewed',documentId:'demo-doc-'+n,reviewedOn:'2026-11-20',revision:1,originalSha256:'b'.repeat(64)});
const row=(id,code,value,unit,method,specimen,date,lab,low,high)=>({id,code,value,unit,method,specimen,lab,collectedOn:date,reference:{low,high,unit},source:source(id,date),status:'human-confirmed',syntheticOnly:true});
export function syntheticEnvelope(){
 const e=original();e.records.push(
 row('demo-add-01','hb',143,'г/л','Фотометрия','Кровь','2024-06-05','Учебная лаборатория',120,165),
 row('demo-add-02','hb',148,'г/л','Фотометрия','Кровь','2026-11-12','Учебная лаборатория',120,165),
 row('demo-add-03','glucose',4.7,'ммоль/л','Энзиматический','Сыворотка','2025-01-08','Учебная лаборатория',3.5,6),
 row('demo-add-04','glucose',93,'мг/дл','Другая методика','Плазма','2026-10-10','Учебная лаборатория Б',65,110),
 row('demo-add-05','crp',1.8,'мг/л','Иммунотурбидиметрия','Сыворотка','2024-12-01','Учебная лаборатория Б',0,5),
 row('demo-add-06','ferritin',90,'мкг/л','Иммунохимический','Сыворотка','2026-02-02','Учебная лаборатория Б',15,220),
 row('demo-add-07','vitd',29,'нг/мл','Иммуноанализ','Сыворотка','2026-02-02','Учебная лаборатория',20,60),
 row('demo-add-08','glucose',4.9,'ммоль/л','Энзиматический','Сыворотка','2022-10-10','Учебная лаборатория',3.5,6)
 );
 const pending=structuredClone(e.records[0]);pending.id='demo-ocr-pending';pending.status='ocr-pending';e.records.push(pending);
 const unknown=structuredClone(e.records[1]);unknown.id='demo-extra-field';unknown.secret='must be excluded';e.records.push(unknown);
 return e;
}
