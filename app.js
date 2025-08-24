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

  if (id.startsWith('storico-')){
    const slug = id.slice('storico-'.length); // es. "lorenzo"
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

  race.querySelectorAll('[data-open-history]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const player = el.getAttribute('data-open-history');
      location.hash = `#storico-${player.toLowerCase()}`;
    });
  });

  race.querySelectorAll('.jockey').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const n = btn.dataset.name, p = toInt(btn.dataset.pts,0);
      showScoreToast(`${n}: ${p} punto${Math.abs(p)===1?'':'i'}`);
    });
  });

  renderDevForm(arr); // 🚧 DEV
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
  // prendi ultime 200 voci con CHIAVE
  histRef = db.ref('history/'+player).limitToLast(200);
  histRef.on('value', snap=>{
    const rows = [];
    snap.forEach(child => {
      const v = child.val() || {};
      rows.push({ key: child.key, ...v });
    });
    renderHistory(player, rows);
  });
}

function renderHistory(player, rows){
  const list = document.getElementById('history-'+player.toLowerCase());
  if (!list) return;
  rows.sort((a,b)=>(b.ts||0)-(a.ts||0));
  list.innerHTML = rows.map(e=>{
    const signClass = e.delta>0?'h-pos':(e.delta<0?'h-neg':'h-zero');
    const signText  = (e.delta>0?'+':'') + (e.delta||0);
    const when = e.ts ? fmtTS(e.ts) : '';
    return `
      <li class="history-item" data-key="${e.key||''}">
        <input type="checkbox" class="form-check-input h-check" />
        <div class="h-delta ${signClass}">${signText}</div>
        <div class="h-text">
          <div>${e.text||''}</div>
          <div class="h-time">${when}</div>
        </div>
      </li>`;
  }).join('') || `<li class="history-item"><div class="h-delta h-zero">0</div><div class="h-text">Nessuna voce ancora</div></li>`;
}

/* Batch delete di righe selezionate */
async function deleteHistoryEntries(player, keys){
  if (!keys || !keys.length) return;
  const updates = {};
  keys.forEach(k => updates[`history/${player}/${k}`] = null);
  await db.ref().update(updates);
}

/* =========================================================
   Baffalo – pulsanti punteggio diretto (con log)
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

  applyDelta(me,dMe);
  if (target) applyDelta(target,dT);

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
function dateKey(d){ const y=d.getFullYear(), m=String(d.getMonth()+1) .padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
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

  ref.transaction(v => v ? v : true);
}

/* ===== Liquidazione SOLO "ieri" (una volta per player) + LOG storico ===== */
async function settleSpritz(){
  const yKey = keyAddDays(todayKey(), -1);

  const settledSnap = await db.ref('spritz/settled').get();
  const settled = settledSnap.val() || {};

  const daySnap = await db.ref(`spritz/days/${yKey}`).get();
  const dayState = daySnap.val() || {};

  const updates = {};
  for (const player of PLAYERS){
    if (settled[player] === yKey) continue;

    const st = dayState[player] || {};
    let delta = 0;
    let parts = [];

    if (!st.call){ delta += -1; parts.push('non ha chiamato (-1)'); }
    if (st.no){ delta += -2; parts.push('ha usato NO (-2)'); }
    else { delta += +2; parts.push('NO non usato (+2)'); }

    if (delta !== 0){
      await db.ref('scores/'+player).transaction(cur => (Number(cur)||0)+delta);
    }

    const txt = `Spritz (ieri ${yKey}): ${parts.join('; ')} → totale ${delta>0?`+${delta}`:delta}`;
    await logHistory(player, delta, txt, 'spritz');

    updates[player] = yKey;
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
   🚧 DEV: Storico – selezione/elimina righe
========================================================= */
function sectionPlayer(section){
  return section.getAttribute('data-player') || (section.id||'').replace('storico-','');
}

function toggleHistorySelection(section, on){
  section.classList.toggle('history-dev-on', on);
}
function selectAllRows(section, checked){
  section.querySelectorAll('.history-item .h-check').forEach(ch => (ch.checked = !!checked));
}
async function deleteSelectedRows(section){
  const player = sectionPlayer(section);
  const keys = Array.from(section.querySelectorAll('.history-item .h-check:checked'))
    .map(ch => ch.closest('.history-item')?.getAttribute('data-key'))
    .filter(Boolean);
  if(!keys.length){ alert('Nessuna riga selezionata'); return; }
  if(confirm(`Elimino ${keys.length} riga/e dallo storico di ${player}?`)){
    await deleteHistoryEntries(player, keys);
  }
}

/* =========================================================
   🚧 DEV: Spritz – reset tasti di OGGI
========================================================= */
async function resetSpritzToday(player){
  await db.ref(`spritz/days/${todayKey()}/${player}`).remove();
}
async function resetSpritzTodayAll(){
  const updates={}; PLAYERS.forEach(p=>updates[p]=null);
  await db.ref(`spritz/days/${todayKey()}`).update(updates);
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

  // 🚧 Spritz DEV – associa pulsanti di reset
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

  // 🚧 Storico DEV – toolbar (toggle/select/delete)
  document.querySelectorAll('.view.detail.storico').forEach(section=>{
    // toggle selezione
    section.querySelectorAll('[data-history-dev="toggle"]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const on = !section.classList.contains('history-dev-on');
        toggleHistorySelection(section, on);
        btn.textContent = on ? 'Disattiva selezione righe [DEV]' : 'Attiva selezione righe [DEV]';
      });
    });
    // select all / none
    section.querySelectorAll('[data-history-dev="select-all"]').forEach(btn=>{
      btn.addEventListener('click', ()=> selectAllRows(section, true));
    });
    section.querySelectorAll('[data-history-dev="select-none"]').forEach(btn=>{
      btn.addEventListener('click', ()=> selectAllRows(section, false));
    });
    // delete selected
    section.querySelectorAll('[data-history-dev="delete-selected"]').forEach(btn=>{
      btn.addEventListener('click', ()=> deleteSelectedRows(section));
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

/* =======================
   ROULETTE – 20 penitenze
======================= */

// 🔧 Modifica qui i testi delle penitenze (devono essere 20)
const ROULETTE_PENALTIES = [
  "Bevi un sorso", "Scambia posto", "Parla in rima per 1 min",
  "Selfie di gruppo", "Complimento a tutti", "Mima un animale",
  "Canta un ritornello", "Dialetto per 2 min", "Fai 10 squat",
  "Toast a caso", "Cambio nickname oggi", "Storia IG del tavolo",
  "Imita un amico", "Parla solo con gesti 1 min", "Regina/ Re del brindisi",
  "Racconta un aneddoto", "Ballino di 10 sec", "Rispondi con sì/ no invertiti 1 min",
  "Sedia musicale (mini)", "Passa il telefono a sinistra"
];

const WHEEL = {
  el: null, ctx: null,
  size: 340,   // aggiornato a runtime
  angle: 0,    // rotazione attuale (radiani)
  vel: 0,      // velocità angolare
  last: 0,     // timestamp animazione
  spinning: false,
  seg: (2 * Math.PI) / ROULETTE_PENALTIES.length, // ampiezza settore
  lastTickSeg: null, // per suono/vibrazione ad ogni settore
};

function rouletteDraw() {
  const { ctx, size, angle, seg } = WHEEL;
  const r = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(r, r);
  ctx.rotate(angle);

  // settori
  for (let i = 0; i < ROULETTE_PENALTIES.length; i++) {
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.fillStyle = i % 2 === 0 ? "#222d" : "#333d";
    ctx.arc(0,0, r-6, i*seg, (i+1)*seg);
    ctx.closePath();
    ctx.fill();

    // linea bordo settore
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0,0, r-6, i*seg, (i+1)*seg);
    ctx.stroke();

    // etichette
    ctx.save();
    ctx.rotate(i*seg + seg/2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(11, r*0.085)}px Montserrat, system-ui`;
    ctx.translate((r*0.63), 0);
    // ombra leggera
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 6;
    ctx.fillText(ROULETTE_PENALTIES[i], 0, 0);
    ctx.restore();
  }

  // mozzo
  ctx.beginPath();
  ctx.fillStyle = "#111";
  ctx.arc(0,0, r*0.15, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function rouletteResize() {
  const wrap = document.querySelector(".wheel-wrap");
  if (!wrap) return;
  const s = Math.floor(Math.min(wrap.clientWidth, 480));
  const cvs = document.getElementById("wheelCanvas");
  if (!cvs) return;
  WHEEL.size = s;
  cvs.width = s; cvs.height = s;
  WHEEL.el = cvs;
  WHEEL.ctx = cvs.getContext("2d");
  rouletteDraw();
}

function rouletteTickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square"; o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 60);
  } catch {}
  if (navigator.vibrate) navigator.vibrate(10);
}

function rouletteAnimate(ts) {
  if (!WHEEL.spinning) return;
  if (!WHEEL.last) WHEEL.last = ts;
  const dt = Math.min(32, ts - WHEEL.last); // ms
  WHEEL.last = ts;

  // integrazione semplice
  WHEEL.angle += WHEEL.vel * (dt/16.666);
  // attrito
  WHEEL.vel *= 0.985;

  // tick su cambio settore
  const segIndex = ((ROULETTE_PENALTIES.length * ((WHEEL.angle % (2*Math.PI))+2*Math.PI)) / (2*Math.PI)) | 0;
  if (segIndex !== WHEEL.lastTickSeg) {
    WHEEL.lastTickSeg = segIndex;
    rouletteTickSound();
  }

  rouletteDraw();

  if (Math.abs(WHEEL.vel) < 0.002) {
    // fermo: snap al centro del settore più vicino
    WHEEL.spinning = false;
    WHEEL.last = 0;

    const norm = ((WHEEL.angle % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
    const pointerAngle = (3*Math.PI/2); // il triangolino è in alto (270°)
    const rel = (pointerAngle - norm + 2*Math.PI) % (2*Math.PI);
    const index = Math.floor(rel / WHEEL.seg) % ROULETTE_PENALTIES.length;

    const text = ROULETTE_PENALTIES[index];
    const out = document.getElementById("rouletteResult");
    if (out) out.textContent = `Penitenza: ${text}`;
    // se hai già un toast Bootstrap in app: lo riuso
    const toastBody = document.getElementById("scoreToastBody");
    const toastEl   = document.getElementById("scoreToast");
    if (toastBody && toastEl && window.bootstrap) {
      toastBody.textContent = `🎯 ${text}`;
      new bootstrap.Toast(toastEl).show();
    }
    return;
  }
  requestAnimationFrame(rouletteAnimate);
}

function rouletteSpinRandom() {
  if (!WHEEL.ctx) return;
  if (WHEEL.spinning) return;
  // velocità iniziale casuale (in rad/frame)
  WHEEL.vel = (Math.random()*0.35 + 0.25) * (Math.random() < 0.5 ? -1 : 1);
  WHEEL.spinning = true; WHEEL.last = 0;
  requestAnimationFrame(rouletteAnimate);
}

function rouletteAttachGestures() {
  const cvs = document.getElementById("wheelCanvas");
  if (!cvs) return;

  let dragging = false, lastAngle = 0, lastTime = 0;

  const center = () => {
    const rect = cvs.getBoundingClientRect();
    return { cx: rect.left + rect.width/2, cy: rect.top + rect.height/2 };
  };
  const angleFrom = (x,y) => {
    const c = center();
    return Math.atan2(y - c.cy, x - c.cx);
  };

  const start = (x,y) => {
    dragging = true;
    lastAngle = angleFrom(x,y);
    lastTime = Date.now();
    WHEEL.spinning = false; WHEEL.vel = 0;
  };
  const move = (x,y) => {
    if (!dragging) return;
    const a = angleFrom(x,y);
    const delta = a - lastAngle;
    WHEEL.angle += delta;
    WHEEL.vel = delta; // stima grezza, raffinata allo "end"
    lastAngle = a;
    rouletteDraw();
  };
  const end = (x,y) => {
    if (!dragging) return;
    const now = Date.now();
    const dt = Math.max(1, now - lastTime);
    // piccola spinta finale
    WHEEL.vel *= Math.min(3, 16/dt) * 1.5;
    dragging = false;
    if (Math.abs(WHEEL.vel) < 0.02) {
      // se troppo lenta, spin random
      rouletteSpinRandom();
    } else {
      WHEEL.spinning = true; WHEEL.last = 0;
      requestAnimationFrame(rouletteAnimate);
    }
  };

  // Touch
  cvs.addEventListener("touchstart", e => {
    const t = e.touches[0]; start(t.clientX, t.clientY);
  }, {passive:true});
  cvs.addEventListener("touchmove", e => {
    const t = e.touches[0]; move(t.clientX, t.clientY);
  }, {passive:true});
  cvs.addEventListener("touchend", e => {
    const t = e.changedTouches[0] || e.touches[0]; 
    const x = t ? t.clientX : 0, y = t ? t.clientY : 0;
    end(x,y);
  });

  // Mouse (per test desktop)
  cvs.addEventListener("mousedown", e => start(e.clientX, e.clientY));
  window.addEventListener("mousemove", e => move(e.clientX, e.clientY));
  window.addEventListener("mouseup",  e => end(e.clientX, e.clientY));
}

function rouletteInitIfVisible() {
  if (location.hash === "#roulette") {
    rouletteResize();
    rouletteAttachGestures();
  }
}

// bottone "SPIN"
document.addEventListener("click", (e)=>{
  if (e.target && e.target.id === "spinBtn") rouletteSpinRandom();
});

// resize & cambio sezione
window.addEventListener("resize", rouletteResize);
window.addEventListener("hashchange", rouletteInitIfVisible);

// prima inizializzazione se si entra direttamente
document.addEventListener("DOMContentLoaded", () => {
  rouletteInitIfVisible();
});
