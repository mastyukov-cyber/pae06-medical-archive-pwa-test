/* PAE-06 CP08.22 isolated B+ integration. No network, persistence or real Mac authorization. */
import {ANALYTES} from '../cp0819-labs/fixture.mjs';
import {ANALYTE_META,periodRows,series} from '../cp0819-labs/lab-core.mjs';
import {accepted as candidateRows,excludedCount,evidence} from './data-source.mjs';
import {compareDateResults} from './adapter.mjs';
// Demo SHA labels and "human-confirmed" rows do not confer clinical authority.
const syntheticPreviewOnly=evidence?.syntheticOnly===true&&evidence.readOnly===true&&
 evidence.realMacIdentityVerified===false&&evidence.originalPdfBytesVerified===false&&
 evidence.clinicalAuthority===false;
const accepted=syntheticPreviewOnly?candidateRows:Object.freeze([]);
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(n);
const dateFmt=s=>s?.split('-').reverse().join('.')||'—';
const outside=r=>!!r&&(r.value<r.reference.low||r.value>r.reference.high);
const groups=['Все группы',...new Set(ANALYTES.map(a=>a.group))];
const dates=[...new Set(accepted.map(r=>r.collectedOn))].sort().reverse();
const labs=['all',...new Set(accepted.map(r=>r.lab))];
const state={group:'Все группы',query:'',period:'all',lab:'all',onlyFav:false,sort:'name',mode:'single',selected:'crp',chosen:new Set(['crp','hb']),favorites:new Set(['hb','crp']),dateA:'2026-11-18',dateB:'2026-11-06',chartPeriod:'all',tableScrollX:0,tableScrollY:0,detailRow:null,exScope:'indicator',exPicked:new Set(['hb','crp']),exDates:new Set(['2026-11-18','2026-11-06'])};
function notice(text){const node=$('toast');node.textContent=text;node.hidden=false;node.dataset.shown='1';}
function allFilteredRows(){return periodRows(accepted,state.period).filter(r=>(state.group==='Все группы'||ANALYTE_META[r.code].group===state.group)&&(state.lab==='all'||r.lab===state.lab));}
function availableAnalytes(){let result=ANALYTES.filter(a=>(state.group==='Все группы'||a.group===state.group)&&a.name.toLocaleLowerCase('ru').includes(state.query.toLocaleLowerCase('ru'))&&(!state.onlyFav||state.favorites.has(a.code)));
 if(state.sort==='deviation'){result=result.slice().sort((a,b)=>Number(isCodeOut(b.code))-Number(isCodeOut(a.code))||a.name.localeCompare(b.name,'ru'))}else result=result.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 return result;
}
function newest(code,rows=allFilteredRows()){return rows.filter(r=>r.code===code).sort((a,b)=>b.collectedOn.localeCompare(a.collectedOn)||a.id.localeCompare(b.id))[0]||null;}
function isCodeOut(code){return outside(newest(code));}
function rowsFor(code,rows=allFilteredRows()){const raw=rows.filter(r=>r.code===code).sort((a,b)=>a.collectedOn.localeCompare(b.collectedOn));if(!raw.length)return [];
 const latest=raw.at(-1),match=raw.filter(r=>r.unit===latest.unit&&r.method===latest.method&&r.specimen===latest.specimen);
 return match;
}
function comparable(a,b){return compareDateResults(a,b).comparable;}
function calcDelta(a,b){if(!a||!b)return {value:'—',reason:'Нет пары'};if(a.collectedOn===b.collectedOn)return {value:'—',reason:'Одна дата'};if(!comparable(a,b))return {value:'—',reason:'Несопоставимо'};const n=a.value-b.value;return {value:(n>0?'+':'')+fmt(n,2),reason:a.unit,number:n};}
function init(){
 $('groupChips').innerHTML=groups.map(g=>`<button type="button" class="group-chip ${g===state.group?'selected':''}" data-group="${esc(g)}" aria-pressed="${g===state.group}">${esc(g)}</button>`).join('');
 const labOptions=labs.map(x=>`<option value="${esc(x)}">${esc(x==='all'?'Все лаборатории':x)}</option>`).join('');
 $('lab').innerHTML=labOptions;$('exLab').innerHTML=labOptions;
 $('search').addEventListener('input',e=>{state.query=e.target.value;render()});
 $('period').addEventListener('change',e=>{state.period=e.target.value;render()});
 $('lab').addEventListener('change',e=>{state.lab=e.target.value;render()});
 $('sort').addEventListener('change',e=>{state.sort=e.target.value;render()});
 $('favoritesToggle').addEventListener('click',()=>{state.onlyFav=!state.onlyFav;render()});
 $('dateA').addEventListener('change',e=>{state.dateA=e.target.value;renderTable()});
 $('dateB').addEventListener('change',e=>{state.dateB=e.target.value;renderTable()});
 $('openExport').addEventListener('click',()=>openExport('indicator'));
 $('closeResult').addEventListener('click',()=>$('resultDialog').close());
 $('closeExport').addEventListener('click',()=>$('exportDialog').close());
 $('sourceBtn').addEventListener('click',()=>notice('Оригинальный PDF не подключён к синтетическому кандидату. Никакой файл не открывался.'));
 $('resultExportBtn').addEventListener('click',()=>{$('resultDialog').close();openExport('one')});
 $('buildPreview').addEventListener('click',renderExportPreview);
 ['exScope','exPeriod','exFormat','exTemplate','exLab','exFrom','exTo','exCharts','exPersonal','exOriginal'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='exPeriod')$('customDates').hidden=$('exPeriod').value!=='custom';renderExportPreview()}));
 document.addEventListener('click',clickHandler);
 document.addEventListener('keydown',e=>{const target=e.target.closest?.('[data-action="point"]');if(target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const index=Number(target.dataset.index);const rows=rowsFor(state.selected);if(rows[index])openResult(rows[index]);}});
 render();
}
function clickHandler(e){const btn=e.target.closest('[data-group],[data-mode],[data-action]');if(!btn)return;
 if(btn.dataset.group!==undefined){state.group=btn.dataset.group;render();return}
 if(btn.dataset.mode){state.mode=btn.dataset.mode;render();return}
 const action=btn.dataset.action,code=btn.dataset.code;
 if(action==='favorite'){state.favorites.has(code)?state.favorites.delete(code):state.favorites.add(code);render();return}
 if(action==='choose'){
  if(state.mode==='multiple'){state.chosen.has(code)?(state.chosen.size>1&&state.chosen.delete(code)):state.chosen.add(code);if(state.chosen.size>4){state.chosen.delete(code);notice('Можно сравнить не более четырёх показателей.');return}}
  state.selected=code;render();return;
 }
 if(action==='cell'){const row=accepted.find(r=>r.id===btn.dataset.id);if(row)openResult(row);return}
 if(action==='point'){const rows=rowsFor(code);const i=Number(btn.dataset.index);if(rows[i])openResult(rows[i]);return}
 if(action==='table-select'){state.selected=code;render();return}
 if(action==='ex-pick'){if(btn.checked)state.exPicked.add(code);else state.exPicked.delete(code);renderExportPreview();return}
 if(action==='ex-date'){if(btn.checked)state.exDates.add(btn.dataset.date);else state.exDates.delete(btn.dataset.date);renderExportPreview();return}
}
function render(){const av=availableAnalytes(),visibleRows=allFilteredRows();
 $('groupChips').querySelectorAll('button').forEach(b=>{const on=b.dataset.group===state.group;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 $('favoritesToggle').classList.toggle('pressed',state.onlyFav);$('favoritesToggle').setAttribute('aria-pressed',String(state.onlyFav));$('favoritesToggle').textContent=state.onlyFav?'★ Избранное':'☆ Избранное';
 $('filterMeta').textContent=visibleRows.length+' учебных результатов · '+excludedCount+' исключено';$('visibleSummary').textContent='Учебная динамика · личность Mac и PDF не проверены';
 document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===state.mode;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on))});
 $('analyteCount').textContent=av.length+' из '+ANALYTES.length;
 $('analyteList').innerHTML=av.length?av.map(a=>{const r=newest(a.code),active=a.code===state.selected;return `<div class="analyte-row ${active?'selected':''}"><button type="button" class="star ${state.favorites.has(a.code)?'chosen':''}" aria-label="${state.favorites.has(a.code)?'Убрать из избранного':'В избранное'}: ${esc(a.name)}" data-action="favorite" data-code="${esc(a.code)}">${state.favorites.has(a.code)?'★':'☆'}</button><button type="button" class="analyte-text" data-action="choose" data-code="${esc(a.code)}" style="background:transparent;border:0;text-align:left;padding:0"><div class="analyte-name">${esc(a.name)}</div><div class="analyte-sub">${esc(a.group)}</div></button><div class="analyte-value ${outside(r)?'out':''}">${r?fmt(r.value):'—'}<small>${esc(r?.unit||'')}</small></div></div>`}).join(''):'<div class="chart-empty">Нет показателей по фильтру</div>';
 if(!av.some(a=>a.code===state.selected)&&av.length)state.selected=av[0].code;
 renderChart();renderTable();
}
function renderChart(){const code=state.selected,meta=ANALYTE_META[code],r=rowsFor(code),latest=r.at(-1),prev=r.at(-2),delta=calcDelta(latest,prev);
 if(!latest){$('chartPanel').innerHTML='<div class="chart-empty">Нет учебных результатов за выбранный период</div>';return}
 const metric=(label,value,unit,foot,klass='')=>`<div class="metric-card"><small>${esc(label)}</small><strong class="${klass}">${esc(value)} <em>${esc(unit||'')}</em></strong><span class="metric-foot">${esc(foot||'')}</span></div>`;
 const extra=state.mode==='multiple'?`<div class="multi-results">${[...state.chosen].map(c=>{const n=newest(c);return `<button class="multi-chip" type="button" data-action="choose" data-code="${esc(c)}">${esc(ANALYTE_META[c].name)} · ${n?fmt(n.value)+' '+n.unit:'нет данных'}</button>`}).join('')}</div>`:state.mode==='all'?'<div class="multi-results"><span class="multi-chip">Все показатели доступны в таблице ниже</span></div>':'';
 $('chartPanel').innerHTML=`<div class="chart-top"><div><div class="chart-title">${esc(meta.name)}</div><div class="chart-sub">${esc(meta.group)} · ${esc(latest.method)} · ${esc(latest.specimen)}</div></div><div class="chart-tools"><span class="chart-tool active">Динамика</span><span class="chart-tool">${r.length} точек</span></div></div>
 <div class="metric-cards">${metric('ПОСЛЕДНИЙ РЕЗУЛЬТАТ',fmt(latest.value),latest.unit,dateFmt(latest.collectedOn),outside(latest)?'value-down':'')}${metric('ПРЕДЫДУЩИЙ',prev?fmt(prev.value):'—',prev?.unit||'',prev?dateFmt(prev.collectedOn):'Нет данных')}${metric('ИЗМЕНЕНИЕ',delta.value,delta.reason==='Нет пары'||delta.reason==='Несопоставимо'?'':latest.unit,delta.reason==='Нет пары'?'Нет сравнимой пары':delta.reason==='Несопоставимо'?'Нельзя сравнить': 'По сравнению с предыдущим')}${metric('РЕФЕРЕНС',fmt(latest.reference.low)+'–'+fmt(latest.reference.high),latest.unit,'Лаборатория последнего результата')}</div>${plotSVG(r,code)}<div class="chart-foot"><span>Учебные значения по датам примера · <strong>${esc(latest.lab)}</strong></span><span>${outside(latest)?'● Вне референса источника':'● В референсе источника'} · без медицинской интерпретации</span></div>${extra}`;
}
function plotSVG(rows,code){if(!rows.length)return'';const W=760,H=218,L=48,R=18,T=12,B=35;
 const nums=rows.map(r=>r.value),lo=Math.min(...nums),hi=Math.max(...nums),pad=Math.max((hi-lo)*.20,.4),min=lo-pad,max=hi+pad;
 const stamps=rows.map(r=>Date.parse(r.collectedOn+'T00:00:00Z')),start=Math.min(...stamps),end=Math.max(...stamps),spread=end-start||1;
 const coords=rows.map((r,i)=>({x:L+(W-L-R)*(stamps[i]-start)/spread,y:H-B-(r.value-min)/(max-min)*(H-T-B),r,i}));
 const lines=Array.from({length:5},(_,i)=>{const y=T+i*(H-T-B)/4;return `<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#e9eff7" stroke-dasharray="3 4"/><text x="${L-8}" y="${y+4}" font-size="10" text-anchor="end" fill="#9aadc1">${fmt(max-(max-min)*i/4)}</text>`}).join('');
 const points=coords.map(p=>`<g><circle cx="${p.x}" cy="${p.y}" r="6" fill="white" stroke="${outside(p.r)?'#de935c':'#1878e8'}" stroke-width="3" tabindex="0" role="button" data-action="point" data-code="${esc(code)}" data-index="${p.i}" aria-label="${esc(dateFmt(p.r.collectedOn))}: ${fmt(p.r.value)} ${esc(p.r.unit)}"><title>${esc(dateFmt(p.r.collectedOn))}: ${fmt(p.r.value)} ${esc(p.r.unit)}</title></circle><text x="${p.x}" y="${H-9}" text-anchor="middle" font-size="10" fill="#96a8bc">${p.i===0||p.i===coords.length-1||(p.i>0&&p.i<coords.length-1&&coords[p.i+1].x-p.x>64&&p.x-coords[p.i-1].x>64)?esc(dateFmt(p.r.collectedOn).slice(0,5)):''}</text></g>`).join('');
 const path=coords.map(p=>`${p.x},${p.y}`).join(' ');
 return `<svg class="large-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Учебный график ${esc(ANALYTE_META[code].name)} в ${esc(rows[0].unit)}. Точки расположены по фактическому расстоянию между датами.">${lines}${coords.length>1?`<polyline points="${path}" fill="none" stroke="#1878e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`:''}${points}</svg>`;
}
function renderTable(){const host=$('resultsGrid'),prevX=host.scrollLeft||state.tableScrollX,prevY=host.scrollTop||state.tableScrollY;
 const rows=allFilteredRows(),av=availableAnalytes(),codes=av.map(a=>a.code);
 const dateList=[...new Set(rows.map(r=>r.collectedOn))].sort().reverse();if(!dateList.includes(state.dateA))state.dateA=dateList[0]||'';if(!dateList.includes(state.dateB))state.dateB=dateList[1]||dateList[0]||'';
 for(const field of ['dateA','dateB']){$(field).innerHTML=dateList.map(d=>`<option value="${esc(d)}">${esc(dateFmt(d))}</option>`).join('');$(field).value=state[field]}
 const head=`<thead><tr><th>ПОКАЗАТЕЛЬ</th>${dateList.map(d=>`<th class="${d===state.dateA||d===state.dateB?'selected-date':''}">${esc(dateFmt(d))}<span class="date-line">${d===state.dateA?'Дата A':d===state.dateB?'Дата B':'Исследование'}</span></th>`).join('')}<th>ЕДИНИЦЫ</th><th>Δ (A − B)</th></tr></thead>`;
 const body=codes.map(code=>{const meta=ANALYTE_META[code],entries=rows.filter(r=>r.code===code),latest=newest(code,rows);const at=d=>entries.filter(r=>r.collectedOn===d).sort((a,b)=>a.id.localeCompare(b.id))[0];const a=at(state.dateA),b=at(state.dateB),diff=calcDelta(a,b);
 return `<tr class="${code===state.selected?'highlighted':''}"><th><div class="table-name"><button class="row-star" type="button" data-action="favorite" data-code="${esc(code)}" aria-label="Избранное ${esc(meta.name)}">${state.favorites.has(code)?'★':'☆'}</button><button type="button" data-action="table-select" data-code="${esc(code)}" style="border:0;background:transparent;text-align:left;color:inherit;font-weight:760;padding:0">${esc(meta.name)}</button></div></th>${dateList.map(d=>{const r=at(d);return `<td class="${d===state.dateA||d===state.dateB?'selected-date':''}">${r?`<button class="measure ${outside(r)?'out':''}" data-action="cell" data-id="${esc(r.id)}" type="button" aria-label="${esc(meta.name)}, ${esc(dateFmt(r.collectedOn))}, ${fmt(r.value)} ${esc(r.unit)}">${outside(r)?'<span class="status-dot">●</span>':''}${fmt(r.value)}${r.unit!==latest?.unit?' '+esc(r.unit):''}</button>`:'<span class="muted">—</span>'}</td>`}).join('')}<td>${esc(latest?(entries.some(x=>x.unit!==latest.unit)?'См. ячейки':latest.unit):'—')}</td><td class="delta-cell ${!diff.number&&diff.value==='—'?'unsupported':''}" title="${esc(diff.reason)}">${diff.value==='—'?esc(diff.reason):esc(diff.value)+' '+esc(diff.reason)}</td></tr>`}).join('');
 host.innerHTML=codes.length?`<table class="results-table">${head}<tbody>${body}</tbody></table>`:'<div class="chart-empty">По выбранным фильтрам нет результатов</div>';
 host.scrollLeft=prevX;host.scrollTop=prevY;host.onscroll=()=>{state.tableScrollX=host.scrollLeft;state.tableScrollY=host.scrollTop};$('tableCount').textContent=codes.length+' показателей · '+dateList.length+' дат';
}
function openResult(r){state.detailRow=r;const meta=ANALYTE_META[r.code];$('resultDialogTitle').textContent=meta.name+' · '+fmt(r.value)+' '+r.unit;
 const pairs=[['Дата исследования',dateFmt(r.collectedOn)],['Время забора','Не указано в учебном источнике'],['Лаборатория',r.lab],['Референс источника',fmt(r.reference.low)+'–'+fmt(r.reference.high)+' '+r.unit],['Методика',r.method],['Материал',r.specimen],['Статус источника','Синтетика · Mac не аттестован'],['SHA-256 оригинала','Только учебная метка · байты PDF не проверены'],['Документ-источник',r.source.documentId],['Оценка по интервалу',outside(r)?'Вне интервала источника':'В интервале источника']];
 $('resultDetail').innerHTML='<div class="result-dl">'+pairs.map(([label,value])=>`<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')+'</div><p style="font-size:11px;color:#8da0b5;margin-top:12px">Нет диагноза или медицинского заключения. PDF доступен только в будущей интеграции по отдельному действию.</p>';
 $('resultDialog').showModal();
}
function openExport(scope){state.exScope=scope;$('exScope').value=scope;$('exPeriod').value='all';$('exFormat').value='PDF';$('exTemplate').value='doctor';$('exLab').value='all';$('customDates').hidden=true;
 $('exSelected').innerHTML=ANALYTES.map(a=>`<label><input type="checkbox" data-action="ex-pick" data-code="${esc(a.code)}" ${state.exPicked.has(a.code)?'checked':''}> ${esc(a.name)}</label>`).join('');
 $('exDates').innerHTML=dates.map(d=>`<label><input type="checkbox" data-action="ex-date" data-date="${esc(d)}" ${state.exDates.has(d)?'checked':''}> ${esc(dateFmt(d))}</label>`).join('');
 renderExportPreview();$('exportDialog').showModal();
}
function exportRows(){const scope=$('exScope').value,period=$('exPeriod').value,lab=$('exLab').value;let base=accepted.filter(r=>lab==='all'||r.lab===lab);
 if(period==='latest'){const last=base.reduce((x,r)=>r.collectedOn>x?r.collectedOn:x,'');base=base.filter(r=>r.collectedOn===last)}
 if(period==='3y')base=base.filter(r=>r.collectedOn>='2023-11-22');
 if(period==='custom'){const from=$('exFrom').value,to=$('exTo').value;base=from&&to&&from<=to?base.filter(r=>r.collectedOn>=from&&r.collectedOn<=to):[]}
 if(scope==='one'){const one=state.detailRow||newest(state.selected,accepted);base=base.filter(r=>r.id===one?.id)}
 else if(scope==='indicator')base=base.filter(r=>r.code===state.selected);
 else if(scope==='group')base=base.filter(r=>state.group==='Все группы'||ANALYTE_META[r.code].group===state.group);
 else if(scope==='selection')base=base.filter(r=>state.exPicked.has(r.code));
 else if(scope==='dates')base=base.filter(r=>state.exDates.has(r.collectedOn));
 else if(scope==='doctor')base=base.filter(r=>state.favorites.has(r.code));
 if($('exTemplate').value==='doctor'&&scope!=='one'&&scope!=='dates'){const byCode=new Map();for(const r of base.sort((a,b)=>a.collectedOn.localeCompare(b.collectedOn)))byCode.set(r.code,r);base=[...byCode.values()]}
 return base.sort((a,b)=>b.collectedOn.localeCompare(a.collectedOn)||ANALYTE_META[a.code].name.localeCompare(ANALYTE_META[b.code].name,'ru'));
}
function renderExportPreview(){const selected=exportRows(),format=$('exFormat').value,template=$('exTemplate').value; $('previewFormat').textContent=format+' · ДЕМО';
 const tr=selected.map(r=>`<tr><td>${esc(ANALYTE_META[r.code].name)}</td><td>${esc(dateFmt(r.collectedOn))}</td><td>${fmt(r.value)} ${esc(r.unit)}</td><td>${fmt(r.reference.low)}–${fmt(r.reference.high)} ${esc(r.unit)}</td><td>${esc(r.lab)}</td></tr>`).join('');
 $('previewContent').innerHTML=`<div class="eyebrow">МЕДИЦИНСКИЙ АРХИВ · ДЕМОНСТРАЦИЯ</div><h3>${template==='doctor'?'Краткий для врача':'Полная история анализов'}</h3><p>${$('exPersonal').checked?'Пациент: Учебный пациент (только синтетика)':'Обезличенный макет'} · ${selected.length} строк · <strong>структура, не готовый файл</strong></p><table><thead><tr><th>Показатель</th><th>Дата</th><th>Результат</th><th>Референс</th><th>Лаборатория</th></tr></thead><tbody>${tr||'<tr><td colspan="5">Нет подтверждённых учебных строк по выбору</td></tr>'}</tbody></table><p style="margin-top:12px">${$('exCharts').checked?'Графики выбраны для будущего файла.':'Графики выключены.'} ${$('exOriginal').checked?'Запрошены оригинальные PDF, но в демонстрации они отсутствуют и не прикладываются.':'Оригинальные PDF не выбраны.'}</p>`;
 $('exportSummary').textContent=`${selected.length} строк · ${new Set(selected.map(r=>r.collectedOn)).size} дат · ${excludedCount} исключено · страницы/размер: недоступно до генерации файла`;
}
init();
