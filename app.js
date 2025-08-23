/* ==========================================================
   BAFFALO – App logic (Firebase + pulsanti + feedback + classifica "corsa")
   ========================================================== */

/* 1) Firebase config */
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
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const toInt = (v, fb=0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fb;
};

/* 4) Estrai giocatori dai bottoni presenti */
function collectPlayersFromDOM(){
  const set = new Set();
  $$(".score-btn").forEach(btn => {
    if (btn.dataset.me) set.add(btn.dataset.me);
    if (btn.dataset.target) set.add(btn.dataset.target);
  });
  return Array.from(set);
}

/* 5) Assicura /scores con tutti i player a 0 se mancano */
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

/* 6) Render Classifica stile "corsa" */
function renderBoard(scoresObj){
  const board = $("#board");
  if (!board) return;

  const arr = Object.entries(scoresObj||{})
    .map(([name, pts]) => ({ name, pts: Number(pts)||0 }))
    .sort((a,b) => (b.pts - a.pts) || a.name.localeCompare(b.name));

  // Calcolo range per progress (gestisce anche negativi)
  const values = arr.map(x => x.pts);
  const min = Math.min(...values, 0); // includi 0 per non mostrare tutto > 50 quando tutti positivi
  const max = Math.max(...values, 0);
  const span = (max - min) || 1;

  // percentuale 10..100 per visibilità anche del più basso
  const pct = v => Math.max(10, Math.round(90 * (v - min) / span) + 10);

  board.innerHTML = arr.map((it, idx) => {
    const rank = idx + 1;
    const w = pct(it.pts);
    const rankClass =
      rank === 1 ? "bg-rank-1" :
      rank === 2 ? "bg-rank-2" :
      rank === 3 ? "bg-rank-3" : "bg-rank-n";

    return `
      <div class="lb-item">
        <div class="lb-head">
          <div class="lb-rank">${rank}</div>
          <div class="lb-name">${it.name}</div>
          <div class="lb-score">${it.pts}</div>
        </div>
        <div class="lb-progress">
          <div class="progress">
            <div class="progress-bar ${rankClass}" role="progressbar" style="width:${w}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/* 7) Transazione punteggio */
function applyDelta(player, delta){
  if (!player) return;
  db.ref("scores/"+player).transaction(cur => (Number(cur)||0) + toInt(delta,0));
}

/* 8) Feedback: ripple + (se disponibile) vibrazione + beep */
function rippleAt(btn, event){
  const rect = btn.getBoundingClientRect();
  const client = event.changedTouches ? event.changedTouches[0] : event;
  const x = (client.clientX || client.pageX) - rect.left;
  const y = (client.clientY || client.pageY) - rect.top;
  const span = document.createElement('span');
  span.className = 'ripple';
  span.style.left = (x - 8) + 'px';
  span.style.top  = (y - 8) + 'px';
  span.style.width = span.style.height = '16px';
  btn.appendChild(span);
  setTimeout(() => span.remove(), 520);
}

// Vibrazione: su iPhone non funziona (API non supportata)
function haptics(kind){
  if (!('vibrate' in navigator)) return;
  if (kind === 'penalty') navigator.vibrate([50, 40, 50]);
  else navigator.vibrate(25);
}

// Beep semplice (rispetta il silenzioso su iPhone)
let audioCtx;
function ensureAudioCtx(){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(freq=880, durationMs=90){
  try{
    ensureAudioCtx();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs/1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(t0 + durationMs/1000);
  }catch(e){}
}
function audioFeedback(kind){
  if (kind === 'penalty') beep(240, 120); else beep(880, 90);
}

/* 9) Click handler */
function onScoreButtonClick(e){
  const btn = e.currentTarget;
  const me = btn.dataset.me || null;
  const target = btn.dataset.target || null;
  const deltaMe = toInt(btn.dataset.deltaMe, 0);
  const deltaTarget = toInt(btn.dataset.deltaTarget, 0);
  if (!me) return;

  applyDelta(me, deltaMe);
  if (target) applyDelta(target, deltaTarget);

  const kind = btn.classList.contains('penalty') ? 'penalty' : 'win';
  haptics(kind);         // su iPhone non vibra, su Android sì
  audioFeedback(kind);   // beep breve
  rippleAt(btn, e);      // ripple visuale
}

/* 10) Reset DEV */
async function resetScores(){
  const players = collectPlayersFromDOM();
  const zero = {}; players.forEach(p => zero[p]=0);
  await db.ref("scores").set(zero);
}

/* 11) Bind + Realtime */
function bindUI(){
  $$(".score-btn").forEach(btn => btn.addEventListener("click", onScoreButtonClick));
  db.ref("scores").on("value", snap => renderBoard(snap.val()||{}));

  const resetBtn = $("#resetScores");
  if (resetBtn){
    resetBtn.addEventListener("click", async () => {
      if (confirm("Azzero davvero tutti i punteggi?")) await resetScores();
    });
  }
}

/* 12) Boot */
async function boot(){
  await ensureInitialScores();
  bindUI();
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
