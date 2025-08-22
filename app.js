// Lista giocatori
const PLAYERS = ["Matteo","Sara","Lorenzo","Ilaria"];

// Firebase config (incolla i tuoi valori qui)
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
firebase.auth().signInAnonymously();

// Nav
function show(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("view-"+name).classList.add("active");
  document.getElementById("btnBack").classList.toggle("hidden", name==="home");
}
document.querySelectorAll("[data-open]").forEach(el=>{
  el.addEventListener("click", ()=> show(el.dataset.open));
});
document.getElementById("btnBack").addEventListener("click", ()=> show("home"));

// Sblocco
function refreshLocks(){
  let unlocked = localStorage.getItem("accepted")==="1";
  ["punteggi","spritz","classifica","regole"].forEach(id=>{
    document.getElementById("tile-"+id).classList.toggle("locked", !unlocked);
  });
}
document.getElementById("btnUnlock").addEventListener("click", ()=>{
  localStorage.setItem("accepted","1"); refreshLocks();
});
refreshLocks();

// Classifica realtime
function renderBoard(scores){
  let arr = Object.entries(scores||{}).map(([p,t])=>({p,t:Number(t)||0}));
  arr.sort((a,b)=>b.t-a.t);
  document.getElementById("board").innerHTML =
    arr.map((s,i)=>`<div class="row"><span>${i+1}. ${s.p}</span><strong>${s.t}</strong></div>`).join("");
}
db.ref("scores").on("value", snap=>renderBoard(snap.val()||{}));

// Inizializza punteggi se vuoti
(async ()=>{
  let snap = await db.ref("scores").get();
  if(!snap.exists()){
    let init={}; PLAYERS.forEach(p=>init[p]=0);
    db.ref("scores").set(init);
  }
})();

// Selezione giocatori
let me=null, other=null;
function renderPlayers(){
  let meList=document.getElementById("meList");
  let otherList=document.getElementById("otherList");
  meList.innerHTML=""; otherList.innerHTML="";
  PLAYERS.forEach(p=>{
    let bm=document.createElement("button");
    bm.textContent=p; bm.className="player";
    if(p===me) bm.classList.add("active");
    bm.onclick=()=>{me=p;localStorage.setItem("me",p);renderPlayers()};
    meList.appendChild(bm);

    let bo=document.createElement("button");
    bo.textContent=p; bo.className="player";
    if(p===other) bo.classList.add("active");
    if(p===me) bo.disabled=true;
    bo.onclick=()=>{other=p;renderPlayers()};
    otherList.appendChild(bo);
  });
  document.getElementById("meLabel").textContent=me||"—";
  document.getElementById("otherLabel").textContent=other||"—";
  let enable=!!(me&&other);
  document.getElementById("btnBaffaloPreso").disabled=!enable;
  document.getElementById("btnBaffaloSbagliato").disabled=!enable;
  document.getElementById("btnPlus").disabled=!me;
  document.getElementById("btnMinus").disabled=!me;
}
me=localStorage.getItem("me")||null;
renderPlayers();

// Funzioni punteggio
function applyDelta(player,delta){
  db.ref("scores/"+player).transaction(cur=>(Number(cur)||0)+delta);
}
function actionPreso(){
  applyDelta(me,3); applyDelta(other,-3);
}
function actionSbagliato(){
  applyDelta(me,-3); applyDelta(other,3);
}
function actionPlus(){ applyDelta(me,1); }
function actionMinus(){ applyDelta(me,-1); }

document.getElementById("btnBaffaloPreso").onclick=actionPreso;
document.getElementById("btnBaffaloSbagliato").onclick=actionSbagliato;
document.getElementById("btnPlus").onclick=actionPlus;
document.getElementById("btnMinus").onclick=actionMinus;
