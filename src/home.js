(() => {
  // The cat peeks over the book once; the scene and other decorations stay still.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const cat = document.getElementById("welcome-cat");
  let welcome = null;
  if (!reduce.matches && !document.hidden && cat.getClientRects().length) {
    welcome = cat.animate([
      { transform: "none" },
      { transform: "translateY(2px) rotate(2deg)", offset: .45 },
      { transform: "none" }
    ], { duration: 640, easing: "cubic-bezier(0.16,1,0.3,1)" });
  }
  const cancel = () => { welcome?.cancel(); welcome = null; };
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancel(); });
  addEventListener("pagehide", cancel);
  reduce.addEventListener("change", () => { if (reduce.matches) cancel(); });
  addEventListener("pageshow", () => {
    if (location.hash === "#xue-er") document.getElementById("xue-er-entry")?.focus({ preventScroll: true });
  });
})();
