// ═══════════════════════════════════════════════════
//  TURNI APP — app.js  (shared across all pages)
// ═══════════════════════════════════════════════════

// ── COSTANTI ──────────────────────────────────────
const EMPLOYEES = ['Cristian','Manila','Swami','Matteo','Nico','Giorgia S.','Giorgia P.','Alessia'];
const N = EMPLOYEES.length;
const IS_MALE = {Cristian:true,Manila:false,Swami:false,Matteo:true,Nico:true,'Giorgia S.':false,'Giorgia P.':false,Alessia:false};
const IS_CAPO = {Manila:true,Cristian:true,Nico:true};
const DAYS = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const SL = {M:'07:00–14:30',S:'14:30–21:30',O:'Libero','SAT-M':'07:00–14:30','SAT-S':'14:30–21:30'};
const SN = {M:'Mattina',S:'Sera',O:'Libero','SAT-M':'Sab Mat.','SAT-S':'Sab Sera'};
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const UID_TO_EMP = {cristian:'Cristian',manila:'Manila',swami:'Swami',matteo:'Matteo',
  nico:'Nico',giorgias:'Giorgia S.',giorgiap:'Giorgia P.',alessia:'Alessia'};
const EMP_TO_UID = {Cristian:'cristian',Manila:'manila',Swami:'swami',Matteo:'matteo',
  Nico:'nico','Giorgia S.':'giorgias','Giorgia P.':'giorgiap',Alessia:'alessia'};

// ── AUTH ──────────────────────────────────────────
let ACCOUNTS = JSON.parse(localStorage.getItem('turni_accounts') || 'null') || {
  domenico:{displayName:'Domenico',role:'owner',password:'admin123'},
  cristian:{displayName:'Cristian',role:'employee',password:'cris2024'},
  manila:  {displayName:'Manila',  role:'employee',password:'man2024'},
  swami:   {displayName:'Swami',   role:'employee',password:'swa2024'},
  matteo:  {displayName:'Matteo',  role:'employee',password:'mat2024'},
  nico:    {displayName:'Nico',    role:'employee',password:'nic2024'},
  giorgias:{displayName:'Giorgia S.',role:'employee',password:'gios2024'},
  giorgiap:{displayName:'Giorgia P.',role:'employee',password:'giop2024'},
  alessia: {displayName:'Alessia', role:'employee',password:'ale2024'},
};
function saveAccounts(){ localStorage.setItem('turni_accounts', JSON.stringify(ACCOUNTS)); }

function getCurrentUser(){
  const raw = sessionStorage.getItem('turni_user');
  return raw ? JSON.parse(raw) : null;
}
function setCurrentUser(user){ sessionStorage.setItem('turni_user', JSON.stringify(user)); }
function clearCurrentUser(){ sessionStorage.removeItem('turni_user'); }

function requireAuth(redirectTo='index.html'){
  const u = getCurrentUser();
  if(!u){ window.location.href = redirectTo; return null; }
  // Refresh from ACCOUNTS in case displayName changed
  u.displayName = ACCOUNTS[u.uid]?.displayName || u.displayName;
  return u;
}

function requireOwner(){
  const u = requireAuth();
  if(u && u.role !== 'owner'){ window.location.href = 'home.html'; return null; }
  return u;
}

function doLogout(){
  clearCurrentUser();
  window.location.href = 'index.html';
}

// ── DATA STORES ───────────────────────────────────
let schedStore  = JSON.parse(localStorage.getItem('turni_v3_sched') || '{}');
let prefsStore  = JSON.parse(localStorage.getItem('turni_prefs')    || '{}');
let swapStore   = JSON.parse(localStorage.getItem('turni_swaps')    || '[]');
let coverStore  = JSON.parse(localStorage.getItem('turni_covers')   || '[]');
// coverStore: richieste di copertura (qualcuno copre il tuo turno → tu sei libero)

function saveSched(){ localStorage.setItem('turni_v3_sched', JSON.stringify(schedStore)); }
function savePrefs(){ localStorage.setItem('turni_prefs',    JSON.stringify(prefsStore)); }
function saveSwaps(){ localStorage.setItem('turni_swaps',    JSON.stringify(swapStore)); }
function saveCovers(){ localStorage.setItem('turni_covers',  JSON.stringify(coverStore)); }

function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

// ── DATE UTILS ────────────────────────────────────
function weekStart(off=0){
  const now=new Date(), day=now.getDay();
  const diff=day===0?-6:1-day;
  const m=new Date(now); m.setDate(now.getDate()+diff+(off||0)*7); m.setHours(0,0,0,0); return m;
}
function todayDate(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function fmt2(d){ return d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'}); }
function fmt3(d){ return d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit'}); }
function weekKey(off=0){ const d=weekStart(off); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function isoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtIso(s){ const p=s.split('-'); return `${p[2]}/${p[1]}`; }
function absWeekIdx(off=0){
  const ws=weekStart(off), ep=new Date('2000-01-03');
  return Math.round((ws-ep)/(7*24*3600*1000));
}
function sunOffIdx(off=0){ return ((absWeekIdx(off)%N)+N)%N; }
function offsetForDate(d){
  const ws0=weekStart(0); return Math.round((d-ws0)/(7*86400000));
}

// ── SCHEDULE ENGINE ───────────────────────────────
function rng(seed){
  let s=(seed^0xdeadbeef)>>>0;
  return()=>{ s^=s<<13; s^=s>>17; s^=s<<5; return(s>>>0)/0x100000000; };
}
function shuf(arr,r){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function genWeek(seed,off){
  const soe=EMPLOYEES[sunOffIdx(off)];
  for(let at=0;at<5000;at++){
    const res=tryGen(rng(seed+at*31337),soe);
    if(res.valid) return res;
  }
  return{valid:false,schedule:null,errors:['Generazione fallita'],sunOffEmp:soe};
}

function tryGen(r,soe){
  const sc={}; EMPLOYEES.forEach(e=>{ sc[e]=new Array(7).fill(null); });
  sc[soe][6]='O';
  if(!asgDay(sc,6,r,false)) return{valid:false};
  if(!asgDay(sc,5,r,true))  return{valid:false};
  const needOff=EMPLOYEES.filter(e=>e!==soe);
  const pool=[0,1,2,3,4,...shuf([0,1,2,3,4],r).slice(0,2)];
  const os=shuf(pool,r);
  needOff.forEach((e,i)=>{ sc[e][os[i]]='O'; });
  for(let d=0;d<=4;d++){ if(!asgDay(sc,d,r,false)) return{valid:false}; }
  const errs=valSched(sc,soe);
  return{valid:errs.length===0,schedule:sc,errors:errs,sunOffEmp:soe};
}

function asgDay(sc,day,r,isSat){
  const MK=isSat?'SAT-M':'M', SK=isSat?'SAT-S':'S';
  const wk=EMPLOYEES.filter(e=>sc[e][day]===null);
  if(!wk.length) return true; if(wk.length<2) return false;
  const caps=wk.filter(e=>IS_CAPO[e]), males=wk.filter(e=>IS_MALE[e]);
  if(caps.length<2||!males.length) return false;
  for(let t=0;t<300;t++){
    const ws=shuf(wk,r), h=Math.ceil(ws.length/2);
    const tM=ws.slice(0,h), tS=ws.slice(h);
    if(tM.some(e=>IS_CAPO[e])&&tM.some(e=>IS_MALE[e])&&tS.some(e=>IS_CAPO[e])&&tS.some(e=>IS_MALE[e])){
      tM.forEach(e=>{ sc[e][day]=MK; }); tS.forEach(e=>{ sc[e][day]=SK; }); return true;
    }
  }
  // fallback
  const asgd={}, cs=shuf(caps,r), ms=shuf(males,r);
  asgd[cs[0]]=MK; asgd[cs[1]]=SK;
  if(!IS_MALE[cs[0]]){ const m=ms.find(e=>!asgd[e]); if(!m) return false; asgd[m]=MK; }
  if(!IS_MALE[cs[1]]){ const m=ms.find(e=>!asgd[e]); if(!m) return false; asgd[m]=SK; }
  const rest=wk.filter(e=>!asgd[e]);
  let mc=Object.values(asgd).filter(v=>v===MK).length, sc2=Object.values(asgd).filter(v=>v===SK).length;
  shuf(rest,r).forEach(e=>{ if(mc<=sc2){asgd[e]=MK;mc++;}else{asgd[e]=SK;sc2++;} });
  Object.entries(asgd).forEach(([e,v])=>{ sc[e][day]=v; });
  const iM=wk.filter(e=>sc[e][day]===MK), iS=wk.filter(e=>sc[e][day]===SK);
  return iM.some(e=>IS_CAPO[e])&&iM.some(e=>IS_MALE[e])&&iS.some(e=>IS_CAPO[e])&&iS.some(e=>IS_MALE[e]);
}

function valSched(sc,soe){
  const e=[];
  for(let d=0;d<7;d++){
    const sat=d===5, MK=sat?'SAT-M':'M', SK=sat?'SAT-S':'S';
    const iM=EMPLOYEES.filter(x=>sc[x][d]===MK), iS=EMPLOYEES.filter(x=>sc[x][d]===SK);
    if(iM.length){ if(!iM.some(x=>IS_CAPO[x])) e.push(`${DAYS[d]} mat: manca supervisore`); if(!iM.some(x=>IS_MALE[x])) e.push(`${DAYS[d]} mat: manca uomo`); }
    if(iS.length){ if(!iS.some(x=>IS_CAPO[x])) e.push(`${DAYS[d]} sera: manca supervisore`); if(!iS.some(x=>IS_MALE[x])) e.push(`${DAYS[d]} sera: manca uomo`); }
  }
  EMPLOYEES.forEach(emp=>{ if(!['SAT-M','SAT-S'].includes(sc[emp][5])) e.push(`${emp}: sab mancante`); const offs=sc[emp].filter(s=>s==='O').length; if(offs!==1) e.push(`${emp}: ${offs} liberi`); });
  return e;
}

function getOrGen(off){
  const k=weekKey(off);
  if(!schedStore[k]){ schedStore[k]=genWeek(off*1009+77777,off); saveSched(); }
  return schedStore[k];
}

function genTwoMonths(startOff=0){
  const ws=weekStart(startOff);
  const endMonth=ws.getMonth()+2;
  let off=startOff, count=0;
  while(count<10){
    const w=weekStart(off);
    if(w.getMonth()>endMonth&&w.getFullYear()>=ws.getFullYear()) break;
    const k=weekKey(off);
    schedStore[k]=genWeek(off*1009+(Date.now()%99991)+count*7,off);
    off++; count++;
  }
  saveSched();
}

// ── NOTIFICATION COUNTS ───────────────────────────
function pendingSwapsForMe(empName){
  return swapStore.filter(r=>
    r.targetColleagues?.includes(empName) &&
    r.responses?.[empName]==='pending' &&
    r.status==='pending'
  ).length;
}
function pendingCoversForMe(empName){
  return coverStore.filter(r=>
    r.targetColleagues?.includes(empName) &&
    r.responses?.[empName]==='pending' &&
    r.status==='pending'
  ).length;
}
function totalPendingForMe(empName){
  return pendingSwapsForMe(empName) + pendingCoversForMe(empName);
}

// ── SIDEBAR BUILDER ───────────────────────────────
function buildSidebar(activePage, user){
  const isOwner = user.role === 'owner';
  const empName = isOwner ? null : UID_TO_EMP[user.uid];
  const notifCount = empName ? totalPendingForMe(empName) : 0;
  // For owner: count pending swap+cover requests
  const ownerNotif = isOwner ? (swapStore.filter(r=>r.status==='pending').length + coverStore.filter(r=>r.status==='pending').length) : 0;
  const badge = n => n>0 ? `<span class="nav-badge">${n}</span>` : '';

  const navItem = (page, icon, label, count=0) => {
    const active = activePage===page?'active':'';
    const file = page+'.html';
    return `<a href="${file}" class="nav-item ${active}">
      <svg viewBox="0 0 24 24" fill="currentColor">${icon}</svg>
      ${label}${badge(count)}
    </a>`;
  };

  const avatar = (user.displayName||'?').charAt(0).toUpperCase();

  return `<aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon"><svg viewBox="0 0 24 24" fill="white"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg></div>
      <span class="sidebar-logo-text">Turni</span>
    </div>
    <span class="nav-section">Menu</span>
    ${navItem('home','<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>','Home')}
    ${navItem('turni','<path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.11-.89-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>','Turni')}
    ${navItem('calendario','<path d="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z"/>','Calendario')}
    ${isOwner ? navItem('staff','<path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>','Dipendenti') : ''}
    <span class="nav-section">Richieste</span>
    ${navItem('preferenze','<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/>','Preferenze')}
    ${navItem('cambi','<path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/>','Cambi turno')}
    ${navItem('coperture','<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>','Coperture',isOwner?ownerNotif:notifCount)}
    ${navItem('notifiche','<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>','Notifiche',isOwner?ownerNotif:notifCount)}
    <span class="nav-section">Profilo</span>
    ${navItem('account','<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>','Account')}
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-avatar">${avatar}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">${user.displayName}</div>
          <div class="sidebar-user-role">${isOwner?'Titolare':'Dipendente'}</div>
        </div>
        <button class="sidebar-logout" onclick="doLogout()" title="Esci">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </div>
    </div>
  </aside>
  <button class="hamburger" id="hamburger" onclick="document.getElementById('sidebar').classList.toggle('open')">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  </button>`;
}

// ── PILL BUILDER ──────────────────────────────────
function pillCls(code, dayIdx){
  if(code==='O' && dayIdx===6) return 'pill pill-OFF-SUN';
  return `pill pill-${code}`;
}
function pillLabel(code){
  if(code==='M'||code==='SAT-M') return 'Mattina';
  if(code==='S'||code==='SAT-S') return 'Sera';
  return 'Libero';
}
function pillShort(code){
  if(code==='M'||code==='SAT-M') return 'Mat.';
  if(code==='S'||code==='SAT-S') return 'Sera';
  return 'Lib.';
}

// ── WEEK NAV HTML ─────────────────────────────────
function weekNavHtml(labelId='week-label'){
  return `<div class="week-nav">
    <button id="btn-prev">&#8592;</button>
    <span class="week-label" id="${labelId}"></span>
    <button id="btn-next">&#8594;</button>
  </div>`;
}
function attachWeekNav(getOff, setOff, onRender, labelId='week-label'){
  const prev=document.getElementById('btn-prev'), next=document.getElementById('btn-next');
  if(prev) prev.onclick=()=>{ setOff(getOff()-1); onRender(); };
  if(next) next.onclick=()=>{ setOff(getOff()+1); onRender(); };
  updateWeekLabel(getOff(), labelId);
}
function updateWeekLabel(off, labelId='week-label'){
  const ws=weekStart(off), we=new Date(ws); we.setDate(ws.getDate()+6);
  const el=document.getElementById(labelId);
  if(el) el.textContent=`${fmt3(ws)} – ${fmt3(we)}`;
}

// ── CALENDAR MONTH BUILDER ────────────────────────
function buildCalMonth(year, month, dayRenderer){
  // dayRenderer(dt, dow7, isoStr) → {cls:'', content:'', onclick:'', title:''}
  const first=new Date(year,month,1), last=new Date(year,month+1,0);
  const startDow=first.getDay()===0?6:first.getDay()-1;
  const todayD=todayDate();

  let h=`<div class="cal-month">
    <div class="cal-month-title">${MONTHS_IT[month]} ${year}</div>
    <div class="cal-weeks"><div class="cal-week">`;
  ['L','M','M','G','V','S','D'].forEach(d=>{ h+=`<div class="cal-dh">${d}</div>`; });
  h+=`</div><div class="cal-week">`;
  for(let i=0;i<startDow;i++) h+=`<div class="cal-day empty"></div>`;

  let dow=startDow;
  for(let d=1;d<=last.getDate();d++){
    if(dow>0&&dow%7===0) h+=`</div><div class="cal-week">`;
    const dt=new Date(year,month,d);
    const dow7=dt.getDay();
    const iso=isoDate(dt);
    const isToday=dt.getTime()===todayD.getTime();
    const {cls='',content='',onclick='',title='',extra=''}=dayRenderer(dt,dow7,iso,isToday)||{};
    h+=`<div class="cal-day ${cls}" ${onclick?`onclick="${onclick}"`:''} title="${title}" ${extra}>${content||d}</div>`;
    dow++;
  }
  h+=`</div></div></div>`;
  return h;
}

// ═══════════════════════════════════════════════════
//  FIREBASE OVERRIDE
//  Quando firebase.js è caricato, queste funzioni
//  sostituiscono quelle localStorage.
// ═══════════════════════════════════════════════════

// Flag: true se Firebase è disponibile e inizializzato
let _fbReady = false;

// Override save functions — se Firebase è pronto usa quello,
// altrimenti fallback a localStorage (utile in sviluppo offline)
function saveSched(){
  localStorage.setItem('turni_v3_sched', JSON.stringify(schedStore));
  if(_fbReady) fbSaveSchedules().catch(console.error);
}
function saveSwaps(){
  localStorage.setItem('turni_swaps', JSON.stringify(swapStore));
  // Le singole swap vengono salvate con fbSaveSwap() nelle pagine
}
function saveCovers(){
  localStorage.setItem('turni_covers', JSON.stringify(coverStore));
}
function savePrefs(){
  localStorage.setItem('turni_prefs', JSON.stringify(prefsStore));
}
function saveAccounts(){
  localStorage.setItem('turni_accounts', JSON.stringify(ACCOUNTS));
  if(_fbReady) fbSaveAccounts().catch(console.error);
}

// Chiamata dalle pagine dopo fbInit()
function markFbReady(){ _fbReady = true; }
