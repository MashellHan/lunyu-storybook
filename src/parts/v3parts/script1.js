<script>
(() => {
const AUD = __AUDIO__;
const TIM = __TIMINGS__;
const SENT = [
  { text:"学而时习之，不亦说乎？", py:["xué","ér","shí","xí","zhī","","bù","yì","yuè","hū",""], color:"#f08a5d", e:"e1", u:"u1" },
  { text:"有朋自远方来，不亦乐乎？", py:["yǒu","péng","zì","yuǎn","fāng","lái","","bù","yì","lè","hū",""], color:"#5fb3a1", e:"e2", u:"u2" },
  { text:"人不知而不愠，不亦君子乎？", py:["rén","bù","zhī","ér","bù","yùn","","bù","yì","jūn","zǐ","hū",""], color:"#7a8fd6", e:"e3", u:"u3" },
];
const SOLO = { bunny:{s:0, clip:"b1", sound:"squeak", word:"吱吱～"}, cat:{s:1, clip:"c2", sound:"meow", word:"喵～"}, dog:{s:2, clip:"d3", sound:"woof", word:"汪汪！"} };
const KIDS = ["bunny","cat","dog"];
const $ = s => document.querySelector(s);
const book = $("#book");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const EASE_OUT = "cubic-bezier(0.16,1,0.3,1)";
const setStep = s => { book.dataset.step = s; };
window.__log = [];

/* fit the 1180x820 page to any screen */
function fit(){ const s = Math.min(innerWidth/1180, innerHeight/820); book.style.transform = `scale(${s})`; }
addEventListener("resize", fit); fit();

/* bookshelf + plant (CSS-drawn) */
(() => {
  const shelf = $("#shelf"); const cols = ["#f08a5d","#ffc93c","#8cc084","#7a8fd6","#e98bb0","#5fb3a1","#f4a259"];
  [0,1].forEach(r => {
    const row = document.createElement("div"); row.className = "row"; row.style.top = (r*108+10)+"px";
    for (let i=0;i<9;i++){ const b=document.createElement("span"); b.className="book";
      b.style.height=(58+((i*37+r*13)%26))+"px"; b.style.background=cols[(i+r*3)%cols.length]; row.appendChild(b); }
    const bd = document.createElement("div"); bd.className="board"; bd.style.top=(r*108+94)+"px";
    shelf.append(row, bd);
  });
  const p = document.createElement("div"); p.className="plant";
  p.innerHTML = '<span class="lf" style="left:6px;top:8px;transform:rotate(-30deg)"></span><span class="lf" style="left:48px;top:4px;transform:scaleX(-1) rotate(-30deg)"></span><span class="lf" style="left:28px;top:-10px"></span><span class="pot"></span>';
  book.insertBefore(p, $(".cushion"));
})();

/* ---------- pause (adult control): audio + script timeline + every animation ---------- */
let paused = false, userPaused = false, clipActive = false;
const heldAnims = new Set();
const au = new Audio(); au.preload = "auto";
const pauseBtn = $("#pauseBtn");
function setPaused(v){
  if (v === paused) return; paused = v;
  book.classList.toggle("paused", v);
  pauseBtn.textContent = userPaused ? "▶" : "⏸"; pauseBtn.setAttribute("aria-pressed", userPaused);
  if (v){
    au.pause();
    document.getAnimations().forEach(a => { if (a.playState === "running"){ a.pause(); heldAnims.add(a); } });
  } else {
    heldAnims.forEach(a => { try{ a.play(); }catch(e){} }); heldAnims.clear();
    if (clipActive && !au.ended && au.src) au.play().catch(()=>{});
  }
}
pauseBtn.addEventListener("click", e => { e.stopPropagation(); userPaused = !userPaused; setPaused(userPaused || document.hidden); pauseBtn.textContent = userPaused ? "▶" : "⏸"; });
document.addEventListener("visibilitychange", () => setPaused(userPaused || document.hidden));
/* pause-aware wait: only counts time while not paused */
function wait(ms){
  return new Promise(res => { let left = ms, last = performance.now();
    const tick = () => { const n = performance.now(); if (!paused) left -= n - last; last = n; left <= 0 ? res() : setTimeout(tick, Math.min(50, left)); };
    setTimeout(tick, Math.min(50, Math.max(ms,0))); });
}
const sleep = wait;

/* ---------- sentence cards = subtitles (text + pinyin only) ---------- */
const cardsEl = $("#cards");
SENT.forEach((s,i) => {
  const b = document.createElement("button"); b.className = "card"; b.style.setProperty("--c", s.color);
  b.setAttribute("aria-label", s.text);
  const ks = [...s.text].map((ch,k) => {
    const inner = s.py[k] ? `<ruby>${ch}<rt>${s.py[k]}</rt></ruby>` : ch;
    return `<span class="k">${inner}</span>` + (ch === "，" ? '<span class="br"></span>' : "");
  }).join("");
  b.innerHTML = `<span class="num">${i+1}</span><span class="txt">${ks}</span><span class="bar"><i></i></span>`;
  b.addEventListener("click", () => cardTap(i));
  cardsEl.appendChild(b);
});
const cards = [...cardsEl.children];
const K = i => ({ els:[...cards[i].querySelectorAll(".k")], bar:cards[i].querySelector(".bar i") });
function focusCard(i){ cardsEl.classList.add("reading"); cards.forEach((c,k)=>c.classList.toggle("playing", k===i)); }
function unfocus(){ cardsEl.classList.remove("reading"); cards.forEach(c=>c.classList.remove("playing")); }

/* ---------- karaoke: highlight follows the audio clock ---------- */
function karaReset(k){ k.els.forEach(e=>e.classList.remove("done","cur")); if (k.bar) k.bar.style.transform = "scaleX(0)"; }
function karaTick(k, times, dur, t){
  let cur = -1; times.forEach((x,i) => { if (x != null && x <= t) cur = i; });
  const lastT = Math.max(...times.filter(x=>x!=null));
  const end = t >= lastT + 0.35;
  k.els.forEach((e,i) => { e.classList.toggle("done", end || i < cur); e.classList.toggle("cur", !end && i === cur); });
  if (k.bar) k.bar.style.transform = `scaleX(${Math.min(1, Math.max(0, t/(lastT+0.35)))})`;
}
function karaFinish(k){ k.els.forEach(e=>{ e.classList.remove("cur"); e.classList.add("done"); }); if (k.bar) k.bar.style.transform = "scaleX(1)"; }
