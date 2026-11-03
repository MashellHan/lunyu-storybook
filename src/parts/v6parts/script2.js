
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
</script>
</body>
</html>
