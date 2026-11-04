// Page/scene adapter. Audio, cancellation tokens, active clock and pause live in app.js.
window.createChapterPlayer = (config, api) => {
  const $ = selector => document.querySelector(selector);
  const cast = $("#cast"), pageNav = $(".page-controls");
  const characters = ["elephant", "bunny", "cat", "dog"];
  const sounds = { bunny: "squeak", cat: "meow", dog: "woof" };
  const soundWords = { bunny: "吱吱～", cat: "喵～", dog: "汪汪！" };
  let pageIndex = 0, selected = 0, cueToken = 0;
  const animations = new Set(), baseStyles = new Map(), props = new Map();
  const currentPage = () => config.pages[pageIndex];
  const currentGroup = () => currentPage().groups[selected];
  api.book.classList.add("chapter-mode");
  if (!config.layouts) api.book.classList.add("chapter-legacy");
  api.book.dataset.chapter = config.id;
  api.book.dataset.preview = String(config.preview);
  api.book.dataset.playable = String(config.playable);
  api.book.dataset.rehearsal = String(config.rehearsal === true);
  api.book.dataset.publicationReady = String(config.publicationReady === true);
  characters.forEach(id => { $("#" + id).disabled = !config.playable; });
  $("#readBtn").disabled = !config.playable;
  $("#readBtn").setAttribute("aria-label", config.playable ? "从当前页开始朗读" : "配音待就绪，开发预览不可朗读");

  function remember(el, styles = {}) {
    const base = { transform: styles.transform || "", opacity: styles.opacity ?? "" };
    Object.assign(el.style, base); baseStyles.set(el, base);
    return el;
  }
  function resetScene() {
    cueToken++;
    for (const animation of animations) { api.untrack(animation); animation.cancel(); }
    animations.clear();
    for (const [el, styles] of baseStyles) Object.assign(el.style, styles);
  }
  function groupForBinding(binding) {
    if (binding.readingGroupId) return currentPage().groups.find(g => g.id === binding.readingGroupId);
    const selection = binding.readingGroupSelection;
    const id = selection.allowedReadingGroupIds.includes(currentGroup().id) ? currentGroup().id : selection.fallbackReadingGroupId;
    return currentPage().groups.find(g => g.id === id);
  }
  function updatePropNames() {
    for (const binding of currentPage().propBindings) {
      const el = props.get(binding.propId);
      if (el?.tagName === "BUTTON") el.setAttribute("aria-label", `重读，${groupForBinding(binding).text}`);
    }
  }
  function makeProp(prop) {
    const binding = currentPage().propBindings.find(b => b.propId === prop.id);
    const el = document.createElement(binding && config.playable ? "button" : "div");
    el.className = `scene-prop ${prop.layer}`; el.dataset.prop = prop.id;
    if (el.tagName === "BUTTON") {
      el.type = "button";
      el.addEventListener("click", () => {
        if (api.isFree()) tapCard(currentPage().groups.indexOf(groupForBinding(binding)));
      });
    } else { el.setAttribute("aria-hidden", "true"); }
    const motion = remember(document.createElement("span")); motion.className = "prop-motion";
    const template = config.templates[prop.templateId];
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", template.viewBox.join(" ")); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    svg.setAttribute("preserveAspectRatio", template.preserveAspectRatio || "xMidYMid meet");
    const override = currentPage().propOverrides[prop.id];
    for (const part of template.parts) {
      const group = document.createElementNS(svg.namespaceURI, "g"); group.dataset.part = part.id;
      remember(group, { ...template.baseStyles?.[part.id], ...override?.partStyles?.[part.id] });
      const shape = document.createElementNS(svg.namespaceURI, part.tag);
      for (const [name, value] of Object.entries(part.attrs)) shape.setAttribute(name, value);
      group.append(shape); svg.append(group);
    }
    motion.append(svg); el.append(motion); cast.append(el); props.set(prop.id, el);
  }
  function layout() {
    if (!config.layouts) return;
    const profileId = Object.keys(config.profiles).find(id => {
      const p = config.profiles[id]; return innerWidth >= p.minViewportWidthPx && (p.maxViewportWidthPx == null || innerWidth <= p.maxViewportWidthPx);
    }) || "compact";
    const profile = config.profiles[profileId], layout = config.layouts[profileId];
    const width = Math.min(innerWidth - 2 * profile.pageInsetPx, profile.sceneMaxWidthPx, api.book.clientWidth - 16);
    cast.style.width = `${width}px`; cast.style.height = `${profile.sceneHeightPx}px`;
    cast.dataset.profile = profileId;
    function place(el, frame, extraX = 0) {
      Object.assign(el.style, { left: `${width * frame.cx + frame.dxPx - frame.widthPx / 2 + extraX}px`, top: `${frame.topPx}px`, width: `${frame.widthPx}px`, height: `${frame.heightPx}px` });
    }
    for (const [id, slot] of Object.entries(config.scene.characterSlots)) place($("#" + id), layout.slots[slot]);
    for (const prop of config.scene.props) {
      const el = props.get(prop.id); if (!el) continue;
      const placement = prop.placement, dock = layout.propDock;
      let frame;
      if (placement.anchor === "scene") frame = placement.frames[profileId];
      else {
        const widthPx = placement.widthPx ?? dock.widthPx, heightPx = placement.heightPx ?? dock.heightPx;
        frame = { cx: dock.cx, dxPx: dock.dxPx + placement.dxPx, topPx: dock.topPx + dock.heightPx / 2 + placement.dyPx - heightPx / 2, widthPx, heightPx };
      }
      place(el, frame, currentPage().propOverrides[prop.id]?.staticOffsetXPx || 0);
    }
  }
  function render(index) {
    resetScene(); baseStyles.clear(); props.clear();
    cast.querySelectorAll(".scene-prop").forEach(el => el.remove());
    pageIndex = index; selected = currentPage().groups.findIndex(g => g.id === currentPage().defaultReadingGroupId);
    api.book.dataset.page = currentPage().pageId;
    history.replaceState({ ...history.state, lunyuPage: currentPage().pageId }, "");
    api.book.dataset.scene = config.scene.sceneId;
    api.renderCards(currentPage().groups); api.renderStars();
    $("#prevPage").disabled = pageIndex === 0;
    $("#nextPage").disabled = pageIndex === config.pages.length - 1;
    $("#prevPage").setAttribute("aria-label", `上一页，当前第${pageIndex + 1}页，共${config.pages.length}页`);
    $("#nextPage").setAttribute("aria-label", `下一页，当前第${pageIndex + 1}页，共${config.pages.length}页`);
    $("#pageNumber").textContent = `${pageIndex + 1} / ${config.pages.length}`;
    $("#pageNumber").setAttribute("aria-label", `第${pageIndex + 1}页，共${config.pages.length}页`);
    for (const id of characters) remember($("#" + id + " .act"));
    for (const prop of config.scene.props) if (currentPage().visiblePropIds.includes(prop.id)) makeProp(prop);
    updatePropNames(); layout();
  }
  function changePage(index, control) {
    if (index < 0 || index >= config.pages.length || index === pageIndex) return;
    api.stopToFree({ blink: false }); render(index); api.enterFree();
    if (control?.disabled) (control.id === "nextPage" ? $("#prevPage") : $("#nextPage")).focus({ preventScroll: true });
    pageNav.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
  $("#prevPage").addEventListener("click", event => changePage(pageIndex - 1, event.currentTarget));
  $("#nextPage").addEventListener("click", event => changePage(pageIndex + 1, event.currentTarget));
  $("#readBtn").addEventListener("click", () => {
    if (!config.playable) return;
    const my = api.interrupt(); api.unlockAudio(); api.hideTitle(); start(my);
  });
  addEventListener("resize", layout);
  document.addEventListener("visibilitychange", () => { if (document.hidden) resetScene(); });

  async function cue(id, my) {
    const cue = config.scene.cues.find(c => c.id === id); if (!cue) return;
    const token = cueToken;
    for (const step of cue.steps) {
      if (!api.isCurrent(my) || token !== cueToken) return;
      await Promise.all(step.tracks.map(async track => {
        const { propId, partId, characterId } = track.target;
        const el = characterId ? $("#" + characterId + " .act") : props.get(propId)?.querySelector(partId === "$whole" ? ".prop-motion" : `[data-part="${partId}"]`);
        if (!el) return;
        const motion = config.motions[track.motionId], last = motion.keyframes.at(-1);
        if (api.reduce.matches) { if (last.opacity != null) el.style.opacity = last.opacity; return; }
        el.style.transformOrigin = motion.transformOrigin;
        const animation = el.animate(motion.keyframes, { duration: motion.durationMs, easing: motion.easing, iterations: 1, fill: "forwards" });
        animations.add(animation); api.track(animation);
        await animation.finished.catch(() => {});
        if (token === cueToken && api.isCurrent(my)) for (const key of ["transform", "opacity"]) if (last[key] != null) el.style[key] = last[key];
        api.untrack(animation); animation.cancel(); animations.delete(animation);
      }));
    }
  }
  function select(index) { selected = index; updatePropNames(); api.focusCard(index); }
  async function readGroup(index, role, my) {
    if (!config.playable || !api.isCurrent(my)) return false;
    select(index);
    const group = currentPage().groups[index];
    if (!config.layouts && role === "elephant") api.react("elephant", api.BIG.elephant);
    for (const segment of group.segments) {
      if (!api.isCurrent(my)) return false;
      api.setStep(`${role === "children" ? "follow" : role === "elephant" ? "lead" : "solo-" + role}-${segment.id}`);
      const talker = role === "children" ? (sounds[group.responder] ? group.responder : "bunny") : role;
      const ok = await api.playClip(`${segment.id}:${role}`, { kara: api.K(index, segment.id), talkers: [talker], strict: true });
      if (!ok || !api.isCurrent(my)) return false;
    }
    api.karaFinish(api.K(index)); return true;
  }
  const delay = (ms, my) => api.wait(ms, my);
  function finish(my) { if (api.isCurrent(my)) { api.unfocus(); api.hideBubbles(); api.enterFree(); } }
  async function pair(index, my) {
    if (!await readGroup(index, "elephant", my) || !await delay(350, my)) return false;
    if (!await readGroup(index, "children", my)) return false;
    await cue(currentPage().groups[index].onReadCompleteCueId, my);
    return api.isCurrent(my);
  }
  async function solo(index, role, my) {
    if (!config.layouts) api.react(role, api.BIG[role]);
    if (!await delay(api.reduce.matches ? 200 : 900, my)) return false;
    if (!await readGroup(index, role, my) || !await delay(220, my)) return false;
    if (sounds[role]) {
      api.soundBubble(role, soundWords[role]);
      const ok = await api.playClip(sounds[role], { talkers: role === "dog" ? [role] : [], strict: true });
      if (!ok || !api.isCurrent(my)) return false;
      api.hideBubbles();
    }
    return delay(250, my);
  }
  async function tapCard(index) {
    if (!config.playable) return;
    const my = api.interrupt(); api.unlockAudio();
    if (await pair(index, my)) api.fillStar(index);
    finish(my);
  }
  async function tapCharacter(id) {
    if (!config.playable) return;
    const my = api.interrupt(); api.unlockAudio();
    if (id === "elephant") {
      for (let i = 0; i < currentPage().groups.length; i++) {
        if (!await readGroup(i, "elephant", my) || !await delay(450, my)) { finish(my); return; }
      }
    } else {
      const override = currentPage().characterReadingGroupOverrides?.[id]?.[0];
      const index = override ? currentPage().groups.findIndex(g => g.id === override) : selected;
      if (await solo(index, id, my) && api.isCurrent(my)) api.fillStar(index);
    }
    finish(my);
  }
  async function start(my) {
    if (!config.playable) return;
    api.setAutomatic();
    while (api.isCurrent(my)) {
      for (let i = 0; i < currentPage().groups.length; i++) {
        if (!await pair(i, my) || !await delay(650, my)) { finish(my); return; }
      }
      api.unfocus(); api.setStep("again"); api.soundBubble("elephant", "我们再来一遍吧");
      if (!await api.playClip("again", { talkers: ["elephant"], strict: true }) || !api.isCurrent(my)) { finish(my); return; }
      api.hideBubbles();
      if (!await delay(500, my)) return;
      for (let i = 0; i < currentPage().groups.length; i++) {
        if (!await solo(i, currentPage().groups[i].audio.soloRole, my)) { finish(my); return; }
        api.fillStar(i);
      }
      if (pageIndex === config.pages.length - 1) break;
      render(pageIndex + 1); pageNav.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
    finish(my);
  }
  return { render, start, tapCard, tapCharacter, resetScene, changePage,
    get pageIndex() { return pageIndex; }, get responder() { return currentGroup().responder; },
    get sceneAnimations() { return animations.size; }, get pageCount() { return config.pages.length; },
  };
};
