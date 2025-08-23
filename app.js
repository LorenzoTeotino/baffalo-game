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

/* ===== Routing ===== */
function showByHash(){
  const id = (location.hash || '#home').slice(1);
  $$('.view').forEach(v => v.classList.remove('active'));
  (document.getElementById(id) || document.getElementById('home')).classList.add('active');
}
window.addEventListener('hashchange', showByHash);
document.addEventListener('DOMContentLoaded', showByHash);

/* ===== Init /scores ===== */
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
    const v = snap.val()||{}; let changed=false;
    players.forEach(p => { if (typeof v[p] !== 'number'){ v[p]=0; changed=true; } });
    if (changed) await ref.set(v);
  }
}

/* ===== Pedine (emoji) ===== */
const TOKEN = { Lorenzo:"👑", Matteo:"🎾", Sara:"🏐", Ilaria:"🍹" };

/* ===== Toast ===== */
let toastRef;
function showScoreToast(txt){
  const el = $('#scoreToast'); if (!el) return;
  $('#scoreToastBody').textContent = txt;
  toastRef = toastRef || new bootstrap.Toast(el);
  toastRef.show();
}

/* ===== Classifica ===== */
function renderRace(scoresObj){
  const race = $('#race'); if (!race) return;
  const arr = Object.entries(scoresObj||{}).map(([name,pts])=>({name,pts:Number(pts)||0}))
               .sort((a,b)=>(b.pts-a.pts)||a.name.localeCompare(b.name));

  const vals = arr.map(x=>x.pts), min = Math.min(...vals,0), max = Math.max(...vals,0);
  const span = (max-min)||1, pct = v => Math.max(6, Math.min(94, Math.round(100*(v-min)/span)));

  race.innerHTML = arr.map((it,i)=>{
    const rank=i+1, left=pct(it.pts);
    const rankCls = rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'';
    const jockeyRank = rank<=3?`rank-${rank}`:'rank-n';
    const trophy = rank===1?`<i class="bi bi-trophy-fill trophy ms-1"></i>`:'';
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
            data-name="${it.name}" data-pts="${it.pts}" aria-label="${aria}" title="${aria}">
            ${TOKEN[it.name]||"🐎"}
          </button>
        </div>
      </div>`;
  }).join('');

  race.querySelectorAll('.jockey').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const n = btn.dataset.name, p = toInt(btn.dataset.pts,0);
      showScoreToast(`${n}: ${p} punto${Math.abs(p)===1?'':'i'}`);
    });
  });

  renderDevForm(arr);
}

/* ===== Feedback (audio+ripple+haptics) ===== */
let audioCtx;
function ensureAudioCtx(){ try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }catch(e){} }
function beep(freq=880, ms=90){
  try{
    ensureAudioCtx();
    const t0=audioCtx.currentTime, o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(0.16,t0+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+ms/1000);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(t0+ms/1000);
  }catch(e){}
}
function audioFeedback(kind){ kind==='penalty' ? beep(240,120) : beep(880,90); }
function haptics(kind){ if('vibrate' in navigator){ kind==='penalty'?navigator.vibrate([50,40,50]):navigator.vibrate(25); } }
function rippleAt(btn, ev){
  const rect=btn.getBoundingClientRect(), pt=ev.changedTouches?ev.changedTouches[0]:ev;
  const x=(pt.clientX||pt.pageX)-rect.left, y=(pt.clientY||pt.pageY)-rect.top;
  const s=document.createElement('span'); s.className='ripple'; s.style.left=(x-8)+'px'; s.style.top=(y-8)+'px'; s.style.width=s.style.height='16px';
  btn.appendChild(s); setTimeout(()=>s.remove(),520);
}

/* ===== Baffalo: bottone → aggiorna punteggi ===== */
function applyDelta(player,delta){ if(!player) return; db.ref('scores/'+player).transaction(cur => (Number(cur)||0)+toInt(delta,0)); }
function onScoreButtonClick(e){
  const b=e.currentTarget, me=b.dataset.me, target=b.dataset.target;
  const dMe=toInt(b.dataset.deltaMe,0), dT=toInt(b.dataset.deltaTarget,0);
  if(!me) return;
  const kind=b.classList.contains('penalty')?'penalty':'win';
  rippleAt(b,e); haptics(kind); audioFeedback(kind);
  applyDelta(me,dMe); if(target) applyDelta(target,dT);
}

/* ===== Abbellimento bottoni Baffalo (token + markup) ===== */
function decorateButtons(){
  $$('.score-btn').forEach(b=>{
    // Decidi quale emoji mostrare: target per win, una X per penalty
    const token = b.classList.contains('penalty') ? '❌' : (TOKEN[b.dataset.target] || '🎯');
    const label = b.textContent.trim();
    b.innerHTML = `<span class="token">${token}</span><span class="label">${label}</span>`;
  });
}

/* ===== Dev ===== */
function renderDevForm(sorted){
  const form = $('#devForm'); if(!form) return;
  form.innerHTML = sorted.map(it=>`
    <div class="input-group mb-2">
      <span class="input-group-text">${it.name}</span>
      <input type="number" class="form-control" name="${it.name}" value="${it.pts}" inputmode="numeric">
    </div>`).join('');
  form.addEventListener('submit', async ev=>{
    ev.preventDefault();
    const data=new FormData(form); const obj={}; for(const [k,v] of data.entries()) obj[k]=toInt(v,0);
    if(confirm('Salvare i punteggi inseriti?')) await db.ref('scores').update(obj);
  }, { once:true });
}
async function resetScores(){
  const snap=await db.ref('scores').get(); const v=snap.val()||{}; const zero={}; Object.keys(v).forEach(k=>zero[k]=0);
  await db.ref('scores').set(zero);
}

/* ===== Bind & Boot ===== */
function bindUI(){
  decorateButtons();
  $$('.score-btn').forEach(b=>b.addEventListener('click', onScoreButtonClick));
  db.ref('scores').on('value', s=>renderRace(s.val()||{}));
  const resetBtn=$('#resetScores');
  if(resetBtn) resetBtn.addEventListener('click', async ()=>{ if(confirm('Azzero davvero tutti i punteggi?')) await resetScores(); });
}
async function boot(){ await ensureInitialScores(); bindUI(); showByHash(); }
document.readyState==='loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();

