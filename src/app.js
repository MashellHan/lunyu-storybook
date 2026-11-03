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

/* ---------- motion helpers (WAAPI; reduced-motion = opacity/glow only) ---------- */
const actOf = id => $("#"+id+" .act");
const shadowOf = id => $("#"+id+" .shadow");
/* one declared big "character moment" per animal (see header note on the deliberate deviation) */
const BIG = { elephant:"trumpet", bunny:"bigHop", cat:"spin", dog:"flip" };
function moves(kind){
  const L = "linear", UP = "cubic-bezier(0.2,0.7,0.3,1)", DOWN = "cubic-bezier(0.6,0,0.85,0.4)", OUT = EASE_OUT;
  const K = {
    bob:   {o:"50% 100%", d:700, e:OUT, k:[{transform:"translateY(0)"},{transform:"translateY(-10px) rotate(-1deg)",offset:.35},{transform:"translateY(0)",offset:.7},{transform:"translateY(-4px)",offset:.85},{transform:"translateY(0)"}]},
    nod:   {o:"50% 100%", d:760, e:"cubic-bezier(0.65,0,0.35,1)", k:[{transform:"rotate(0)"},{transform:"rotate(3deg) translateY(4px)",offset:.3},{transform:"rotate(-1deg)",offset:.6},{transform:"rotate(2deg) translateY(2px)",offset:.8},{transform:"rotate(0)"}]},
    bounce:{o:"50% 100%", d:560, e:OUT, k:[{transform:"translateY(0) scale(1,1)"},{transform:"translateY(-26px) scale(.97,1.04)",offset:.4},{transform:"translateY(0) scale(1.06,.94)",offset:.72},{transform:"translateY(0) scale(1,1)"}]},
    /* dog: crouch -> launch -> full 360° back-flip in the air -> squash landing -> settle */
    flip:  {o:"50% 58%", d:1250, e:L, k:[
      {transform:"translateY(0) rotate(0) scale(1,1)", easing:"cubic-bezier(0.65,0,0.35,1)"},
      {transform:"translateY(14px) rotate(0) scale(1.14,.8)", offset:.14, easing:UP},
      {transform:"translateY(-150px) rotate(-90deg) scale(.94,1.08)", offset:.32, easing:L},
      {transform:"translateY(-215px) rotate(-190deg) scale(1,1)", offset:.47, easing:L},
      {transform:"translateY(-150px) rotate(-290deg) scale(1,1)", offset:.62, easing:DOWN},
      {transform:"translateY(16px) rotate(-360deg) scale(1.18,.78)", offset:.76, easing:OUT},
      {transform:"translateY(-22px) rotate(-360deg) scale(.95,1.06)", offset:.88, easing:"cubic-bezier(0.65,0,0.35,1)"},
      {transform:"translateY(0) rotate(-360deg) scale(1,1)"}]},
    /* bunny: deep crouch -> big hop with a little twist -> squash -> small rebound */
    bigHop:{o:"50% 100%", d:1100, e:L, k:[
      {transform:"translateY(0) scale(1,1) rotate(0)", easing:"cubic-bezier(0.65,0,0.35,1)"},
      {transform:"translateY(0) scale(1.16,.8) rotate(0)", offset:.16, easing:UP},
      {transform:"translateY(-170px) scale(.9,1.12) rotate(-8deg)", offset:.42, easing:DOWN},
      {transform:"translateY(0) scale(1.18,.8) rotate(4deg)", offset:.66, easing:OUT},
      {transform:"translateY(-48px) scale(.96,1.05) rotate(-2deg)", offset:.82, easing:DOWN},
      {transform:"translateY(0) scale(1.06,.94) rotate(0)", offset:.93, easing:OUT},
      {transform:"translateY(0) scale(1,1) rotate(0)"}]},
    /* cat: stretch-crouch (pounce wind-up) -> leap with a full pirouette -> land */
    spin:  {o:"50% 100%", d:1150, e:L, k:[
      {transform:"perspective(700px) translate(0,0) rotateY(0) scale(1,1) skewX(0)", easing:"cubic-bezier(0.65,0,0.35,1)"},
      {transform:"perspective(700px) translate(-10px,6px) rotateY(0) scale(1.18,.8) skewX(-10deg)", offset:.2, easing:UP},
      {transform:"perspective(700px) translate(0,-130px) rotateY(180deg) scale(.95,1.08) skewX(0)", offset:.48, easing:DOWN},
      {transform:"perspective(700px) translate(0,0) rotateY(360deg) scale(1.14,.84) skewX(0)", offset:.74, easing:OUT},
      {transform:"perspective(700px) translate(0,-16px) rotateY(360deg) scale(.97,1.04) skewX(0)", offset:.87, easing:"cubic-bezier(0.65,0,0.35,1)"},
      {transform:"perspective(700px) translate(0,0) rotateY(360deg) scale(1,1) skewX(0)"}]},
    /* elephant: rise + lean back (trunk up) -> big happy sway ×2 -> settle */
    trumpet:{o:"50% 100%", d:1300, e:L, k:[
      {transform:"translateY(0) rotate(0) scale(1)", easing:"cubic-bezier(0.65,0,0.35,1)"},
      {transform:"translateY(-34px) rotate(-8deg) scale(1.07)", offset:.25, easing:"cubic-bezier(0.65,0,0.35,1)"},
      {transform:"translateY(-20px) rotate(6deg) scale(1.05)", offset:.48, easing:"cubic-bezier(0.65,0,0.35,1)"},
      {transform:"translateY(-26px) rotate(-5deg) scale(1.05)", offset:.68, easing:"cubic-bezier(0.65,0,0.35,1)"},
      {transform:"translateY(0) rotate(2deg) scale(1)", offset:.86, easing:OUT},
      {transform:"translateY(0) rotate(0) scale(1)"}]},
  };
  return K[kind];
}
/* secondary layers that follow a big move */
function secondary(id, kind, dur){
  const out = [];
  const sh = shadowOf(id);
  const shK = { flip:[[0,1,1],[.14,1.1,1],[.47,.45,.35],[.76,1.15,1],[1,1,1]],
                bigHop:[[0,1,1],[.16,1.1,1],[.42,.5,.4],[.66,1.12,1],[.82,.85,.8],[1,1,1]],
                spin:[[0,1,1],[.2,1.12,1],[.48,.6,.5],[.74,1.1,1],[1,1,1]],
                trumpet:[[0,1,1],[.25,.9,.8],[.86,1,1],[1,1,1]] }[kind];
  if (shK) out.push(sh.animate(shK.map(([o,s,a])=>({offset:o,transform:`scale(${s})`,opacity:a})), {duration:dur, easing:"linear"}));
  if (id==="dog"){
    out.push($("#dog .tail").animate([{transform:"rotate(0)"},{transform:"rotate(-24deg)",offset:.3},{transform:"rotate(18deg)",offset:.6},{transform:"rotate(-16deg)",offset:.8},{transform:"rotate(0)"}],{duration:dur,easing:"linear",composite:"add"}));
    out.push($("#dog .head").animate([{transform:"rotate(0)"},{transform:"rotate(0)",offset:.72},{transform:"rotate(-6deg) translateY(6px)",offset:.8},{transform:"rotate(4deg)",offset:.9},{transform:"rotate(0)"}],{duration:dur,easing:"cubic-bezier(0.65,0,0.35,1)"}));
  }
  if (id==="bunny"){   /* ear lags behind the body: up on launch, floppy on landing */
    out.push($("#bunny .ear").animate([{transform:"rotate(0)"},{transform:"rotate(0)",offset:.16},{transform:"rotate(-8deg)",offset:.3},{transform:"rotate(10deg)",offset:.5},
      {transform:"rotate(17deg)",offset:.7},{transform:"rotate(-5deg)",offset:.84},{transform:"rotate(4deg)",offset:.93},{transform:"rotate(0)"}],{duration:dur,easing:"linear"}));
  }
  return out;
}
let live = {};   // id -> running animations (so a new tap cancels the old move)
function react(id, kind){
  const el = actOf(id);
  (live[id]||[]).forEach(a => a.cancel());
  if (reduce.matches){
    const a = el.animate([{opacity:1},{opacity:.6},{opacity:1}], {duration:360, easing:"linear"});
    live[id] = [a]; return a.finished.catch(()=>{});
  }
  const m = moves(kind);
  el.style.transformOrigin = m.o;
  const a = el.animate(m.k, {duration:m.d, easing:m.e});
  live[id] = [a, ...secondary(id, kind, m.d)];
  if (kind==="trumpet") notes(id);
  return a.finished.catch(()=>{});
}
/* elephant's "trumpet": a few ♪ float up from the trunk tip */
function notes(id){
  const host = $("#"+id), r = host.getBoundingClientRect(), br = book.getBoundingClientRect(), sc = br.width/1180;
  const x0 = (r.left - br.left + r.width*.76)/sc, y0 = (r.top - br.top + r.height*.38)/sc;
  for (let i=0;i<4;i++){
    const s = document.createElement("span"); s.className = "spark"; s.textContent = i%2 ? "♫" : "♪"; s.style.color = "#7a8fd6"; s.style.textShadow="none"; s.style.fontSize = (30+i*4)+"px";
    book.appendChild(s);
    const dx = 30 + i*26, dy = -110 - i*30;
    const a = s.animate([{transform:`translate(${x0}px,${y0}px) scale(.4)`,opacity:0},{opacity:1,offset:.2},
      {transform:`translate(${x0+dx}px,${y0+dy}px) scale(1) rotate(${i%2?12:-12}deg)`,opacity:0}],{duration:1200,easing:EASE_OUT,delay:150+i*140,fill:"backwards"});
    a.finished.then(()=>s.remove()).catch(()=>s.remove());
  }
}
/* dog mouth: flaps while speaking; reduced motion = simply shown open */
const mouth = $("#dogMouth"); let mouthAnim = null;
function talk(on){
  if (mouthAnim){ mouthAnim.cancel(); mouthAnim = null; }
  if (!on){ mouth.style.opacity = 0; mouth.style.transform = "scaleY(0)"; return; }
  if (reduce.matches){ mouth.style.opacity = 1; mouth.style.transform = "scaleY(.8)"; return; }
  mouth.style.opacity = 1;
  mouthAnim = mouth.animate([{transform:"scaleY(.12)"},{transform:"scaleY(1)",offset:.35},{transform:"scaleY(.35)",offset:.6},{transform:"scaleY(.85)",offset:.8},{transform:"scaleY(.12)"}],
    {duration:420, iterations:Infinity, easing:"cubic-bezier(0.65,0,0.35,1)"});
}
/* dog real blink (eyelids slide down and up) */
function dogBlink(double){
  if (reduce.matches) return;
  const run = () => document.querySelectorAll("#dog .lid").forEach(l => {
    const p = l; p.classList.add("shut"); setTimeout(()=>p.classList.remove("shut"), 110);
  });
  run(); if (double) setTimeout(run, 260);
}
function sparkle(id, n=7, big=false){
  const host = $("#"+id), r = host.getBoundingClientRect(), br = book.getBoundingClientRect(), sc = br.width/1180;
  const cx = (r.left - br.left + r.width/2)/sc, cy = (r.top - br.top + r.height*.35)/sc;
  for (let i=0;i<n;i++){
    const s = document.createElement("span"); s.className = "spark"; s.textContent = i%3 ? "✦" : "★";
    if (big) s.style.fontSize = (28+Math.random()*22)+"px";
    book.appendChild(s);
    const ang = (i/n)*Math.PI*2 + Math.random()*.5, dist = (big?160:90) + Math.random()*40;
    const x = cx + Math.cos(ang)*dist, y = cy + Math.sin(ang)*dist*.8;
    const a = reduce.matches
      ? s.animate([{transform:`translate(${x}px,${y}px)`,opacity:0},{transform:`translate(${x}px,${y}px)`,opacity:1,offset:.3},{transform:`translate(${x}px,${y}px)`,opacity:0}],{duration:700,fill:"both"})
      : s.animate([{transform:`translate(${cx}px,${cy}px) scale(.3)`,opacity:0},{opacity:1,offset:.25},{transform:`translate(${x}px,${y}px) scale(1) rotate(90deg)`,opacity:0}],{duration:big?1100:720,easing:EASE_OUT,delay:i*25,fill:"backwards"});
    a.finished.then(()=>s.remove()).catch(()=>s.remove());
  }
}

function bubbleOf(id){ return $("#"+id+" .aBubble"); }
function hideBubbles(){ document.querySelectorAll(".aBubble.show").forEach(b=>b.classList.remove("show")); }

/* ---------- talking: gentle bob on the character layer (+ dog mouth) ---------- */
const talkAnims = {};
function talkStart(ids){
  ids.forEach(id => {
    $("#"+id).classList.add("busy");
    if (id === "dog") talk(true);
    if (reduce.matches || talkAnims[id]) return;
    const el = $("#"+id+" .act > *");
    const big = id === "elephant";
    talkAnims[id] = el.animate([{transform:"translateY(0) rotate(0)"},{transform:`translateY(${big?-4:-6}px) rotate(${big?-1.2:-2.5}deg)`,offset:.3},
      {transform:`translateY(0) rotate(${big?1:2}deg)`,offset:.65},{transform:"translateY(0) rotate(0)"}],
      {duration: big ? 1100 : 600 + KIDS.indexOf(id)*40, iterations:Infinity, easing:"cubic-bezier(0.65,0,0.35,1)"});
  });
}
function talkStop(ids){
  ids.forEach(id => { $("#"+id).classList.remove("busy"); if (id === "dog") talk(false);
    if (talkAnims[id]){ talkAnims[id].cancel(); delete talkAnims[id]; } });
}

/* ---------- audio clips (pre-rendered, embedded) ---------- */
let clipToken = 0, curFin = null;
function playClip(key, { kara = null, talkers = [], strict = false } = {}){
  const my = ++clipToken; const T = TIM[key];
  window.__log.push({ key, t: Date.now() });
  return new Promise(res => {
    let done = false, fallback = false, fbT = 0, wall = 0, last = performance.now(), raf = 0;
    const fin = (ok = true) => { if (done) return; done = true; clipActive = false; cancelAnimationFrame(raf);
      if (curFin === fin) curFin = null; talkStop(talkers); if (kara) (ok ? karaFinish(kara) : karaReset(kara)); res(ok); };
    curFin = fin;
    if (kara) karaReset(kara);
    talkStart(talkers);
    const loop = () => {
      if (my !== clipToken || done) return;
      const n = performance.now(); const dt = (n - last)/1000; last = n;
      if (!paused){ wall += dt; if (fallback) fbT += dt; }
      const t = fallback ? fbT : au.currentTime;
      if (kara) karaTick(kara, T.t, T.dur, t);
      if ((fallback && fbT >= T.dur) || wall > T.dur + 2.5){ fin(); return; }   // never hang the script
      raf = requestAnimationFrame(loop);
    };
    au.onended = () => { if (my === clipToken) fin(); };
    au.src = AUD[key]; clipActive = true;
    const p = au.play();
    if (p) p.catch(() => { if (my !== clipToken) return; if (strict){ fin(false); return; } fallback = true; });
    raf = requestAnimationFrame(loop);
  });
}
function stopAudio(){ clipToken++; au.pause(); if (curFin) curFin(false); }

/* ---------- motion bits ---------- */
function groupBounce(){ KIDS.forEach((id,k) => setTimeout(() => react(id, "bounce"), k*90)); }
function soundBubble(id, txt){ const b = bubbleOf(id); b.textContent = txt; b.classList.add("show"); }

/* ---------- title screen ---------- */
const titleEl = $("#title"), ttSub = $("#ttSub"), ttMain = $("#ttMain"), startBtn = $("#startBtn");
const ttText = TIM.title.text;                     // "论语 之 学而时习之"
const ttEls = [...ttText].map((ch, i) => { const s = document.createElement("span"); s.className = "t"; s.textContent = ch === " " ? "" : ch;
  (i < 4 ? ttSub : ttMain).appendChild(s); if (ch === " ") s.style.width = "0"; return s; });
const ttK = { els: ttEls, bar: null };
let titleState = "idle", titleDone = null;
function titleIntro(){
  const shown = ttEls.filter(e => e.textContent);
  shown.forEach((e,i) => {
    const kf = reduce.matches
      ? [{opacity:0},{opacity:1}]
      : [{opacity:0, transform:"translateY(-120px) scale(.5) rotate(-12deg)"},{opacity:1, transform:"translateY(14px) scale(1.12,.88) rotate(3deg)", offset:.6},
         {transform:"translateY(-8px) scale(.97,1.04)", offset:.8},{opacity:1, transform:"none"}];
    e.animate(kf, { duration: reduce.matches ? 300 : 760, delay: 150 + i*110, easing: reduce.matches ? "linear" : EASE_OUT, fill:"both" });
  });
  const d = 150 + shown.length*110 + 400;
  startBtn.animate(reduce.matches ? [{opacity:0},{opacity:1}] : [{opacity:0, transform:"scale(.4)"},{opacity:1, transform:"scale(1.08)", offset:.65},{opacity:1, transform:"scale(1)"}],
    { duration: reduce.matches ? 250 : 620, delay: d, easing: EASE_OUT, fill:"both" });
  return d;
}
function playTitle(strict){
  titleState = "playing"; setStep("title-voice");
  titleDone = playClip("title", { kara: ttK, talkers: [], strict }).then(ok => { titleState = ok ? "done" : "blocked"; if (!ok) setStep("title"); return ok; });
  return titleDone;
}
setStep("title");
const introMs = titleIntro();
/* try the title voice on load; browsers usually block sound before the first tap -> it plays on the first tap instead */
setTimeout(() => { if (titleState === "idle") playTitle(true); }, introMs);
titleEl.addEventListener("click", e => { if (e.target.closest("#startBtn")) return; if (titleState === "blocked" || titleState === "idle") playTitle(false); });
startBtn.addEventListener("click", async e => {
  e.stopPropagation();
  if (startBtn.disabled) return; startBtn.disabled = true;
  if (titleState === "blocked" || titleState === "idle") playTitle(false);   // called inside the tap = audio unlocked
  else if (titleState === "done"){ au.muted = true; au.src = AUD.title; au.play().then(()=>{ au.pause(); au.muted = false; }).catch(()=>{ au.muted = false; }); }
  await titleDone; await wait(300);
  const out = titleEl.animate(reduce.matches ? [{opacity:1},{opacity:0}] : [{opacity:1, transform:"scale(1)"},{opacity:0, transform:"scale(1.06)"}],
    { duration: reduce.matches ? 200 : 420, easing: "cubic-bezier(0.7,0,0.84,0)", fill:"forwards" });
  await out.finished.catch(()=>{}); titleEl.classList.add("gone"); titleEl.style.display = "none";
  show();
});

/* ---------- the script ---------- */
let runId = 0, free = false;
const heard = new Set();
function fillStar(i){
  if (heard.has(i)) return; heard.add(i);
  const st = document.querySelectorAll(".star")[i]; st.classList.add("on"); $("#stars").setAttribute("aria-label", `${heard.size} / 3`);
  if (!reduce.matches) st.animate([{transform:"scale(1)"},{transform:"scale(1.25)",offset:.45},{transform:"scale(1)"}],{duration:420,easing:EASE_OUT});
}
async function elephantLine(i, my){
  focusCard(i); setStep(`e${i+1}`); react("elephant","trumpet");
  await playClip(SENT[i].e, { kara:K(i), talkers:["elephant"] });
  return my === runId;
}
async function unisonLine(i, my){
  focusCard(i); setStep(`u${i+1}`); groupBounce(); sparkle("cat", 6);
  await wait(reduce.matches ? 100 : 380); if (my !== runId) return false;
  await playClip(SENT[i].u, { kara:K(i), talkers:KIDS });
  return my === runId;
}
async function solo(id, my){
  const S = SOLO[id];
  focusCard(S.s); setStep(`solo-${id}`);
  react(id, BIG[id]); sparkle(id, 6);
  await wait(reduce.matches ? 200 : 900); if (my !== runId) return false;
  await playClip(S.clip, { kara:K(S.s), talkers:[id] }); if (my !== runId) return false;
  await wait(220); if (my !== runId) return false;
  setStep(`sound-${id}`); soundBubble(id, S.word); react(id, "bounce"); if (id === "dog") dogBlink(true);
  await playClip(S.sound, { talkers: id === "dog" ? ["dog"] : [] });
  hideBubbles(); if (my !== runId) return false;
  await wait(250);
  return my === runId;
}
/* the elephant's real trumpet call (short, quiet) with the big trumpet move */
async function trumpet(my){
  setStep("trumpet"); react("elephant", "trumpet"); sparkle("elephant", 6);
  await playClip("trumpet", { talkers: [] });
  return my === runId;
}
async function show(){
  const my = ++runId; setStep("intro");
  ["elephant", ...KIDS].forEach((id,k) => setTimeout(() => react(id, "bounce"), k*120));
  await wait(900); if (my !== runId) return;
  if (!await trumpet(my)) return;
  await wait(300); if (my !== runId) return;
  for (let i = 0; i < 3; i++){
    if (!await elephantLine(i, my)) return;
    await wait(350); if (my !== runId) return;
    if (!await unisonLine(i, my)) return;
    await wait(650); if (my !== runId) return;
  }
  unfocus(); setStep("again");
  react("elephant", "nod"); soundBubble("elephant", "我们再来一遍吧");
  await playClip("again", { talkers:["elephant"] }); hideBubbles();
  if (my !== runId) return;
  await wait(500);
  for (const id of KIDS){ if (!await solo(id, my)) return; fillStar(SOLO[id].s); }
  unfocus(); setStep("celebrate");
  ["elephant", ...KIDS].forEach((id,k) => setTimeout(() => { react(id, BIG[id]); sparkle(id, 9, true); }, k*260));
  playClip("trumpet", { talkers: [] });
  await wait(2100); if (my !== runId) return;
  enterFree();
}
function enterFree(){ free = true; book.classList.add("free"); setStep("free"); }

/* ---------- free play: tap a character (or a card) ---------- */
function interrupt(){ if (userPaused){ userPaused = false; setPaused(document.hidden); pauseBtn.textContent = "⏸"; }
  const my = ++runId; stopAudio(); hideBubbles(); unfocus(); return my; }
["elephant", ...KIDS].forEach(id => $("#"+id).addEventListener("click", async () => {
  if (!free){ if (!reduce.matches && !$("#"+id).classList.contains("busy")) $("#"+id+" .act").animate([{transform:"rotate(0)"},{transform:"rotate(-3deg)",offset:.3},{transform:"rotate(2deg)",offset:.7},{transform:"rotate(0)"}],{duration:360,easing:"cubic-bezier(0.65,0,0.35,1)"}); return; }
  const my = interrupt();
  if (id === "elephant"){
    if (!await trumpet(my)) return; await wait(300); if (my !== runId) return;
    for (let i = 0; i < 3; i++){ if (!await elephantLine(i, my)) return; await wait(450); if (my !== runId) return; }
    unfocus(); setStep("free");
  } else {
    if (await solo(id, my)){ unfocus(); setStep("free"); }
  }
}));
async function cardTap(i){
  if (!free) return;
  const my = interrupt();
  if (!await elephantLine(i, my)) return; await wait(350); if (my !== runId) return;
  if (!await unisonLine(i, my)) return; unfocus(); setStep("free");
}

/* occasional blink */
(function scheduleBlink(){
  setTimeout(() => {
    if (!reduce.matches && !paused){
      const id = ["elephant","bunny","cat","dog","dog"][Math.floor(Math.random()*5)];
      if (id === "dog") dogBlink(Math.random() < .3);
      else if (!$("#"+id).classList.contains("busy")) $("#"+id+" .blink").animate([{transform:"scale(1,1)"},{transform:"scale(1.03,.94)",offset:.4},{transform:"scale(1,1)"}],{duration:220,easing:"cubic-bezier(0.65,0,0.35,1)"});
    }
    scheduleBlink();
  }, 2600 + Math.random()*3800);
})();

/* test hooks (screenshots only) */
window.__demo = {
  seek(id, kind, ms){ react(id, kind); (live[id]||[]).forEach(a => { a.pause(); a.currentTime = ms; }); },
  talk, dogBlink, react, enterFree,
  lids(shut){ document.querySelectorAll("#dog .lid").forEach(l=>l.classList.toggle("shut", shut)); },
  mouth(v){ talk(false); mouth.style.opacity = v>0 ? 1 : 0; mouth.style.transform = `scaleY(${v})`; },
  audio: au, get paused(){ return paused; },
};
})();
