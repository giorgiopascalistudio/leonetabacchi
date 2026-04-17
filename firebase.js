// ═══════════════════════════════════════════════════
//  firebase.js  —  Firebase Realtime Database (SDK v12, modular)
//  Progetto: leone-tabacchi
// ═══════════════════════════════════════════════════

import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getDatabase, ref, get, set,
         remove, onValue, off }                 from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js';

// ── CONFIG ────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyB2uVXLKmbVIRG5O_rSX4v1Y3zIfi0TYiU',
  authDomain:        'leone-tabacchi.firebaseapp.com',
  databaseURL:       'https://leone-tabacchi-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:         'leone-tabacchi',
  storageBucket:     'leone-tabacchi.firebasestorage.app',
  messagingSenderId: '894685773748',
  appId:             '1:894685773748:web:4f671d51d8ccbf5c2e3ce1'
};

const _app = initializeApp(firebaseConfig);
const _db  = getDatabase(_app);

// ── API GENERICA ──────────────────────────────────
async function dbGet(path){
  const snap = await get(ref(_db, path));
  return snap.val();
}
async function dbSet(path, value){
  await set(ref(_db, path), value);
}
async function dbRemove(path){
  await remove(ref(_db, path));
}
function dbListen(path, callback){
  onValue(ref(_db, path), snap => callback(snap.val()));
}
function dbUnlisten(path){
  off(ref(_db, path));
}

// ── ACCOUNTS ──────────────────────────────────────
async function fbLoadAccounts(){
  const data = await dbGet('accounts');
  if(data){
    Object.keys(data).forEach(uid => {
      if(window.ACCOUNTS[uid]) window.ACCOUNTS[uid] = { ...window.ACCOUNTS[uid], ...data[uid] };
      else window.ACCOUNTS[uid] = data[uid];
    });
  } else {
    await dbSet('accounts', window.ACCOUNTS);
  }
}
async function fbSaveAccounts(){
  await dbSet('accounts', window.ACCOUNTS);
}

// ── SCHEDULES ─────────────────────────────────────
async function fbLoadSchedules(){
  const data = await dbGet('schedules');
  window.schedStore = data || {};
}
async function fbSaveSchedules(){
  await dbSet('schedules', window.schedStore);
}
async function fbSaveWeek(key, value){
  await dbSet(`schedules/${key}`, value);
}

// ── SWAPS ─────────────────────────────────────────
async function fbLoadSwaps(){
  const data = await dbGet('swaps');
  if(!data){ window.swapStore = []; return; }
  window.swapStore = Object.values(data).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
async function fbSaveSwap(swap){
  await dbSet(`swaps/${swap.id}`, swap);
}
async function fbDeleteSwap(id){
  await dbRemove(`swaps/${id}`);
}

// ── COVERS ────────────────────────────────────────
async function fbLoadCovers(){
  const data = await dbGet('covers');
  if(!data){ window.coverStore = []; return; }
  window.coverStore = Object.values(data).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
async function fbSaveCover(cover){
  await dbSet(`covers/${cover.id}`, cover);
}
async function fbDeleteCover(id){
  await dbRemove(`covers/${id}`);
}

// ── PREFS ─────────────────────────────────────────
async function fbLoadPrefs(){
  const data = await dbGet('prefs');
  window.prefsStore = data || {};
}
async function fbSavePref(uid, pref){
  await dbSet(`prefs/${uid}`, pref);
}

// ── REAL-TIME LISTENERS ───────────────────────────
function fbListenSwaps(callback){
  dbListen('swaps', data => {
    window.swapStore = data
      ? Object.values(data).sort((a,b) => b.createdAt.localeCompare(a.createdAt))
      : [];
    callback();
  });
}
function fbListenCovers(callback){
  dbListen('covers', data => {
    window.coverStore = data
      ? Object.values(data).sort((a,b) => b.createdAt.localeCompare(a.createdAt))
      : [];
    callback();
  });
}
function fbListenSchedule(wk, callback){
  dbListen(`schedules/${wk}`, data => {
    if(data) window.schedStore[wk] = data;
    callback();
  });
}

// ── INIT ──────────────────────────────────────────
async function fbInit(onReady){
  try {
    showLoadingOverlay(true);
    await Promise.all([
      fbLoadAccounts(),
      fbLoadSchedules(),
      fbLoadSwaps(),
      fbLoadCovers(),
      fbLoadPrefs(),
    ]);
    showLoadingOverlay(false);
    if(onReady) onReady();
  } catch(err){
    console.error('Firebase init error:', err);
    showLoadingOverlay(false);
    showFbError(err.message);
  }
}

function markFbReady(){ window._fbReady = true; }

// ── UI HELPERS ────────────────────────────────────
function showLoadingOverlay(show){
  let el = document.getElementById('fb-loading');
  if(show && !el){
    el = document.createElement('div');
    el.id = 'fb-loading';
    el.innerHTML = `<div style="
      position:fixed;inset:0;background:rgba(255,255,255,0.9);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;z-index:9999;
      flex-direction:column;gap:0.85rem;font-family:'Figtree',sans-serif;">
      <div style="width:34px;height:34px;border:3px solid #e0e0e0;border-top-color:#1a1a1a;
        border-radius:50%;animation:fbspin 0.7s linear infinite"></div>
      <div style="font-size:0.82rem;color:#999;letter-spacing:0.04em">Connessione al database...</div>
      <style>@keyframes fbspin{to{transform:rotate(360deg)}}</style>
    </div>`;
    document.body.appendChild(el);
  }
  if(el) el.style.display = show ? 'block' : 'none';
}

function showFbError(msg){
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;top:1rem;right:1rem;background:#fbeaea;border:1px solid #e0a8a8;
    border-radius:12px;padding:1rem 1.25rem;font-family:'Figtree',sans-serif;font-size:0.8rem;
    color:#b01c1c;z-index:9999;max-width:320px;box-shadow:0 4px 20px rgba(0,0,0,0.1);line-height:1.5`;
  el.innerHTML = `<strong>Errore connessione Firebase</strong><br>${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 10000);
}

function showFbSuccess(msg = 'Salvato'){
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;background:#eaf5ef;border:1px solid #9fd4b4;
    border-radius:9px;padding:0.65rem 1.1rem;font-family:'Figtree',sans-serif;font-size:0.78rem;
    color:#1a7a3c;z-index:9999;box-shadow:0 2px 12px rgba(0,0,0,0.07);font-weight:600`;
  el.textContent = '✓ ' + msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ── EXPORT GLOBALE (app.js non è un modulo ES) ────
window.fbInit          = fbInit;
window.markFbReady     = markFbReady;
window.fbSaveAccounts  = fbSaveAccounts;
window.fbSaveSchedules = fbSaveSchedules;
window.fbSaveWeek      = fbSaveWeek;
window.fbSaveSwap      = fbSaveSwap;
window.fbDeleteSwap    = fbDeleteSwap;
window.fbSaveCover     = fbSaveCover;
window.fbDeleteCover   = fbDeleteCover;
window.fbSavePref      = fbSavePref;
window.fbListenSwaps   = fbListenSwaps;
window.fbListenCovers  = fbListenCovers;
window.fbListenSchedule= fbListenSchedule;
window.showFbSuccess   = showFbSuccess;
window.showFbError     = showFbError;

// Segnala alle pagine che firebase.js è caricato e pronto
window.dispatchEvent(new Event('fb-ready'));

