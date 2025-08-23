/* ==========================================================
   BAFFALO – APP.JS (Firebase + logica punteggi)
   - Usa i bottoni .score-btn con data-* per applicare i delta
   - Mantiene /scores nel Realtime Database
   - Aggiorna #board in tempo reale
   ========================================================== */

/* 1) Firebase: incolla qui la tua config */
const firebaseConfig = {
  apiKey: "AIzaSyCc7BW6hHPx5MFcRXBmfJ5MC40j_qtQ5CA",
  authDomain: "baffaloenonsolo.firebaseapp.com",
  databaseURL: "https://baffaloenonsolo-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "baffaloenonsolo",
  storageBucket: "baffaloenonsolo.firebasestorage.app",
  messagingSenderId: "687589907379",
  appId: "1:687589907379:web:a65a0b4caa81753b31c9c6",
  measurementId: "G-NFXVQJ2VNF"
};

/* 2) Init Firebase (SDK v8 namespace) */
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
firebase.auth().signInAnonymously().catch(console.error);

/* 3) Utility */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const toInt = (v, fb = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fb;
};

/* 4) Raccogli i giocatori dal DOM (me/target dei bottoni), così non servono liste hardcoded */
function collectPlayersFromDOM() {
  const set = new Set();
  $$(".score-btn").forEach(btn => {
    if (btn.dataset.me) set.add(btn.dataset.me);
    if (btn.dataset.target) set.add(btn.dataset.target);
  });
  return Array.from(set);
}

/* 5) Inizializza /scores se vuoto (mette 0 a tutti i player trovati nel DOM) */
async function ensureInitialScores() {
  const players = collectPlayersFromDOM();
  if (players.length === 0) return;

  const snap = await db.ref("scores").get();
  if (!snap.exists()) {
    const init = {};
    players.forEach(p => (init[p] = 0));
    await db.ref("scores").set(init);
  } else {
    // Se esiste, assicura che eventuali player nuovi siano presenti
    const val = snap.val() || {};
    let needsUpdate = false;
    players.forEach(p => {
      if (typeof val[p] !== "number") {
        val[p] = 0;
        needsUpdate = true;
      }
    });
    if (needsUpdate) await db.ref("scores").set(val);
  }
}

/* 6) Render Classifica (ordinata per punteggio decrescente, poi per nome) */
function renderBoard(scores) {
  const board = $("#board");
  if (!board) return;

  const rows = Object.entries(scores || {})
    .map(([name, pts]) => ({ name, pts: Number(pts) || 0 }))
    .sort((a, b) => (b.pts - a.pts) || a.name.localeCompare(b.name))
    .map((item, i) => `
      <li>
        <span class="name">${i + 1}. ${item.name}</span>
        <span class="price">${item.pts}</span>
      </li>
    `)
    .join("");

  board.innerHTML = rows;
}

/* 7) Applica una variazione a un player con transaction (safe su concorrenti) */
function applyDelta(player, delta) {
  if (!player) return;
  db.ref("scores/" + player).transaction(cur => (Number(cur) || 0) + toInt(delta, 0));
}

/* 8) Click handler per TUTTI i bottoni .score-btn
   - Legge data-me, data-target, data-delta-me, data-delta-target
   - Esempio: presa = +3 a me / -2 al target; errore = -2 a me
*/
function onScoreButtonClick(e) {
  const btn = e.currentTarget;
  const me = btn.dataset.me || null;
  const target = btn.dataset.target || null;
  const deltaMe = toInt(btn.dataset.deltaMe, 0);
  const deltaTarget = toInt(btn.dataset.deltaTarget, 0);

  if (!me) return;
  applyDelta(me, deltaMe);
  if (target) applyDelta(target, deltaTarget);
}

/* 9) Binding eventi e start realtime */
function bindUI() {
  // Collega tutti i bottoni di punteggio
  $$(".score-btn").forEach(btn => btn.addEventListener("click", onScoreButtonClick));

  // Ascolta /scores in realtime per aggiornare la classifica
  db.ref("scores").on("value", snap => renderBoard(snap.val() || {}));
}

/* 10) Boot */
async function boot() {
  await ensureInitialScores();
  bindUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

/* ----------------------------------------------------------
   NOTE:
   - I valori dei punteggi sono guidati dai data-* nei bottoni:
     data-delta-me="+3"  data-delta-target="-2"  (presa)
     data-delta-me="-2"                          (errore)
   - Per cambiare schema (es. -3 al target), basta cambiare i data-* in index.html.
   - La classifica (#board) è un <ul> con class "menu-list".
   ---------------------------------------------------------- */
