/* =========================================================
   Firebase
========================================================= */
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

/* =========================================================
   Utils & Costanti
========================================================= */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const toInt = (v, fb=0) => { const n = parseInt(v,10); return Number.isFinite(n) ? n : fb; };

const PLAYERS = ["Lorenzo","Matteo","Ilaria","Sara"];
const TOKEN   = { Lorenzo:"👑", Matteo:"🎾", Sara:"🏐", Ilaria:"🍹" };

/* time & format */
function pad(n){ return String(n).padStart(2,'0'); }
function fmtTS(ts){
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* =========================================================
   Router (una vista alla volta, via hash)
========================================================= */
let histRef = null;   // listener attivo per storico corrente

function showByHash(){
  const id = (location.hash || '#home').slice(1);
  $$('.view').forEach(v => v.classList.remove('active'));
  (document.getElementById(id) || document.getElementById('home')).classList.add('active');

  // attach/detach storico
  if (id.startsWith('storico-')){
  const slug = id.slice('storico-'.length); // es. "lorenzo"
  // mappa allo spelling ufficiale in PLAYERS (con la maiuscola)
  const player = PLAYERS.find(p => p.toLowerCase() === slug.toLowerCase()) || slug;
  attachHistory(player);
} else {
  detachHistory();
}

}
window.addEventListener('hashchange', showByHash);
document.addEventListener('DOMContentLoaded', showByHash);

/* =========================================================
   Inizializzazione punteggi
========================================================= */
async function ensureInitialScores(){
  const ref = db.ref('scores');
  const s = await ref.get();
  if (!s.exists()){
    const init={}; PLAYERS.forEach(p=>init[p]=0);
    await ref.set(init);
  } else {
    const v=s.val()||{}; let changed=false;
    PLAYERS.forEach(p=>{ if(typeof v[p]!=='number'){ v[p]=0; changed=true; } });
    if (changed) await ref.set(v);
  }
}

/* =========================================================
   Classifica (corsa)
========================================================= */
let toastRef;
function showScoreToast(txt){
  const el = $('#scoreToast'); if (!el) return;
  $('#scoreToastBody').textContent = txt;
  toastRef = toastRef || new bootstrap.Toast(el);
  toastRef.show();
}

function renderRace(scoresObj){
  const race = $('#race'); if (!race) return;
  const arr = Object.entries(scoresObj||{}).map(([name,pts])=>({name,pts:Number(pts)||0}))
               .sort((a,b)=>(b.pts-a.pts)||a.name.localeCompare(b.name));

  const vals = arr.map(x=>x.pts), min = Math.min(...vals,0), max = Math.max(...vals,0);
  const span = (max-min)||1;
  const pct = v => Math.max(6, Math.min(94, Math.round(100*(v-min)/span)));

  race.innerHTML = arr.map((it,i)=>{
    const rank=i+1, left=pct(it.pts);
    const rankCls = rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'';
    const jockeyRank = rank<=3?`rank-${rank}`:'rank-n';
    const trophy = rank===1?`<i class="bi bi-trophy-fill trophy ms-1"></i>`:'';
    const aria = `${it.name} ha ${it.pts} punti`;
    return `
      <div class="lane" data-open-history="${it.name}">
        <div class="lane-head" title="Apri storico di ${it.name}">
          <div class="rank-badge ${rankCls}">${rank}</div>
          <div class="lb-name fw-bold">${it.name} ${trophy}</div>
          <div class="lb-score fw-bold">${it.pts}</div>
        </div>
        <div class="track" title="Apri storico di ${it.name}" data-open-history="${it.name}">
          <button class="jockey ${jockeyRank}" style="left:${left}%"
            data-name="${it.name}" data-pts="${it.pts}" aria-label="${aria}" title="${aria}">
            ${TOKEN[it.name]||"🐎"}
          </button>
        </div>
      </div>`;
  }).join('');

  // Click su nome/corsia → storico
  race.querySelectorAll('[data-open-history]').forEach(el=>{
  el.addEventListener('click', ()=>{
    const player = el.getAttribute('data-open-history');
    location.hash = `#storico-${player.toLowerCase()}`;
  });
});


  // Click sulla pedina → toast punti (come prima)
  race.querySelectorAll('.jockey').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const n = btn.dataset.name, p = toInt(btn.dataset.pts,0);
      showScoreToast(`${n}: ${p} punto${Math.abs(p)===1?'':'i'}`);
    });
  });

  renderDevForm(arr); // 🚧 DEV – form per modificare manualmente i punteggi
}

/* =========================================================
   Feedback: audio, aptico, ripple & flash
========================================================= */
let audioCtx;
function ensureAudioCtx(){
  try{
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
  }catch(e){}
}
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
function flashGray(btn){
  btn.classList.add('flash');
  setTimeout(()=>btn.classList.remove('flash'), 180);
}

/* =========================================================
   STORICO – scrittura & lettura
========================================================= */
function logHistory(player, delta, text, source){
  const entry = {
    ts: Date.now(),
    delta: Number(delta)||0,
    text: String(text||''),
    src: source||'',
  };
  return db.ref('history/'+player).push(entry);
}

function detachHistory(){
  if (histRef){ histRef.off(); histRef = null; }
}

function attachHistory(player){
  detachHistory();
  // ascolta ultimi 200 eventi, in pagina mostriamo dal più recente
  histRef = db.ref('history/'+player).limitToLast(200);
  histRef.on('value', snap=>{
    renderHistory(player, snap.val()||{});
  });
}

function renderHistory(player, obj){
  const list = document.getElementById('history-'+player.toLowerCase());
  if (!list) return;
  const rows = Object.values(obj).sort((a,b)=>(b.ts||0)-(a.ts||0));
  list.innerHTML = rows.map(e=>{
    const signClass = e.delta>0?'h-pos':(e.delta<0?'h-neg':'h-zero');
    const signText  = (e.delta>0?'+':'') + (e.delta||0);
    const when = e.ts ? fmtTS(e.ts) : '';
    return `
      <li class="history-item">
        <div class="h-delta ${signClass}">${signText}</div>
        <div class="h-text">
          <div>${e.text||''}</div>
          <div class="h-time">${when}</div>
        </div>
      </li>`;
  }).join('') || `<li class="history-item"><div class="h-delta h-zero">0</div><div class="h-text">Nessuna voce ancora</div></li>`;
}

/* =========================================================
   Baffalo – pulsanti punteggio diretto (con log storico)
========================================================= */
function applyDelta(player,delta){
  if (!player) return;
  db.ref('scores/'+player).transaction(cur => (Number(cur)||0)+toInt(delta,0));
}

function onScoreButtonClick(e){
  const b=e.currentTarget, me=b.dataset.me, target=b.dataset.target;
  const dMe=toInt(b.dataset.deltaMe,0), dT=toInt(b.dataset.deltaTarget,0);
  if(!me) return;
  const kind=b.classList.contains('penalty')?'penalty':'win';

  rippleAt(b,e); flashGray(b); haptics(kind); audioFeedback(kind);

  // Applica punteggi
  applyDelta(me,dMe);
  if (target) applyDelta(target,dT);

  // Log storico: descrizioni chiare
  if (kind==='penalty'){
    if (dMe!==0) logHistory(me, dMe, `Baffalo sbagliato`, 'baffalo');
  } else {
    if (dMe!==0) logHistory(me, dMe, `Ha chiamato Baffalo a ${target}`, 'baffalo');
    if (target && dT!==0) logHistory(target, dT, `Ha subito Baffalo da ${me}`, 'baffalo');
  }
}

function decorateBaffaloButtons(){
  $$('.score-btn.win, .score-btn.penalty').forEach(b=>{
    if (b.dataset.decorated) return;
    const token = b.classList.contains('penalty') ? '❌' : (TOKEN[b.dataset.target] || '🎯');
    const label = b.textContent.trim();
    b.innerHTML = `<span class="token">${token}</span><span class="label">${label}</span>`;
    b.dataset.decorated = "1";
  });
}

/* =========================================================
   Spritzettino – stato giornaliero + liquidazione (con log)
========================================================= */
function dateKey(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function todayKey(){ return dateKey(new Date()); }
function keyAddDays(key, delta){
  const [y,m,d]=key.split('-').map(Number);
  const dt=new Date(y, m-1, d); dt.setDate(dt.getDate()+delta);
  return dateKey(dt);
}

let spritzRef=null, currentDay=todayKey();

function updateSpritzUI(dayState){
  PLAYERS.forEach(p=>{
    const st = (dayState && dayState[p]) || {};
    $$(`[data-spritz][data-me="${p}"]`).forEach(btn=>{
      const type = btn.dataset.spritz;        // "call" | "no"
      const used = !!st[type];
      btn.disabled = used;
      btn.classList.toggle('used', used);

      const token = type==='call' ? '🍹' : '🚫';
      const txt   = used
        ? (type==='call' ? 'Spritz chiamato' : 'NO usato')
        : (type==='call' ? 'Posso chiamare Spritz' : 'Posso usare NO');

      btn.innerHTML = `<span class="token">${token}</span><span class="label">${txt}</span>`;
    });
  });
}

function attachSpritzListener(){
  if (spritzRef) spritzRef.off();
  spritzRef = db.ref(`spritz/days/${currentDay}`);
  spritzRef.on('value', s=>updateSpritzUI(s.val()||{}));
}

function onSpritzClick(e){
  const b = e.currentTarget;
  const player = b.dataset.me;
  const type = b.dataset.spritz; // "call" | "no"
  const ref = db.ref(`spritz/days/${todayKey()}/${player}/${type}`);

  rippleAt(b, e); flashGray(b);
  audioFeedback(type==='no' ? 'penalty' : 'win');
  haptics(type==='no' ? 'penalty' : 'win');

  // marca come usato oggi (idempotente)
  ref.transaction(v => v ? v : true);
}

/* ===== Liquidazione SOLO "ieri" (una volta per player) + LOG storico =====
   Regole (cambia qui i numeri se vuoi):
   - se NON chiami  => -1
   - se NON usi NO  => +2
   - se usi NO      => -2
*/
async function settleSpritz(){
  const yKey = keyAddDays(todayKey(), -1);     // ieri (YYYY-MM-DD)

  const settledSnap = await db.ref('spritz/settled').get();
  const settled = settledSnap.val() || {};

  const daySnap = await db.ref(`spritz/days/${yKey}`).get();
  const dayState = daySnap.val() || {};        // { Nome: {call:true/no:true}, ... }

  const updates = {};
  for (const player of PLAYERS){
    if (settled[player] === yKey) continue;    // già liquidato ieri

    const st = dayState[player] || {};         // se mancante: giorno silenzioso
    let delta = 0;
    let parts = [];

    if (!st.call){ delta += -1; parts.push('non ha chiamato (-1)'); }
    if (st.no){ delta += -2; parts.push('ha usato NO (-2)'); }
    else { delta += +2; parts.push('NO non usato (+2)'); }

    if (delta !== 0){
      await db.ref('scores/'+player).transaction(cur => (Number(cur)||0)+delta);
    }

    // Log storico Spritz (ieri)
    const txt = `Spritz (ieri ${yKey}): ${parts.join('; ')} → totale ${delta>0?`+${delta}`:delta}`;
    await logHistory(player, delta, txt, 'spritz');

    updates[player] = yKey;                    // marca "ieri liquidato"
  }

  if (Object.keys(updates).length){
    await db.ref('spritz/settled').update(updates);
  }
}

/* Se l’app resta aperta, passa il giorno → liquidazione e listener nuovo */
setInterval(async ()=>{
  const k = todayKey();
  if (k !== currentDay){
    await settleSpritz();
    currentDay = k;
    attachSpritzListener();
  }
}, 60000);

/* =========================================================
   🚧 DEV: Classifica (form numerico) + Reset punteggi
========================================================= */
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

/* =========================================================
   🚧 DEV: Spritz – reset tasti di OGGI
========================================================= */
async function resetSpritzToday(player){
  await db.ref(`spritz/days/${todayKey()}/${player}`).remove();
}
async function resetSpritzTodayAll(){
  const updates={}; PLAYERS.forEach(p=>updates[p]=null);
  await db.ref(`spritz/days/${todayKey()}`).update(updates); // null = delete
}

/* =========================================================
   Bind UI & Boot
========================================================= */
function bindUI(){
  // Baffalo
  decorateBaffaloButtons();
  $$('.score-btn.win, .score-btn.penalty').forEach(b=>b.addEventListener('click', onScoreButtonClick));

  // Spritz normale
  attachSpritzListener();
  $$('[data-spritz]').forEach(b=>b.addEventListener('click', onSpritzClick));

  // 🚧 Spritz DEV – associa i pulsanti di reset
  $$('[data-spritz-dev="me"]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      const me=b.dataset.me;
      if(confirm(`Resetto i tasti di OGGI per ${me}?`)) await resetSpritzToday(me);
    });
  });
  $$('[data-spritz-dev="all"]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      if(confirm('Resetto i tasti di OGGI per TUTTI?')) await resetSpritzTodayAll();
    });
  });

  // Realtime classifica
  db.ref('scores').on('value', s=>renderRace(s.val()||{}));

  // 🚧 Classifica DEV – azzera punteggi
  const resetBtn=$('#resetScores');
  if(resetBtn) resetBtn.addEventListener('click', async ()=>{ if(confirm('Azzero davvero tutti i punteggi?')) await resetScores(); });
}

async function boot(){
  await ensureInitialScores();
  await settleSpritz();   // calcola SOLO il giorno precedente
  bindUI();
  showByHash();
}
document.readyState==='loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
