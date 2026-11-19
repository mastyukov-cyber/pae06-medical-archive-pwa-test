/* PAE-06 CP08.9: read-only document catalog for ONLY prevalidated synthetic IndexedDB entries.
   createdAt = moment of adding TEST PDF, NEVER the original document date. */
(function(root){
  "use strict";
  function timestamp(row){
    const x=row&&row.createdAt;
    if(typeof x!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.\d{3}Z$/.test(x))return null;
    const d=new Date(x);
    if(!Number.isFinite(d.getTime())||d.toISOString()!==x)return null;
    return d.getTime();
  }
  function prepare(rows,lookup,query,order){
    const q=String(query||"").trim().normalize("NFC").toLocaleLowerCase("ru-RU");
    if(!Array.isArray(rows)||typeof lookup!=="function")return [];
    const result=[];
    for(const row of rows){
      if(!row||typeof row.id!=="string")continue;
      const fixture=lookup(row);
      if(!fixture||typeof fixture.title!=="string")continue;
      const hay=(fixture.title+" "+row.id).normalize("NFC").toLocaleLowerCase("ru-RU");
      if(q&&!hay.includes(q))continue;
      result.push({row,fixture,time:timestamp(row)});
    }
    const mode=["newest","oldest","title"].includes(order)?order:"newest";
    result.sort((a,b)=>{
      if(mode==="title"){
        const title=a.fixture.title.localeCompare(b.fixture.title,"ru-RU");
        return title||a.row.id.localeCompare(b.row.id);
      }
      if(a.time===null&&b.time!==null)return 1;
      if(b.time===null&&a.time!==null)return -1;
      if(a.time!==null&&b.time!==null&&a.time!==b.time)
        return mode==="newest"?b.time-a.time:a.time-b.time;
      return a.row.id.localeCompare(b.row.id);
    });
    return result;
  }
  function addedLabel(row){
    const millis=timestamp(row);
    if(millis===null)return "Дата добавления не сохранена";
    return "Добавлено в TEST: "+new Intl.DateTimeFormat("ru-RU",{
      year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"
    }).format(new Date(millis));
  }
  root.PAE06Catalog=Object.freeze({prepare,addedLabel,timestamp});
})(window);
