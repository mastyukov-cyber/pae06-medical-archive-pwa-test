/* CP08.10 — isolated synthetic-only Mac-derived card preview. No browser storage or network API. */
import { classifyBatch, makeSyntheticFixture } from './mac-derived-adapter.mjs';
const status=document.getElementById('macDerivedStatus');
const host=document.getElementById('macDerivedList');
if(status && host){
  const report=classifyBatch([makeSyntheticFixture('A'), makeSyntheticFixture('B')]);
  const text=(tag,message,cls='')=>{
    const el=document.createElement(tag);
    el.textContent=message;
    if(cls)el.className=cls;
    return el;
  };
  host.replaceChildren();
  if(report.accepted.length!==2 || report.quarantined.length){
    status.textContent='BLOCKED: учебный источник не прошёл проверку; карточки не отображаются.';
  }else{
    status.textContent='2/2 учебные карточки проверены локальным макетным контрактом. Реальный экспорт Mac не подключён.';
    for(const card of report.accepted){
      const article=document.createElement('article');
      article.className='macderived-card';
      article.append(
        text('h4',card.title),
        text('p',`Синтетический источник: ${card.sourceDocumentId} · ревизия ${card.revision}`),
        text('p',`Страниц в учебном образце: ${card.pageCount}`),
        text('p',`Дата документа: ${card.documentDate||'НЕ УКАЗАНА'}`),
        text('p',`Связь с пациентом: ${card.patientMapping}`,'macderived-unknown'),
        text('p',`Статус проверки: ${card.review} · ${card.lab}`),
        text('code',`Эталонный SHA-256 учебного файла (метка, НЕ повторная проверка PDF): ${card.originalSha256}`)
      );
      host.append(article);
    }
  }
}
