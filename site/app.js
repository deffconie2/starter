(function(){
"use strict";
const TEAM=[
  {id:"paula", name:"Paula", dla:"Pauli",  init:"P", color:"var(--p-paula)",  f:true},
  {id:"kamil", name:"Kamil", dla:"Kamila", init:"K", color:"var(--p-kamil)",  f:false},
  {id:"michal",name:"Michał",dla:"Michała",init:"M", color:"var(--p-michal)", f:false},
];
const T=Object.fromEntries(TEAM.map(p=>[p.id,p]));
const SECTIONS=[
  {k:"pilne",   label:"Pilne",   hint:"Na dziś, po terminie, awarie",     tone:"var(--t-pilne)"},
  {k:"wazne",   label:"Ważne",   hint:"Wpływ na obiekt, ale się nie pali", tone:"var(--t-wazne)"},
  {k:"biezace", label:"Bieżące", hint:"Rutyna i drobne sprawy",            tone:"var(--t-biezace)"},
];
const SEC=Object.fromEntries(SECTIONS.map(s=>[s.k,s]));
const PTS={add:2,done:10,ontime:5,comment:1,odprawa:8};
const LEVELS=[[0,"Stażysta"],[40,"Technik"],[100,"Starszy technik"],[180,"Brygadzista"],[280,"Kierownik zmiany"],[400,"Inżynier obiektu"],[550,"Dyrektor techniczny"]];
const BADGES=[
  {name:"Domykacz",     test:x=>x.doneWeek>=5,  hint:"5 zamkniętych zadań w tym tygodniu"},
  {name:"Na czas",      test:x=>x.ontime>=3,    hint:"3 zadania zamknięte w terminie"},
  {name:"Kronikarz",    test:x=>x.notes>=5,     hint:"5 notatek"},
  {name:"Głos odprawy", test:x=>x.odprawy>=3,   hint:"3 odbyte odprawy"},
  {name:"W temacie",    test:x=>x.comments>=10, hint:"10 komentarzy"},
];
const ICON={
  check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chat:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  cal:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  plus:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

const $=s=>document.querySelector(s);
function h(tag,props,...kids){
  const el=document.createElement(tag);
  if(props) for(const [k,v] of Object.entries(props)){
    if(v==null||v===false) continue;
    if(k==="class") el.className=v;
    else if(k==="html") el.innerHTML=v; // static icon strings only
    else if(k.startsWith("on")) el.addEventListener(k.slice(2),v);
    else if(k==="style") el.style.cssText=v;
    else el.setAttribute(k,v===true?"":v);
  }
  for(const c of kids.flat()){ if(c==null||c===false) continue; el.append(c instanceof Node?c:document.createTextNode(String(c))); }
  return el;
}
function load(k){try{return localStorage.getItem("tablica-odpraw."+k)}catch(e){return null}}
function save(k,v){try{localStorage.setItem("tablica-odpraw."+k,v)}catch(e){}}
const av=(pid,cls)=>h("span",{class:"av"+(cls?" "+cls:""),style:"--c:"+T[pid].color},T[pid].init);
const ic=k=>h("span",{html:ICON[k],style:"display:inline-flex"});

/* dates */
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const todayStr=()=>ymd(new Date());
const tomorrowStr=()=>{const d=new Date();d.setDate(d.getDate()+1);return ymd(d)};
const endOfDay=s=>new Date(s+"T23:59:59").getTime();
const DUE_MIN="2026-01-01", DUE_MAX="2099-12-31";
const dueOk=v=>!v||(v>=DUE_MIN&&v<=DUE_MAX);
function weekStart(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getTime();}
const timeLabel=ts=>new Date(ts).toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit"});
function shortDay(ts){const d=ymd(new Date(ts));if(d===todayStr())return "dziś "+timeLabel(ts);return new Date(ts).toLocaleDateString("pl-PL",{weekday:"short",day:"numeric",month:"short"});}
function dueShort(due){
  if(due===todayStr()) return "dziś";
  if(due===tomorrowStr()) return "jutro";
  return new Date(due+"T12:00").toLocaleDateString("pl-PL",{day:"numeric",month:"short"});
}

/* state */
const CFG=window.ODPRAWY_CONFIG||{};
let db=null, auth=null, canWrite=true, connected=false, offlineMsg="Łączę z tablicą…";
let unsubs=[];
let resets={};
let tasks=[], comments=[], odprawy=[];
const loaded={tasks:false,comments:false};
// with Firebase the person comes from the signed-in account; the picker is only for demo mode
let me=!CFG.firebase&&T[load("who")]?load("who"):null;
let who=load("person"); if(who!=="all"&&!T[who]) who="all";
let showDone=load("showDone")==="1";
let q="";
let kind="task", showDetails=false, confirmOdp=false, odpTimer=null, dragId=null;
const openCards=new Set(), openThreads=new Set(), openDue=new Set(), confirmDel=new Set(), busy=new Set();
const drafts={};
const startSec=load("sec"); if(SEC[startSec]) $("#c-sec").value=startSec; else $("#c-sec").value="biezace";

const isOpenTask=t=>t.kind==="task"&&!t.done;
const prioOf=t=>SEC[t.prio]?t.prio:(isOpenTask(t)&&t.due&&t.due<=todayStr()?"pilne":"biezace");
const ownerOf=t=>t.to||t.by;
function visible(t){
  if(t.kind==="task"&&t.done&&!showDone) return false;
  if(who!=="all"&&ownerOf(t)!==who) return false;
  if(q&&!String(t.text).toLowerCase().includes(q)) return false;
  return true;
}
function cmp(a,b){
  const ra=a.kind==="note"?1:a.done?2:0, rb=b.kind==="note"?1:b.done?2:0;
  if(ra!==rb) return ra-rb;
  const da=a.due||"9999-99-99", dB=b.due||"9999-99-99";
  if(da!==dB) return da<dB?-1:1;
  return a.createdAt-b.createdAt;
}

/* scoring — always derived from the records, never stored.
   meta/points holds per-person reset times: records before a person's reset don't count for them */
const counts=(w,at)=>!!T[w]&&!(resets[w]&&at<resets[w]);
function stats(){
  const ws=weekStart(), s={};
  TEAM.forEach(p=>s[p.id]={week:0,total:0,doneWeek:0,ontime:0,notes:0,comments:0,odprawy:0});
  const add=(w,pts,at)=>{if(!counts(w,at))return false;s[w].total+=pts;if(at>=ws)s[w].week+=pts;return true;};
  const ids=new Set(tasks.map(t=>t.id));
  for(const t of tasks){
    if(add(t.by,PTS.add,t.createdAt)&&t.kind==="note") s[t.by].notes++;
    if(t.kind==="task"&&t.done&&add(t.doneBy,PTS.done,t.doneAt)){
      if(t.doneAt>=ws) s[t.doneBy].doneWeek++;
      if(t.due&&t.doneAt<=endOfDay(t.due)){add(t.doneBy,PTS.ontime,t.doneAt);s[t.doneBy].ontime++;}
    }
  }
  for(const c of comments){ if(ids.has(c.taskId)&&add(c.by,PTS.comment,c.at)) s[c.by].comments++; }
  for(const o of odprawy){ if(add(o.who,PTS.odprawa,o.at)) s[o.who].odprawy++; }
  return s;
}
function level(total){
  let i=0; while(i+1<LEVELS.length&&total>=LEVELS[i+1][0]) i++;
  const next=LEVELS[i+1];
  return {n:i+1,name:LEVELS[i][1],pct:next?(total-LEVELS[i][0])/(next[0]-LEVELS[i][0]):1,toNext:next?next[0]-total:0,nextName:next?next[1]:null};
}

/* render: header */
function renderMe(){
  const b=$("#me-btn"); b.replaceChildren();
  b.setAttribute("aria-label",auth?"Twoje konto":"Zmień osobę");
  if(me){ b.append(av(me),T[me].name); } else { b.append(auth?"Konto":"Wybierz siebie"); }
}
function renderBoard(){
  const s=stats(), box=$("#scores"); box.replaceChildren();
  const maxW=Math.max(...TEAM.map(p=>s[p.id].week));
  const leaders=TEAM.filter(p=>s[p.id].week===maxW);
  for(const p of TEAM){
    const x=s[p.id], lv=level(x.total);
    box.append(h("button",{class:"score"+(p.id===me?" is-me":""),type:"button","aria-expanded":String(showDetails),title:"Ranking i odznaki",onclick:toggleDetails},
      av(p.id),
      h("span",{class:"score-l1"},h("span",null,p.name+(p.id===me?" · ty":"")),h("b",null,String(x.week)),
        (maxW>0&&leaders.length===1&&leaders[0].id===p.id)?h("span",{class:"tag"},"MVP"):null),
      h("span",{class:"score-l2"},"Lv "+lv.n,h("span",{class:"meter",role:"img","aria-label":"Postęp do następnego poziomu: "+Math.round(lv.pct*100)+"%"},h("i",{style:"width:"+Math.round(lv.pct*100)+"%"})),"pkt/tydz.")
    ));
  }
  const d=$("#details"); d.hidden=!showDetails; d.replaceChildren();
  if(showDetails){
    const ranked=[...TEAM].sort((a,b)=>s[b.id].total-s[a.id].total);
    for(const p of ranked){
      const x=s[p.id], lv=level(x.total);
      d.append(h("div",{class:"rank-row"},
        av(p.id),
        h("div",{class:"nm"},p.name,h("small",null,lv.nextName?("Lv "+lv.n+" "+lv.name+" · "+lv.toNext+" pkt do: "+lv.nextName):("Lv "+lv.n+" "+lv.name+" · max"))),
        h("div",{class:"tot"},x.total+" pkt"),
        h("div",{class:"badges"},BADGES.map(b=>h("span",{class:"badge"+(b.test(x)?" got":""),title:b.hint},b.name)))
      ));
    }
    d.append(h("p",{class:"legend"},
      h("b",null,"Punkty: "),"wpis +"+PTS.add+" · zamknięte zadanie +"+PTS.done+" · w terminie +"+PTS.ontime+" bonusu · komentarz +"+PTS.comment+" · odprawa +"+PTS.odprawa+". ",
      "Punkty liczą się z wpisów, więc otwarcie zadania ponownie je odejmuje. Odznaki opisuje podpowiedź po najechaniu."));
  }
}
function toggleDetails(){showDetails=!showDetails;renderBoard();}

/* odprawa box — always credits the person using this browser, once per day */
const odprawaToday=pid=>odprawy.some(o=>o.who===pid&&ymd(new Date(o.at))===todayStr());
function renderRotation(){
  const p=me?T[me]:null;
  $("#rot-who").replaceChildren(...(p?[av(me),p.name]:["Wybierz siebie"]));
  const mine=p?odprawy.filter(o=>o.who===me&&counts(me,o.at)).length:0;
  $("#rot-count").textContent=p?("Twoje odprawy: "+mine):"";
  const last=odprawy.length?odprawy[odprawy.length-1]:null;
  $("#rot-last").textContent=last&&T[last.who]?("Ostatnio: "+T[last.who].name+", "+shortDay(last.at)):"Jeszcze nikt nie zaliczył odprawy.";
  const b=$("#rot-btn"), done=!!p&&odprawaToday(me);
  b.textContent=done?"Zaliczona dziś ✓":confirmOdp&&p?("Potwierdź: "+(p.f?"byłam":"byłem")):"Odprawa odbyta";
  b.classList.toggle("confirm",confirmOdp&&!done);
  b.disabled=!connected||!canWrite||done;
}

/* render: filters */
function renderFilters(){
  const box=$("#people"); box.replaceChildren();
  const openCount=pid=>tasks.filter(t=>isOpenTask(t)&&(pid==="all"||ownerOf(t)===pid)).length;
  const chip=(id,label,avEl)=>{
    const n=openCount(id);
    return h("button",{class:"f"+(avEl?"":" plain"),type:"button","aria-pressed":String(who===id),onclick:()=>{who=id;save("person",id);renderFilters();renderCols();}},
      avEl,label,n?h("span",{class:"n"},String(n)):null);
  };
  box.append(chip("all","Wszyscy",null));
  for(const p of TEAM) box.append(chip(p.id,p.name+(p.id===me?" (ty)":""),av(p.id,"sm")));
  const doneN=tasks.filter(t=>t.kind==="task"&&t.done).length;
  const db_=$("#done-btn");
  db_.setAttribute("aria-pressed",String(showDone));
  db_.replaceChildren(showDone?"Ukryj zrobione":"Pokaż zrobione",...(doneN?[h("span",{class:"n"},String(doneN))]:[]));
}

/* render: columns */
function buildCols(){
  const box=$("#cols"); box.replaceChildren();
  for(const s of SECTIONS){
    const list=h("div",{class:"list",id:"list-"+s.k,role:"list","aria-label":s.label});
    list.addEventListener("dragover",e=>{ if(!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect="move"; list.classList.add("drop"); });
    list.addEventListener("dragleave",e=>{ if(!list.contains(e.relatedTarget)) list.classList.remove("drop"); });
    list.addEventListener("drop",e=>{
      e.preventDefault(); list.classList.remove("drop");
      const id=dragId||e.dataTransfer.getData("text/plain"); dragId=null;
      const t=tasks.find(x=>x.id===id); if(t&&prioOf(t)!==s.k) setPrio(t,s.k);
    });
    box.append(h("section",{class:"col",style:"--tone:"+s.tone,"aria-labelledby":"h-"+s.k},
      h("div",{class:"col-head"},
        h("div",null,h("h2",{id:"h-"+s.k},s.label),h("p",null,s.hint)),
        h("span",{class:"cnt",id:"cnt-"+s.k,title:"Otwarte zadania"},"0"),
        h("button",{class:"add-btn",type:"button","aria-label":"Dodaj do kolumny "+s.label,title:"Dodaj do: "+s.label,html:ICON.plus,onclick:()=>{$("#c-sec").value=s.k;save("sec",s.k);$("#c-text").focus();}})
      ),
      list));
  }
}
function renderCols(){
  const act=document.activeElement, actId=act&&$("#cols").contains(act)?act.id:null;
  let sel=null; try{ if(actId&&act.selectionStart!=null) sel=[act.selectionStart,act.selectionEnd]; }catch(e){}
  const byTask={};
  for(const c of comments)(byTask[c.taskId]=byTask[c.taskId]||[]).push(c);
  const groups={pilne:[],wazne:[],biezace:[]};
  if(connected&&loaded.tasks) for(const t of tasks) if(visible(t)) groups[prioOf(t)].push(t);
  const anyFilter=who!=="all"||!!q;
  for(const s of SECTIONS){
    const list=$("#list-"+s.k), top=list.scrollTop;
    list.replaceChildren();
    const items=groups[s.k].sort(cmp);
    const open=items.filter(isOpenTask).length;
    const cnt=$("#cnt-"+s.k); cnt.textContent=String(open); cnt.classList.toggle("hot",s.k==="pilne"&&open>0);
    if(!connected){ if(s.k==="pilne") list.append(h("div",{class:"list-empty"},offlineMsg)); }
    else if(!loaded.tasks){ list.append(h("div",{class:"list-empty"},"Ładuję wpisy…")); }
    else if(!items.length){
      list.append(h("div",{class:"list-empty"},anyFilter?"Nic tu nie pasuje do filtra.":
        (s.k==="pilne"?"Nic się nie pali. Zadanie z terminem na dziś trafia tu samo, jeśli nie ma kolumny.":"Pusto. Dodaj zadanie przyciskiem + albo przeciągnij je tutaj.")));
    }
    for(const t of items) list.append(card(t,byTask[t.id]||[],s));
    list.scrollTop=top;
  }
  if(actId){const el=document.getElementById(actId); if(el){el.focus({preventScroll:true}); if(sel) try{el.setSelectionRange(sel[0],sel[1])}catch(e){}}}
}

function card(t,cs,sec){
  const isTask=t.kind==="task", today=todayStr(), isOpen=openCards.has(t.id);
  const overdue=isTask&&!t.done&&t.due&&t.due<today, dueToday=isTask&&!t.done&&t.due===today;
  const meta=h("span",{class:"meta"},
    t.due?h("span",{class:"due"+(overdue?" late":dueToday?" today":""),title:overdue?"Po terminie":"Termin"},dueShort(t.due)):null,
    cs.length?h("span",{class:"cc",title:"Komentarze"},ic("chat"),String(cs.length)):null,
    (t.to&&T[t.to])?h("span",{title:"Dla "+T[t.to].dla,style:"display:inline-flex"},av(t.to,"sm")):null
  );
  const row=h("div",{class:"row"},
    isTask?h("button",{class:"tick-box"+(t.done?" on":""),type:"button",disabled:!canWrite,"aria-label":t.done?"Otwórz zadanie ponownie":"Oznacz jako zrobione",onclick:()=>toggleDone(t),html:ICON.check}):h("span",{class:"note-mark"},"Not."),
    h("button",{class:"text-btn",type:"button",id:"tb-"+t.id,"aria-expanded":String(isOpen),onclick:()=>{toggle(openCards,t.id);renderCols();}},h("span",{class:"tx"},t.text)),
    meta);
  const kids=[row];
  if(isOpen){
    const author=T[t.by];
    const ext=h("div",{class:"ext"});
    ext.append(h("div",{class:"info"},
      (author?(author.f?"Dodała ":"Dodał ")+author.name:"Dodane")+" · "+shortDay(t.createdAt),
      (t.to&&T[t.to])?" · dla "+T[t.to].dla:"",
      overdue?" · po terminie":"",
      (isTask&&t.done&&T[t.doneBy])?h("span",{class:"ok"}," · "+(T[t.doneBy].f?"zamknęła ":"zamknął ")+T[t.doneBy].name+" "+shortDay(t.doneAt)):null));
    if(canWrite){
      ext.append(h("div",{class:"move"},"Kolumna",
        h("div",{class:"seg",role:"group","aria-label":"Przenieś do kolumny"},
          SECTIONS.map(s=>h("button",{type:"button","aria-pressed":String(s.k===sec.k),style:"--tone:"+s.tone,onclick:()=>{if(s.k!==sec.k)setPrio(t,s.k);}},s.label)))));
      ext.append(h("div",{class:"acts"},
        isTask?h("button",{class:"act"+(t.done?"":" primary"),type:"button",onclick:()=>toggleDone(t)},ic("check"),t.done?"Otwórz":"Zrobione"):null,
        h("button",{class:"act",type:"button","aria-expanded":String(openThreads.has(t.id)),onclick:()=>{toggle(openThreads,t.id);renderCols();focusLater("cm-"+t.id);}},ic("chat"),cs.length?"Komentarz · "+cs.length:"Komentarz"),
        h("button",{class:"act",type:"button","aria-expanded":String(openDue.has(t.id)),onclick:()=>{toggle(openDue,t.id);renderCols();focusLater("due-"+t.id);}},ic("cal"),t.due?"Termin":"Dodaj termin"),
        confirmDel.has(t.id)
          ?h("button",{class:"act danger",type:"button",onclick:()=>removeItem(t)},"Na pewno usunąć?")
          :h("button",{class:"act icon",type:"button","aria-label":"Usuń wpis",title:"Usuń",onclick:()=>{confirmDel.add(t.id);renderCols();setTimeout(()=>{if(confirmDel.delete(t.id))renderCols();},4000);},html:ICON.trash})
      ));
      if(openDue.has(t.id)){
        // saved only on Zapisz/Enter: typing a year fires change after its first digit (e.g. 0002)
        const dueIn=h("input",{type:"date",id:"due-"+t.id,value:t.due||"",min:DUE_MIN,max:DUE_MAX,onkeydown:e=>{if(e.key==="Enter"){e.preventDefault();setDue(t,dueIn.value);}}});
        ext.append(h("div",{class:"due-edit"},
          h("label",{for:"due-"+t.id},"Termin"),
          dueIn,
          h("button",{class:"act primary",type:"button",onclick:()=>setDue(t,dueIn.value)},"Zapisz"),
          t.due?h("button",{class:"act",type:"button",onclick:()=>setDue(t,"")},"Bez terminu"):null));
      }
    }
    if(cs.length||openThreads.has(t.id)){
      const th=h("div",{class:"thread"});
      for(const c of cs) th.append(h("div",{class:"cmt"},h("b",{style:"--c:"+(T[c.by]?T[c.by].color:"var(--muted)")},T[c.by]?T[c.by].name:"Ktoś")," ",c.text,h("time",null,shortDay(c.at))));
      if(openThreads.has(t.id)&&canWrite){
        const inp=h("input",{id:"cm-"+t.id,type:"text",maxlength:"400",placeholder:"Napisz komentarz…","aria-label":"Komentarz",value:drafts[t.id]||"",oninput:e=>{drafts[t.id]=e.target.value;}});
        th.append(h("form",{class:"c-form",onsubmit:e=>{e.preventDefault();addComment(t,inp.value);}},inp,h("button",{type:"submit"},"Wyślij")));
      }
      ext.append(th);
    }
    kids.push(ext);
  }
  const el=h("article",{class:"card "+t.kind+(t.done?" done":"")+(isOpen?" open":""),role:"listitem","data-id":t.id,draggable:canWrite&&connected?"true":null},kids);
  el.addEventListener("dragstart",e=>{
    if(e.target.closest&&e.target.closest("input,form")){e.preventDefault();return;}
    dragId=t.id; try{e.dataTransfer.setData("text/plain",t.id);e.dataTransfer.effectAllowed="move";}catch(_){}
    el.classList.add("dragging");
  });
  el.addEventListener("dragend",()=>{dragId=null;el.classList.remove("dragging");document.querySelectorAll(".list.drop").forEach(l=>l.classList.remove("drop"));});
  return el;
}
function toggle(set,id){set.has(id)?set.delete(id):set.add(id);}
function focusLater(id){requestAnimationFrame(()=>{const el=document.getElementById(id);if(el){el.focus();el.scrollIntoView({block:"nearest"});}});}

function renderComposer(){
  const off=!connected||!canWrite;
  ["#c-text","#c-to","#c-due","#c-sec","#c-send"].forEach(s=>$(s).disabled=off);
  document.querySelectorAll(".composer .seg button").forEach(b=>{b.disabled=off;b.setAttribute("aria-pressed",String(b.dataset.kind===kind));});
  $("#c-text").placeholder=off?(connected?"Masz podgląd bez prawa edycji":"Łączę z tablicą…"):(kind==="task"?"Nowe zadanie z odprawy…":"Notatka z odprawy…");
}
function renderAll(){renderMe();renderBoard();renderRotation();renderFilters();renderCols();renderComposer();}

/* feedback */
let toastTimer=null;
function toast(msg,pts){
  const el=$("#toast"); el.replaceChildren(...(pts?[h("span",{class:"pts"},pts+" ")]:[]),msg);
  el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
}
function banner(msg,info){const b=$("#banner");b.textContent=msg||"";b.hidden=!msg;b.classList.toggle("info",!!info);}
function confetti(){
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv=$("#confetti"), ctx=cv.getContext("2d"); if(!ctx) return;
  const dpr=window.devicePixelRatio||1; cv.width=innerWidth*dpr; cv.height=innerHeight*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
  const cs=getComputedStyle(document.documentElement);
  const cols=["--hivis","--p-paula","--p-kamil","--p-michal","--ok"].map(v=>cs.getPropertyValue(v).trim()||"#f0a21e");
  const W=innerWidth,H=innerHeight;
  const ps=Array.from({length:80},()=>({x:W/2+(Math.random()-.5)*80,y:H*.62,vx:(Math.random()-.5)*9,vy:-Math.random()*11-5,r:Math.random()*Math.PI,vr:(Math.random()-.5)*.4,w:5+Math.random()*5,h:8+Math.random()*6,c:cols[Math.floor(Math.random()*cols.length)]}));
  const t0=performance.now();
  (function frame(t){
    const el=t-t0; ctx.clearRect(0,0,W,H);
    for(const p of ps){p.vy+=.35;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.globalAlpha=Math.max(0,1-el/1500);ctx.fillStyle=p.c;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();}
    if(el<1500) requestAnimationFrame(frame); else ctx.clearRect(0,0,W,H);
  })(t0);
}

/* writes — error codes are Firestore's */
async function write(fn){
  if(!db){toast("Brak połączenia z tablicą.");return false;}
  if(!canWrite){toast("Masz podgląd bez prawa edycji.");return false;}
  try{await fn();return true;}
  catch(e){
    const c=e&&e.code;
    if(c==="unavailable"||c==="deadline-exceeded"){
      await new Promise(r=>setTimeout(r,500+Math.random()*700));
      try{await fn();return true;}catch(e2){toast("Nie udało się zapisać. Spróbuj za chwilę.");return false;}
    }
    if(c==="permission-denied"||c==="unauthenticated"){
      canWrite=false; banner("Twoje konto nie ma prawa zapisu. Poproś Michała o dopisanie do zespołu."); renderAll(); return false;
    }
    if(c==="resource-exhausted"){toast("Limit zapisów wyczerpany. Spróbuj później.");return false;}
    toast("Nie udało się zapisać.");return false;
  }
}
function needMe(){ if(!me){ if(auth) toast("Twoje konto nie jest przypisane do nikogo z zespołu."); else openWho(); return true; } return false; }

async function addItem(){
  if(needMe()) return;
  const ta=$("#c-text"), text=ta.value.trim(); if(!text) return;
  if(!dueOk($("#c-due").value)){toast("Sprawdź termin: rok "+DUE_MIN.slice(0,4)+"–"+DUE_MAX.slice(0,4));$("#c-due").focus();return;}
  const prio=SEC[$("#c-sec").value]?$("#c-sec").value:"biezace";
  const doc={kind,text:text.slice(0,600),by:me,to:$("#c-to").value||null,due:$("#c-due").value||null,prio,done:false,doneBy:null,doneAt:null,createdAt:Date.now()};
  const ref=db.collection("tasks").doc();
  ta.value=""; $("#c-due").value=""; $("#c-to").value="";
  if(!visible({...doc,id:ref.id})){who="all";save("person","all");q="";$("#q").value="";renderFilters();}
  const ok=await write(()=>ref.set(doc));
  if(ok) toast(T[me].name+" · "+(kind==="task"?"dodane do: ":"notatka w: ")+SEC[prio].label,"+"+PTS.add+" pkt");
  else ta.value=text;
}
async function setPrio(t,p){
  if(needMe()||busy.has(t.id)||!SEC[p]) return;
  busy.add(t.id);
  const ok=await write(()=>db.doc("tasks/"+t.id).update({prio:p}));
  busy.delete(t.id);
  if(ok) toast("Przeniesione do: "+SEC[p].label);
}
async function toggleDone(t){
  if(needMe()||busy.has(t.id)) return;
  busy.add(t.id);
  const nowDone=!t.done;
  const patch=nowDone?{done:true,doneBy:me,doneAt:Date.now()}:{done:false,doneBy:null,doneAt:null};
  const ok=await write(()=>db.doc("tasks/"+t.id).update(patch));
  busy.delete(t.id);
  if(!ok) return;
  if(nowDone){
    const bonus=t.due&&patch.doneAt<=endOfDay(t.due);
    toast(T[me].name+(bonus?" · zamknięte w terminie":" · zadanie zamknięte"),"+"+(PTS.done+(bonus?PTS.ontime:0))+" pkt");
    confetti();
  } else toast("Zadanie znów otwarte");
}
async function setDue(t,val){
  if(needMe()||busy.has(t.id)) return;
  if(!dueOk(val)){toast("Sprawdź datę: rok "+DUE_MIN.slice(0,4)+"–"+DUE_MAX.slice(0,4));focusLater("due-"+t.id);return;}
  busy.add(t.id);
  const ok=await write(()=>db.doc("tasks/"+t.id).update({due:val||null}));
  busy.delete(t.id);
  if(ok){openDue.delete(t.id);renderCols();toast(val?("Termin: "+dueShort(val)):"Usunięto termin");}
}
async function addComment(t,val){
  if(needMe()) return;
  const text=(val||"").trim(); if(!text) return;
  const ref=db.collection("comments").doc();
  drafts[t.id]="";
  const ok=await write(()=>ref.set({taskId:t.id,text:text.slice(0,400),by:me,at:Date.now()}));
  if(ok){toast(T[me].name+" · komentarz","+"+PTS.comment+" pkt");focusLater("cm-"+t.id);} else drafts[t.id]=text;
}
async function removeItem(t){
  confirmDel.delete(t.id);
  const ok=await write(()=>db.doc("tasks/"+t.id).delete());
  if(!ok) return;
  openCards.delete(t.id);
  for(const c of comments.filter(c=>c.taskId===t.id)){ try{await db.doc("comments/"+c.id).delete();}catch(e){} }
  toast("Wpis usunięty");
}
async function logOdprawa(){
  if(needMe()||odprawaToday(me)) return;
  if(!confirmOdp){confirmOdp=true;renderRotation();clearTimeout(odpTimer);odpTimer=setTimeout(()=>{confirmOdp=false;renderRotation();},5000);return;}
  confirmOdp=false; clearTimeout(odpTimer);
  const ref=db.collection("odprawy").doc();
  const ok=await write(()=>ref.set({who:me,by:me,at:Date.now()}));
  if(!ok){renderRotation();return;}
  toast(T[me].name+" · odprawa zaliczona","+"+PTS.odprawa+" pkt");
  confetti();
}

/* who overlay */
function openWho(){
  const box=$("#who-btns"); box.replaceChildren();
  const user=auth&&auth.currentUser;
  if(user){
    $("#who-t").textContent="Twoje konto";
    $("#who-p").textContent=me?("Zalogowano jako "+T[me].name+". Wpisy, zamknięte zadania i punkty są podpisane tym kontem.")
      :"To konto nie jest przypisane do nikogo z zespołu, więc masz tylko podgląd. Poproś Michała o dopisanie.";
    if(me) box.append(h("div",{class:"acct-who"},av(me,"lg"),T[me].name));
  } else {
    $("#who-t").textContent="Kim jesteś?";
    $("#who-p").textContent="Twoje wpisy, zamknięte zadania i punkty będą podpisane tym imieniem. Ta przeglądarka zapamięta wybór.";
    for(const p of TEAM) box.append(h("button",{type:"button","aria-pressed":String(me===p.id),onclick:()=>{me=p.id;save("who",p.id);$("#who").hidden=true;renderAll();}},av(p.id,"lg"),p.name));
  }
  box.classList.toggle("acct",!!user);
  $("#who-foot").hidden=!user;
  confirmReset=false; renderResetBtn();
  $("#who-acct").textContent=user?user.email:"";
  $("#who").hidden=false;
  requestAnimationFrame(()=>{const b=$("#who .sheet").querySelector("button");if(b)b.focus();});
}
const canCloseWho=()=>!!(me||auth);
$("#who").addEventListener("keydown",e=>{if(e.key==="Escape"&&canCloseWho())$("#who").hidden=true;});
$("#who").addEventListener("click",e=>{if(e.target.id==="who"&&canCloseWho())$("#who").hidden=true;});
$("#me-btn").addEventListener("click",openWho);
$("#rot-btn").addEventListener("click",logOdprawa);
$("#logout-btn").addEventListener("click",()=>{$("#who").hidden=true;if(auth)auth.signOut();});
let confirmReset=false, resetTimer=null;
function renderResetBtn(){
  const b=$("#reset-btn"); b.hidden=!me||!connected||!canWrite;
  b.textContent=confirmReset?"Na pewno? Kliknij jeszcze raz":"Wyzeruj moje punkty";
}
$("#reset-btn").addEventListener("click",async()=>{
  if(!me) return;
  if(!confirmReset){confirmReset=true;renderResetBtn();clearTimeout(resetTimer);resetTimer=setTimeout(()=>{confirmReset=false;renderResetBtn();},4000);return;}
  confirmReset=false; clearTimeout(resetTimer); renderResetBtn();
  const ok=await write(()=>db.doc("meta/points").set({[me]:Date.now()},{merge:true}));
  if(ok){$("#who").hidden=true;toast(T[me].name+" · punkty wyzerowane");}
});

/* composer + filters */
$("#composer").addEventListener("submit",e=>{e.preventDefault();addItem();});
$("#c-sec").addEventListener("change",e=>save("sec",e.target.value));
document.querySelectorAll(".composer .seg button").forEach(b=>b.addEventListener("click",()=>{kind=b.dataset.kind;renderComposer();$("#c-text").focus();}));
$("#done-btn").addEventListener("click",()=>{showDone=!showDone;save("showDone",showDone?"1":"0");renderFilters();renderCols();});
let qTimer=null;
$("#q").addEventListener("input",e=>{clearTimeout(qTimer);qTimer=setTimeout(()=>{q=e.target.value.trim().toLowerCase();renderCols();},120);});

/* connection */
function start(store){
  stop();
  db=store; connected=true; canWrite=true;
  renderAll();
  const onErr=e=>{
    if(e&&e.code==="permission-denied"){connected=false;offlineMsg="Twoje konto nie ma dostępu do tablicy.";banner("Brak dostępu. Poproś Michała o dopisanie Twojego e-maila do zespołu.");}
    else toast("Połączenie z tablicą przerwane. Odśwież stronę.");
    renderAll();
  };
  unsubs=[
    db.collection("tasks").orderBy("createdAt").onSnapshot(s=>{tasks=s.docs.map(d=>Object.assign({id:d.id},d.data()));loaded.tasks=true;renderBoard();renderFilters();renderCols();},onErr),
    db.collection("comments").orderBy("at").onSnapshot(s=>{comments=s.docs.map(d=>Object.assign({id:d.id},d.data()));loaded.comments=true;renderBoard();renderCols();},onErr),
    db.collection("odprawy").orderBy("at").onSnapshot(s=>{odprawy=s.docs.map(d=>Object.assign({id:d.id},d.data()));renderBoard();renderRotation();},onErr),
    db.doc("meta/points").onSnapshot(s=>{resets=(s.exists&&s.data())||{};renderBoard();renderRotation();},onErr),
  ];
}
function stop(){
  unsubs.forEach(u=>{try{u()}catch(e){}}); unsubs=[];
  db=null; connected=false;
  tasks=[]; comments=[]; odprawy=[]; resets={}; loaded.tasks=loaded.comments=false;
}

async function sha256(text){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function showLogin(){
  $("#login").hidden=false; $("#l-err").textContent="";
  requestAnimationFrame(()=>$("#l-email").focus());
}
$("#login-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=$("#l-send"); btn.disabled=true; $("#l-err").textContent="";
  try{ await auth.signInWithEmailAndPassword($("#l-email").value.trim(),$("#l-pass").value); $("#l-pass").value=""; }
  catch(err){
    const c=err&&err.code||"";
    $("#l-err").textContent=c==="auth/too-many-requests"?"Za dużo prób. Odczekaj chwilę."
      :c==="auth/network-request-failed"?"Brak internetu."
      :"Zły e-mail lub hasło.";
  }
  btn.disabled=false;
});

/* boot */
buildCols();
renderAll();

(async()=>{
  if(!CFG.firebase){
    banner("Tryb demo: dane zapisują się tylko w tej przeglądarce. Wspólna tablica dla zespołu — patrz README.",true);
    start(OdprawyStore.local());
    if(!me) openWho();
    return;
  }
  let fb;
  try{ fb=await OdprawyStore.firebase(CFG.firebase); }
  catch(e){ offlineMsg="Nie udało się połączyć z serwerem tablicy."; banner("Nie załadowano Firebase. Sprawdź internet i odśwież stronę."); renderCols(); return; }
  auth=fb.auth;
  auth.onAuthStateChanged(async user=>{
    if(!user){ stop(); me=null; $("#who").hidden=true; offlineMsg="Zaloguj się, żeby zobaczyć tablicę."; banner(""); renderAll(); showLogin(); return; }
    $("#login").hidden=true;
    const email=String(user.email||"").toLowerCase();
    // config.emails keys are SHA-256 of the lowercase e-mail, so the public repo holds no addresses
    const hash=await sha256(email);
    const mapped=Object.entries(CFG.emails||{}).find(([k])=>k.toLowerCase()===hash||k.toLowerCase()===email);
    me=mapped&&T[mapped[1]]?mapped[1]:null;
    start(fb.db);
    if(!me){ canWrite=false; banner("Konto "+email+" nie jest przypisane do nikogo z zespołu — masz tylko podgląd. Poproś Michała o dopisanie."); renderAll(); }
  });
})();
})();
