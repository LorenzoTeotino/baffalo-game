/* ===== Firebase ===== */
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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
firebase.auth().signInAnonymously().catch(console.error);

/* ===== Utility ===== */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const toInt = (v, fb=0) => { const n = parseInt(v,10); return Number.isFinite(n) ? n : fb; };

/* ===== Routing: mostra 1 pagina alla volta (niente scroll tra sezioni) ===== */
function showByHash(){
  const id = (location.hash || '#home').slice(1);
  $$('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id) || document.getElementById('home');
  el.classList.add('active');
}
window.addEventListener('hashchange', showByHash);
document.addEventListener('DOMContentLoaded', showByHash);

/* ===== Inizializza /scores se manca ===== */
function collectPlayersFromDOM(){
  const s = new Set();
  $$('.score-btn').forEach(b => { if (b.dataset.me) s.add(b.dataset.me); if (b.dataset.target) s.add(b.dataset.target); });
  return Array.from(s);
}
async function ensureInitialScores(){
  const players = collectPlayersFromDOM(); if (!players.length) return;
  const ref = db.ref('scores'); const snap = await ref.get();
  if (!snap.exists()){
    const init = {}; players.forEach(p => init[p]=0); await ref.set(init);
  }else{
    const val = snap.val()||{}; let changed=false;
    players.forEach(p => { if (typeof val[p] !== 'number'){ val[p]=0; changed=true; } });
    if (changed) await ref.set(val);
  }
}

/* ===== Pedine personalizzate ===== */
const TOKEN = {
  "Lorenzo":"👑",
  "Matteo":"🏸🎾",   // racchetta + pallina (padel approx)
  "Sara":"🏐",
  "Ilaria":"🍹"
};

/* ===== Render classifica “corsa” con coppa solo al primo ===== */
let toastRef;
function showScoreToast(txt){
  const el = $('#scoreToast'); $('#scoreToastBody').textContent = txt;
  toastRef = toastRef || new bootstrap.Toast(el); toastRef.show();
}
function renderRace(scoresObj){
  const race = $('#race'); if (!race) return;
  const arr = Object.entries(scoresObj||{})
    .map(([name,pts])=>({name,pts:Number(pts)||0}))
    .sort((a,b)=>(b.pts-a.pts)||a.name.localeCompare(b.name));

  const values = arr.map(x=>x.pts);
  const min = Math.min(...values,0), max = Math.max(...values,0);
  const span = (max-min) || 1;
  const pct = v => Math.max(6, Math.min(94, Math.round(100*(v-min)/span))); // 6..94%

  race.innerHTML = arr.map((it,idx)=>{
    const rank = idx+1;
    const left = pct(it.pts);
    const rankCls = rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'';
    const jockeyRank = rank<=3 ? `rank-${rank}` : 'rank-n';
    const trophy = rank===1 ? `<i class="bi bi-trophy-fill trophy ms-1"></i>` : '';
    const aria = `${it.name} ha ${it.pts} punti`;

    return `
      <div class="lane">
        <div class="lane-head">
          <div class="rank-badge ${rankCls}">${rank}</div>
          <div class="lb-name fw-bold">${it.name} ${trophy}</div>
          <div class="lb-score fw-bold">${it.pts}</div>
        </div>
        <div class="track">
          <button class="jockey ${jockeyRank}" style="left:${left}%"
                  data-name="${it.name}" data-pts="${it.pts}"
                  aria-label="${aria}" title="${aria}">${TOKEN[it.name]||"🐎"}</button>
        </div>
      </div>
    `;
  }).join('');

  race.querySelectorAll('.jockey').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const n = btn.dataset.name, p = toInt(btn.dataset.pts,0);
      showScoreToast(`${n}: ${p} punto${Math.abs(p)===1?'':'i'}`);
    });
  });

  renderDevForm(arr); // aggiorna form DEV
}

/* ===== Punteggi (baffalo) ===== */
function applyDelta(player,delta){
  if (!player) return;
  db.ref('scores/'+player).transaction(cur => (Number(cur)||0)+toInt(delta,0));
}
function onScoreButtonClick(e){
  const b = e.currentTarget;
  const me=b.dataset.me, target=b.dataset.target;
  const dMe=toInt(b.dataset.deltaMe,0), dT=toInt(b.dataset.deltaTarget,0);
  if (!me) return;
  applyDelta(me,dMe); if (target) applyDelta(target,dT);
}

/* ===== Dev: form modifica manuale + reset ===== */
function renderDevForm(sorted){
  const form = $('#devForm'); if (!form) return;
  form.innerHTML = sorted.map(it=>`
    <div class="input-group mb-2">
      <span class="input-group-text">${it.name}</span>
      <input type="number" class="form-control" name="${it.name}" value="${it.pts}" inputmode="numeric">
    </div>
  `).join('');
  form.addEventListener('submit', async ev=>{
    ev.preventDefault();
    const data = new FormData(form); const obj={};
    for(const [k,v] of data.entries()) obj[k]=toInt(v,0);
    if (confirm('Salvare i punteggi inseriti?')) await db.ref('scores').update(obj);
  }, { once:true });
}
async function resetScores(){
  const snap = await db.ref('scores').get(); const v = snap.val()||{};
  const zero={}; Object.keys(v).forEach(k=>zero[k]=0);
  await db.ref('scores').set(zero);
}

/* ===== Bind & Boot ===== */
function bindUI(){
  $$('.score-btn').forEach(b=>b.addEventListener('click', onScoreButtonClick));
  db.ref('scores').on('value', s=>renderRace(s.val()||{}));
  const resetBtn = $('#resetScores');
  if (resetBtn) resetBtn.addEventListener('click', async ()=>{
    if (confirm('Azzero davvero tutti i punteggi?')) await resetScores();
  });
}
async function boot(){ await ensureInitialScores(); bindUI(); showByHash(); }
document.readyState==='loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
