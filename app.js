/* ==========================================================
   BAFFALO – APP.JS (Firebase + logica punteggi + reset DEV)
   ========================================================== */

/* 1) Firebase config (la tua) */
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

/* 2) Init Firebase (SDK v8) */
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
firebase.auth().signInAnonymously().catch(console.error);

/* 3) Helpers */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const toInt = (v, fb=0) => Number.isFinite(parseInt(v,10)) ? parseInt(v,10) : fb;

/* 4) Trova i giocatori leggendo i data-* dei bottoni */
function collectPlayersFromDOM(){
  const set = new Set();
  $$(".score-btn").forEach(btn => {
    if (btn.dataset.me) set.add(btn.dataset.me);
    if (btn.dataset.target) set.add(btn.dataset.target);
  });
  return Array.from(set);
}

/* 5) Inizializza /scores se vuoto o se mancano giocatori */
async function ensureInitialScores(){
  const players = collectPlayersFromDOM();
  if (!players.length) return;
  const ref = db.ref("scores");
  const snap = await ref.get();
  if (!snap.exists()){
    const init = {}; players.forEach(p => init[p]=0);
    await ref.set(init);
  } else {
    const val = snap.val() || {};
    let changed = false;
    players.forEach(p => { if (typeof val[p] !== "number"){ val[p]=0; changed=true; } });
    if (changed) await ref.set(val);
  }
}

/* 6) Render Classifica ordinata */
function renderBoard(scores){
  const board = $("#board");
  if (!board) return;
  const rows = Object.entries(scores||{})
    .map(([name, pts]) => ({ name, pts: Number(pts)||0 }))
    .sort((a,b) => (b.pts - a.pts) || a.name.localeCompare(b.name))
    .map((item,i) => `
      <li>
        <span class="name">${i+1}. ${item.name}</span>
        <span class="price">${item.pts}</span>
      </li>
    `).join("");
  board.innerHTML = rows;
}

/* 7) Variazioni punteggio con transaction */
function applyDelta(player, delta){
  if (!player) return;
  db.ref("scores/"+player).transaction(cur => (Number(cur)||0) + toInt(delta,0));
}

/* 8) Click su qualsiasi .score-btn -> applica i delta */
function onScoreButtonClick(e){
  const btn = e.currentTarget;
  const me = btn.dataset.me || null;
  const target = btn.dataset.target || null;
  const deltaMe = toInt(btn.dataset.deltaMe, 0);
  const deltaTarget = toInt(btn.dataset.deltaTarget, 0);

  if (!me) return;
  applyDelta(me, deltaMe);
  if (target) applyDelta(target, deltaTarget);
}

/* 9) Reset DEV: azzera tutti i punteggi a 0 */
async function resetScores(){
  const players = collectPlayersFromDOM();
  const zero = {}; players.forEach(p => zero[p]=0);
  await db.ref("scores").set(zero);
}

/* 10) Bind UI + realtime */
function bindUI(){
  // Bottoni punteggio
  $$(".score-btn").forEach(btn => btn.addEventListener("click", onScoreButtonClick));

  // Realtime classifica
  db.ref("scores").on("value", snap => renderBoard(snap.val()||{}));

  // Bottone DEV azzera
  const resetBtn = $("#resetScores");
  if (resetBtn){
    resetBtn.addEventListener("click", async () => {
      if (confirm("Azzero davvero tutti i punteggi?")) {
        await resetScores();
      }
    });
  }
}

/* 11) Boot */
async function boot(){
  await ensureInitialScores();
  bindUI();
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
