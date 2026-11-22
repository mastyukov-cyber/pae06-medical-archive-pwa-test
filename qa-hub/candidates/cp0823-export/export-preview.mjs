/* View-only HTML preview — no file creation, printing or sharing. */
import {buildExportPreview,LABELS} from './export-plan.mjs';
import {syntheticEnvelope} from './synthetic-fixture.mjs';
const records=syntheticEnvelope().records.filter(r=>r?.syntheticOnly&&r.status==='human-confirmed');
const $=id=>document.getElementById(id);
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=x=>x.map(([v,t])=>`<option value="${escapeHTML(v)}">${escapeHTML(t)}</option>`).join('');
function init(){
 $('code').innerHTML=opts(Object.entries(LABELS.names));
 $('group').innerHTML=opts([...new Set(Object.values(LABELS.groups))].map(x=>[x,x]));
 $('id').innerHTML=opts(records.map(x=>[x.id,`${LABELS.names[x.code]} · ${x.collectedOn} · ${x.value} ${x.unit}`]));
 const dates=[...new Set(records.map(x=>x.collectedOn))].sort().reverse();
 $('studyDate').innerHTML=opts(dates.map(x=>[x,x]));
 $('lab').innerHTML=opts([['all','Все лаборатории'],...[...new Set(records.map(x=>x.lab))].sort().map(x=>[x,x])]);
 const doctorDefaults=new Set(['hb','glucose','crp']);
 $('selectedCodes').innerHTML=Object.entries(LABELS.names).map(([v,t])=>`<label><input type="checkbox" name="codes" value="${v}" ${doctorDefaults.has(v)?'checked':''}>${escapeHTML(t)}</label>`).join('');
 $('selectedDates').innerHTML=dates.map(x=>`<label><input type="checkbox" name="dates" value="${x}" checked>${escapeHTML(x)}</label>`).join('');
 document.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',update));
 $('refresh').addEventListener('click',update);update();
}
function selected(name){return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value)}
function update(){
 const o={format:$('format').value,template:$('template').value,scope:$('scope').value,period:$('period').value,id:$('id').value,
  code:$('code').value,group:$('group').value,studyDate:$('studyDate').value,selectedDates:selected('dates'),selectedCodes:selected('codes'),
  from:$('from').value,to:$('to').value,lab:$('lab').value,includeGraphs:$('includeGraphs').checked,
  includePersonal:$('includePersonal').checked,includeOriginals:$('includeOriginals').checked};
 const p=buildExportPreview(syntheticEnvelope(),o);
 $('status').textContent=p.ok?'Файл не создан':'Выбор отклонён';$('count').textContent=p.ok?p.selectedCount:0;
 $('studies').textContent=p.ok?p.studyDates.length:0;$('quarantine').textContent=p.ok?p.quarantinedCount:'—';
 $('warnings').innerHTML=(p.warnings||[]).map(x=>`<p>⚠ ${escapeHTML(x)}</p>`).join('');
 $('results').innerHTML=p.rows?.length?p.rows.map(r=>`<tr><td>${escapeHTML(r.collectedOn)}</td><td>${escapeHTML(r.name)}</td><td>${escapeHTML(r.value)} ${escapeHTML(r.unit)}</td><td>${escapeHTML(r.reference.low)}–${escapeHTML(r.reference.high)} ${escapeHTML(r.unit)}</td><td>${escapeHTML(r.lab)}</td><td>${escapeHTML(r.method)} · ${escapeHTML(r.specimen)}</td></tr>`).join(''):'<tr><td colspan="6">Нет подходящих проверенных синтетических результатов</td></tr>';
 $('changes').innerHTML=p.changes?.length?p.changes.map(c=>`<div class="change"><span>${escapeHTML(c.name)} · ${escapeHTML(c.latest)} / ${escapeHTML(c.previous)}</span><em>${c.comparable?escapeHTML((c.delta>0?'+':'')+c.delta+' '+c.unit):'Несопоставимо ('+escapeHTML(c.reason)+')'}</em></div>`).join(''):'<p>Нет пары сопоставимых дат для расчёта изменений.</p>';
 $('metadata').textContent=(p.outputDisclaimer||p.reason)+' Персональные поля: НЕ включены. Оригиналы PDF: НЕ включены. Система не проверяла реальную личность Mac, источники PDF или медицинские назначения. Точный итоговый файл, страницы и объём недоступны.';
}
init();
