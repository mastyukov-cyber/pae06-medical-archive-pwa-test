import {ANALYTES,SYNTHETIC_RECORDS} from './fixture.mjs';
import {ingest,ANALYTE_META,periodRows,series,comparison,overview,countAnalytes,buildChartPoints} from './lab-core.mjs';
const data=ingest(SYNTHETIC_RECORDS);
const state={tab:'single',period:'all',code:'hb',compare:new Set(['hb','glucose']),query:'',lab:'all'};
const $=id=>document.getElementById(id),fmt=(x,max=1)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:max}).format(x);
const date=d=>d.split('-').reverse().join('.');
const el=(tag,cls,content)=>{const a=document.createElement(tag);if(cls)a.className=cls;if(content!==undefined)a.textContent=content;return a};
function init(){
 $('statRows').textContent=String(data.accepted.length);
 $('statAnalytes').textContent=String(countAnalytes(data.accepted));
 $('statRejected').textContent=String(data.rejected.length);
 document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
  state.tab=button.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(other=>{const on=other===button;other.classList.toggle('selected',on);other.setAttribute('aria-selected',String(on))});
  render();
 }));
 $('period').addEventListener('change',e=>{state.period=e.target.value;render()});
 render();
}
function headText(title,description){const t=el('div','summaryline');t.textContent=description;return t}
function lineChart(group){
 const card=el('div','chartcard'),head=el('div','charttop'),intro=el('div');
 intro.append(el('h3','',group.label),el('div','chartmeta',group.method+' · '+group.unit));head.append(intro);
 const val=el('div','latest',fmt(group.latest.value)+' '+group.unit);val.append(el('small','',date(group.latest.collectedOn)));head.append(val);card.append(head);
 const points=buildChartPoints(group.rows),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 575 245');svg.setAttribute('role','img');svg.setAttribute('aria-label','Учебная динамика: '+group.label+', '+group.unit);svg.classList.add('chart');
 const ns='http://www.w3.org/2000/svg';const make=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;svg.append(n);return n};
 for(const y of [35,75,115,155,195])make('line',{x1:35,x2:540,y1:y,y2:y,class:'gridline'});
 if(points.length>1)make('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),class:'line'});
 const detail=el('div','detail','Выберите точку графика, чтобы увидеть исходные значения и лабораторию.');
 const show=r=>{detail.textContent=date(r.collectedOn)+' · '+fmt(r.value)+' '+r.unit+' · '+r.lab+' · референс учебного источника '+fmt(r.reference.low)+'–'+fmt(r.reference.high)+' '+r.unit+' · '+r.source.documentId};
 for(const p of points){
  const c=make('circle',{cx:p.x,cy:p.y,r:6,class:'dot',tabindex:'0','aria-label':date(p.row.collectedOn)+', '+fmt(p.row.value)+' '+p.row.unit});
  const title=document.createElementNS(ns,'title');title.textContent=date(p.row.collectedOn)+': '+p.row.value+' '+p.row.unit;c.append(title);
  c.addEventListener('click',()=>show(p.row));c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(p.row)}});
  make('text',{x:p.x,y:228,'text-anchor':'middle'},date(p.row.collectedOn).slice(0,5));
 }
 card.append(svg,detail,el('div','method-note','Референсы могут отличаться между лабораториями. Общая «норма» не рассчитывается. Источник: подтверждённая учебная запись Mac-first.'));
 return card;
}
function dropFilter(){const label=el('label','');label.append(document.createTextNode('Показатель '));const select=el('select');for(const a of ANALYTES){const o=el('option','',a.name);o.value=a.code;select.append(o)}select.value=state.code;select.addEventListener('change',e=>{state.code=e.target.value;render()});label.append(select);return label}
function renderSingle(target){const filters=el('div','filterrow');filters.append(dropFilter());target.append(filters);
 const groups=series(data.accepted,state.code,state.period);target.append(headText('',groups.length===1?'Одна сопоставимая серия по методике и единицам.':'Методики или единицы различаются — серии намеренно разделены.'));
 if(!groups.length)target.append(el('div','empty','За этот период подтверждённых учебных результатов нет.'));
 for(const g of groups)target.append(lineChart(g));
}
function renderCompare(target){target.append(el('div','summaryline','Выберите до четырёх показателей. У каждого собственный график и своя шкала; разные единицы не смешиваются.'));
 const picks=el('div','compare-picks');for(const a of ANALYTES){const selected=state.compare.has(a.code),b=el('button','choice'+(selected?' selected':''),a.name);b.type='button';b.setAttribute('aria-pressed',String(selected));b.addEventListener('click',()=>{
  if(selected&&state.compare.size>1)state.compare.delete(a.code);else if(!selected&&state.compare.size<4)state.compare.add(a.code);render();
 });picks.append(b)}target.append(picks);
 const groups=comparison(data.accepted,[...state.compare],state.period);const grid=el('div','compare-grid');for(const g of groups)grid.append(lineChart(g));if(!groups.length)grid.append(el('div','empty','Нет подтверждённых результатов за выбранный период.'));target.append(grid);
}
function renderAll(target){const filter=el('div','filterrow');const input=el('input','search');input.type='search';input.placeholder='Поиск показателя, даты, лаборатории';input.setAttribute('aria-label','Поиск лабораторных результатов');input.value=state.query;input.addEventListener('input',e=>{state.query=e.target.value;renderTable(target)});
 const label=el('label','');label.textContent='Лаборатория ';const select=el('select');for(const name of ['all',...new Set(data.accepted.map(r=>r.lab))]){const opt=el('option','',name==='all'?'Все лаборатории':name);opt.value=name;select.append(opt)}select.value=state.lab;select.addEventListener('change',e=>{state.lab=e.target.value;renderTable(target)});label.append(select);filter.append(input,label);target.append(filter);
 const table=el('div','all-results');table.id='tableContent';target.append(table);renderTable(target);
}
function renderTable(){const host=$('tableContent');if(!host)return;host.replaceChildren();const results=overview(data.accepted,{query:state.query,period:state.period,lab:state.lab});host.append(el('div','summaryline','Найдено: '+results.length+' · данные только подтверждённых учебных записей'));
 if(!results.length){host.append(el('div','empty','Нет подтверждённых записей по запросу.'));return}
 const wrap=el('div','data-table-wrap'),table=el('table');const thead=el('thead'),head=el('tr');for(const t of ['Дата','Показатель','Значение','Учебный референс','Лаборатория','Источник'])head.append(el('th','',t));thead.append(head);table.append(thead);const body=el('tbody');for(const r of results){const tr=el('tr'),values=[date(r.collectedOn),ANALYTE_META[r.code].name,fmt(r.value)+' '+r.unit,fmt(r.reference.low)+'–'+fmt(r.reference.high)+' '+r.unit,r.lab,r.source.documentId];for(let i=0;i<values.length;i++){const td=el('td','',values[i]);if(i===2)td.className='confirmed';tr.append(td)}body.append(tr)}table.append(body);wrap.append(table);host.append(wrap);
}
function render(){const root=$('content');root.replaceChildren();if(state.tab==='single')renderSingle(root);if(state.tab==='compare')renderCompare(root);if(state.tab==='all')renderAll(root)}
init();
