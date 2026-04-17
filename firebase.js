// ═══════════════════════════════════════════════════
//  firebase.js  —  Firebase Realtime Database SDK v12
//  Progetto: leone-tabacchi
// ═══════════════════════════════════════════════════

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getDatabase, ref, get,
         set, remove, onValue } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js';

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

// ── SANITIZE ──────────────────────────────────────
// Firebase rifiuta QUALSIASI valore undefined nelle proprietà.
// JSON.parse(JSON.stringify(x)) lo elimina in profondità.
function clean(obj) {
  if (obj === undefined) return null;
  try { return JSON.parse(JSON.stringify(obj)); }
  catch(e) { return null; }
}

// Account di default — usati se Firebase è vuoto
const DEFAULT_ACCOUNTS = {
  domenico: { displayName:'Domenico',    role:'owner',    password:'admin123' },
  cristian: { displayName:'Cristian',    role:'employee', password:'cris2024' },
  manila:   { displayName:'Manila',      role:'employee', password:'man2024'  },
  swami:    { displayName:'Swami',       role:'employee', password:'swa2024'  },
  matteo:   { displayName:'Matteo',      role:'employee', password:'mat2024'  },
  nico:     { displayName:'Nico',        role:'employee', password:'nic2024'  },
  giorgias: { displayName:'Giorgia S.',  role:'employee', password:'gios2024' },
  giorgiap: { displayName:'Giorgia P.',  role:'employee', password:'giop2024' },
  alessia:  { displayName:'Alessia',     role:'employee', password:'ale2024'  }
};

// ── DB HELPERS ────────────────────────────────────
async function dbGet(path) {
  const snap = await get(ref(_db, path));
  return snap.val();  // null se non esiste
}

async function dbSet(path, value) {
  const safe = clean(value);
  if (safe === null) {
    console.warn('dbSet: valore null/undefined per', path, '— skip');
    return;
  }
  await set(ref(_db, path), safe);
}

async function dbRemove(path) {
  await remove(ref(_db, path));
}

// ── ACCOUNTS ──────────────────────────────────────
async function fbLoadAccounts() {
  const data = await dbGet('accounts');
  if (data) {
    // Firebase ha già i dati: aggiorna ACCOUNTS con quelli remoti
    window.ACCOUNTS = Object.assign({}, DEFAULT_ACCOUNTS, data);
  } else {
    // Prima volta: scrivi i default su Firebase
    window.ACCOUNTS = Object.assign({}, DEFAULT_ACCOUNTS);
    await dbSet('accounts', window.ACCOUNTS);
  }
}

async function fbSaveAccounts() {
  await dbSet('accounts', window.ACCOUNTS);
}

// ── SCHEDULES ─────────────────────────────────────
async function fbLoadSchedules() {
  const data = await dbGet('schedules');
  window.schedStore = data || {};
}

async function fbSaveSchedules() {
  await dbSet('schedules', window.schedStore);
}

async function fbSaveWeek(key, value) {
  await dbSet('schedules/' + key, value);
}

// ── SWAPS ─────────────────────────────────────────
async function fbLoadSwaps() {
  const data = await dbGet('swaps');
  if (!data) { window.swapStore = []; return; }
  window.swapStore = Object.values(data)
    .sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||''));
}

async function fbSaveSwap(swap) {
  await dbSet('swaps/' + swap.id, swap);
}

async function fbDeleteSwap(id) {
  await dbRemove('swaps/' + id);
}

// ── COVERS ────────────────────────────────────────
async function fbLoadCovers() {
  const data = await dbGet('covers');
  if (!data) { window.coverStore = []; return; }
  window.coverStore = Object.values(data)
    .sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||''));
}

async function fbSaveCover(cover) {
  await dbSet('covers/' + cover.id, cover);
}

async function fbDeleteCover(id) {
  await dbRemove('covers/' + id);
}

// ── PREFS ─────────────────────────────────────────
async function fbLoadPrefs() {
  const data = await dbGet('prefs');
  window.prefsStore = data || {};
}

async function fbSavePref(uid, pref) {
  await dbSet('prefs/' + uid, pref);
}

// ── REAL-TIME LISTENERS ───────────────────────────
function fbListenSwaps(callback) {
  onValue(ref(_db, 'swaps'), snap => {
    const data = snap.val();
    window.swapStore = data
      ? Object.values(data).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''))
      : [];
    try { callback(); } catch(e) { console.warn('fbListenSwaps callback error:', e); }
  });
}

function fbListenCovers(callback) {
  onValue(ref(_db, 'covers'), snap => {
    const data = snap.val();
    window.coverStore = data
      ? Object.values(data).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''))
      : [];
    try { callback(); } catch(e) { console.warn('fbListenCovers callback error:', e); }
  });
}

function fbListenSchedule(wk, callback) {
  onValue(ref(_db, 'schedules/' + wk), snap => {
    const data = snap.val();
    if (data) window.schedStore[wk] = data;
    try { callback(); } catch(e) { console.warn('fbListenSchedule callback error:', e); }
  });
}

// ── INIT ──────────────────────────────────────────
async function fbInit(onReady) {
  try {
    showLoading(true);
    await Promise.all([
      fbLoadAccounts(),
      fbLoadSchedules(),
      fbLoadSwaps(),
      fbLoadCovers(),
      fbLoadPrefs(),
    ]);
    showLoading(false);
    window._fbReady = true;
    if (onReady) onReady();
  } catch(err) {
    showLoading(false);
    console.error('Firebase init error:', err);
    showFbError('Errore connessione: ' + err.message);
  }
}

// ── UI HELPERS ────────────────────────────────────
function showLoading(show) {
  let el = document.getElementById('fb-loading');
  if (show && !el) {
    el = document.createElement('div');
    el.id = 'fb-loading';
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'background:rgba(240,240,240,0.96)',
      'display:flex;flex-direction:column',
      'align-items:center;justify-content:center;gap:14px',
      'font-family:Figtree,sans-serif'
    ].join(';');
    el.innerHTML = [
      '<div style="width:32px;height:32px;border-radius:50%',
      'border:3px solid #ddd;border-top-color:#333',
      'animation:_sp 0.65s linear infinite"></div>',
      '<div style="font-size:13px;color:#999;letter-spacing:.04em">Connessione al database...</div>',
      '<style>@keyframes _sp{to{transform:rotate(360deg)}}</style>'
    ].join(';');
    document.body.appendChild(el);
  }
  if (el) el.style.display = show ? 'flex' : 'none';
}

function showFbError(msg) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed;top:16px;right:16px;z-index:9999',
    'background:#fbeaea;border:1px solid #e0a8a8',
    'border-radius:12px;padding:14px 18px',
    'font-family:Figtree,sans-serif;font-size:13px',
    'color:#b01c1c;max-width:340px',
    'box-shadow:0 4px 20px rgba(0,0,0,.12);line-height:1.5'
  ].join(';');
  el.innerHTML = '<strong>Errore Firebase</strong><br>' + msg +
    '<br><small style="opacity:.65">Controlla la console (F12) per dettagli</small>';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 15000);
}

function showFbSuccess(msg) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed;bottom:24px;right:24px;z-index:9999',
    'background:#eaf5ef;border:1px solid #9fd4b4',
    'border-radius:9px;padding:10px 16px',
    'font-family:Figtree,sans-serif;font-size:13px',
    'color:#1a7a3c;font-weight:600',
    'box-shadow:0 2px 12px rgba(0,0,0,.08)'
  ].join(';');
  el.textContent = '✓ ' + (msg || 'Salvato');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ── ESPORTA su window (app.js è script classico, non modulo) ──
window.fbInit           = fbInit;
window.fbSaveAccounts   = fbSaveAccounts;
window.fbSaveSchedules  = fbSaveSchedules;
window.fbSaveWeek       = fbSaveWeek;
window.fbSaveSwap       = fbSaveSwap;
window.fbDeleteSwap     = fbDeleteSwap;
window.fbSaveCover      = fbSaveCover;
window.fbDeleteCover    = fbDeleteCover;
window.fbSavePref       = fbSavePref;
window.fbListenSwaps    = fbListenSwaps;
window.fbListenCovers   = fbListenCovers;
window.fbListenSchedule = fbListenSchedule;
window.showFbSuccess    = showFbSuccess;

// Segnala alle pagine che il modulo è pronto
window._firebaseModuleReady = true;
if (typeof window._firebaseReadyCallback === 'function') {
  window._firebaseReadyCallback();
  window._firebaseReadyCallback = null;
}
