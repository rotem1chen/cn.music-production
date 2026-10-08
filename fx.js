/* CN Production — the "liquid" layer for the home page.
   - ambient light: the film / concert you're on tints the whole page (like Apple Music)
   - liquid-glass nav: a glass droplet slides between sections and stretches with its speed
   - reel depth: films tilt back as they leave the centre; the one under the mouse leans in with a glare
   - reveals: sections rise out of a blur as they arrive
   app.js tells us which film is active through the "cn:active" event. */
(function () {
  "use strict";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;   // phones: keep scrolling light
  const root = document.documentElement;

  /* ---------- real refraction where the browser can do it (Chromium: backdrop-filter: url()) ----------
     Each glass element gets its own lens, built at its exact pixel size: a thin rim on every side bends
     the light inward (it samples from inside the glass, never from outside it), the middle stays clear.
     A ResizeObserver rebuilds the lens when the element changes size (the HUD does on every film). */
  const isChromium = !!(navigator.userAgentData && navigator.userAgentData.brands &&
    navigator.userAgentData.brands.some((b) => /Chromium/.test(b.brand)));
  const noGlass = window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
  const GLASS = ".nav, .hud, .skip-stills, .reel-more, .plight-close, .plight-nav, .viewer-close, .pin-pad button:not(.pin-del), .pin-boxes span, " +
    ".lm-card, .lm-go, .pool-btn:not(.primary), .file, .rv-controls, .rv-form, .rv-note, .rv-bigplay, .vload-box";
  let lensSvg = null, lensN = 0;
  function lensFor(el) {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (w < 4 || h < 4) return;
    if (el._lens && el._lens.w === w && el._lens.h === h) return;
    const rim = Math.max(4, Math.min(14, Math.min(w, h) * 0.28));       // px of bending at each edge
    const fx = rim / w, fy = rim / h;
    const map = "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<defs><linearGradient id="x"><stop offset="0" stop-color="#f00"/><stop offset="${fx}" stop-color="#800000"/>` +
      `<stop offset="${1 - fx}" stop-color="#800000"/><stop offset="1" stop-color="#000"/></linearGradient>` +
      `<linearGradient id="y" x2="0" y2="1"><stop offset="0" stop-color="#0f0"/><stop offset="${fy}" stop-color="#008000"/>` +
      `<stop offset="${1 - fy}" stop-color="#008000"/><stop offset="1" stop-color="#000"/></linearGradient></defs>` +
      `<rect width="${w}" height="${h}" fill="url(#x)"/><rect width="${w}" height="${h}" fill="url(#y)" style="mix-blend-mode:screen"/></svg>`);
    const id = el._lens ? el._lens.id : "lg-" + (++lensN);
    let f = lensSvg.querySelector("#" + id);
    if (!f) { f = document.createElementNS("http://www.w3.org/2000/svg", "filter"); f.id = id; lensSvg.appendChild(f); }
    ["filterUnits", "primitiveUnits"].forEach((a) => f.setAttribute(a, "userSpaceOnUse"));
    f.setAttribute("x", 0); f.setAttribute("y", 0); f.setAttribute("width", w); f.setAttribute("height", h);
    f.setAttribute("color-interpolation-filters", "sRGB");
    f.innerHTML =
      `<feImage href="${map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/>` +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/>' +
      `<feDisplacementMap in="b" in2="m" scale="${(rim * 1.6).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
      '<feColorMatrix in="d" type="saturate" values="1.8"/>';
    el._lens = { id, w, h };
    el.style.backdropFilter = el.style.webkitBackdropFilter = `url(#${id})`;
  }
  if (isChromium && !noGlass && !touch) {               // phones get frosted glass: the lens per frame is too heavy while scrolling
    lensSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    lensSvg.setAttribute("aria-hidden", "true");
    lensSvg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    document.body.appendChild(lensSvg);
    const ro = new ResizeObserver((ents) => ents.forEach((en) => lensFor(en.target)));
    const arm = () => document.querySelectorAll(GLASS).forEach((el) => { if (!el._lensArmed) { el._lensArmed = true; ro.observe(el); } });
    arm();
    new MutationObserver(arm).observe(document.body, { childList: true, subtree: true });   // reel paging adds a new pill
  }

  /* ---------- spring (damping ratio + response, Apple-style) ---------- */
  function Spring(v) { this.x = v; this.v = 0; this.t = v; this.k = 0; this.c = 0; this.cfg(1, 0.35); }
  Spring.prototype.cfg = function (d, r) { this.k = Math.pow(2 * Math.PI / r, 2); this.c = 4 * Math.PI * d / r; };
  Spring.prototype.tick = function (dt) {
    for (let t = 0; t < dt; t += 1 / 240) { this.v += (-this.k * (this.x - this.t) - this.c * this.v) / 240; this.x += this.v / 240; }
  };
  Spring.prototype.rest = function () { return Math.abs(this.x - this.t) < 0.2 && Math.abs(this.v) < 1; };

  /* ---------- ambient light ---------- */
  const amb = document.createElement("div");
  amb.className = "ambient"; amb.setAttribute("aria-hidden", "true");
  amb.innerHTML = "<i></i><i></i>";
  document.body.prepend(amb);
  const layers = amb.querySelectorAll("i");
  let front = 0, lastBg = "";
  function ambient(bg) {
    if (!bg || bg === lastBg) return;
    lastBg = bg;
    front = 1 - front;
    layers[front].style.background = bg;
    layers[front].classList.add("on");
    layers[1 - front].classList.remove("on");
  }
  document.addEventListener("cn:active", (e) => onActive(e.detail && e.detail.el));
  const hud = document.getElementById("hud");
  function onActive(el) {
    if (!el) return;
    if (hud && !reduced) { hud.classList.remove("pulse"); void hud.offsetWidth; hud.classList.add("pulse"); }
    if (el.classList.contains("link-tile")) { ambient("radial-gradient(60% 50% at 50% 50%, #ffd400, #000 75%)"); return; }
    const p = el.querySelector(".poster");
    const img = p && p.style.backgroundImage;
    if (img && img !== "none") ambient(img + " center / cover no-repeat");
    else if (el.querySelector(".poster") && (el._ambTry = (el._ambTry || 0) + 1) < 10) setTimeout(() => onActive(el), 400);   // poster still loading
  }
  // stills: the concert you're looking at takes over the light
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      const im = en.target.matches(".still-card") ? en.target.querySelector("img") : en.target.querySelector(".shot img");
      if (im && im.src) ambient(`url("${im.src}") center / cover no-repeat`);
    });
  }, { rootMargin: "-45% 0px -45% 0px" });
  const BRAND_LIGHT = "radial-gradient(38% 42% at 28% 30%, rgba(255,212,0,.6), transparent 70%), " +
    "radial-gradient(42% 48% at 76% 68%, rgba(255,110,20,.5), transparent 70%), " +
    "radial-gradient(36% 40% at 18% 86%, rgba(110,60,255,.42), transparent 70%), #000";
  const toolPage = document.body.classList.contains("pool-page");
  function lightTools() {
    if (!toolPage) return;
    ambient(BRAND_LIGHT);
    const use = (im) => { if (im && im.src && im.naturalWidth) ambient(`url("${im.currentSrc || im.src}") center / cover no-repeat`); };
    // delivery: the first photo / video thumbnail that loads, then whatever you point at
    const pool = document.getElementById("pool") || document.querySelector(".pool");
    if (pool) {
      let lit = false;
      pool.addEventListener("load", (e) => { if (!lit && e.target.tagName === "IMG" && e.target.closest(".shot, .vid")) { lit = true; use(e.target); } }, true);
      pool.addEventListener("pointerover", (e) => { const t = e.target.closest && e.target.closest(".shot, .vid"); if (t) use(t.querySelector("img")); });
    }
    // cut review: the video's own poster
    const poster = document.getElementById("rvPoster");
    if (poster) poster.addEventListener("load", () => use(poster));
  }
  function watchConcerts() {
    document.querySelectorAll(".concert, .still-card").forEach((c) => io.observe(c));
    // the cover you point at lights the page
    const covers = document.getElementById("concerts");
    if (covers) covers.addEventListener("pointerover", (e) => {
      const im = e.target.closest && e.target.closest(".still-card") && e.target.closest(".still-card").querySelector("img");
      if (im) ambient(`url("${im.src}") center / cover no-repeat`);
    });
    // a gallery page: its own photos light the page, and the light follows the one you point at
    const grid = document.getElementById("showGrid");
    if (grid) {
      const first = grid.querySelector(".shot img");
      if (first) ambient(`url("${first.src}") center / cover no-repeat`);
      grid.addEventListener("pointerover", (e) => {
        const im = e.target.closest(".shot") && e.target.closest(".shot").querySelector("img");
        if (im) ambient(`url("${im.src}") center / cover no-repeat`);
      });
    }
  }

  /* ---------- liquid-glass nav ---------- */
  const nav = document.querySelector(".nav");
  const links = nav ? Array.from(nav.querySelectorAll("a")) : [];
  let blob = null;
  const bx = new Spring(0), bw = new Spring(0);
  const onHome = !!document.getElementById("work");
  let activeLink = onHome ? links[0] || null : null, hoverLink = null, navRaf = null, navLast = 0;
  if (nav && links.length) {
    blob = document.createElement("span"); blob.className = "nav-blob"; blob.setAttribute("aria-hidden", "true");
    nav.prepend(blob);
    links.forEach((a) => {
      a.addEventListener("pointerenter", () => { hoverLink = a; aimBlob(); });
      a.addEventListener("pointerleave", () => { hoverLink = null; aimBlob(); });
    });
  }
  function aimBlob(jump) {
    if (!blob) return;
    const a = hoverLink || activeLink;
    blob.style.opacity = a ? "" : "0";              // sub-pages: the droplet only appears under the pointer
    if (!a) return;
    const nr = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
    bx.t = r.left - nr.left; bw.t = r.width;
    links.forEach((l) => l.classList.toggle("on", l === activeLink));
    if (jump || reduced) { bx.x = bx.t; bw.x = bw.t; bx.v = bw.v = 0; drawBlob(); return; }
    if (!navRaf) { navLast = performance.now(); navRaf = requestAnimationFrame(navLoop); }
  }
  function drawBlob() {
    // stretch along the direction of travel, squeeze across it — a droplet, not a box
    const s = Math.min(0.45, Math.abs(bx.v) / 2600);
    blob.style.width = bw.x + "px";
    blob.style.transform = `translateX(${bx.x}px) scale(${1 + s}, ${1 - s * 0.55})`;
  }
  function navLoop(now) {
    const dt = Math.min(0.05, (now - navLast) / 1000); navLast = now;
    bx.tick(dt); bw.tick(dt); drawBlob();
    if (bx.rest() && bw.rest()) { navRaf = null; return; }
    navRaf = requestAnimationFrame(navLoop);
  }
  // scrollspy: which section is the light on
  const spy = [["#top", null], ["#stills", "stills"], ["#artists", "artists"], ["#contact", "contact"]];
  function spySection() {
    if (!onHome) return;
    const y = window.innerHeight * 0.4;
    let cur = links[0];
    spy.forEach(([href, id]) => {
      const sec = id && document.getElementById(id);
      if (sec && sec.getBoundingClientRect().top < y) cur = links.find((l) => l.getAttribute("href") === href) || cur;
    });
    if (id("about") && id("about").getBoundingClientRect().top < y) cur = links.find((l) => l.getAttribute("href") === "#contact") || cur;
    if (cur !== activeLink) { activeLink = cur; aimBlob(); }
  }
  function id(x) { return document.getElementById(x); }

  /* ---------- reel depth + Apple TV-style tilt ---------- */
  let tilt = null;   // { el, x, y } in -1..1
  function depth() {
    const vh = window.innerHeight;
    document.querySelectorAll(".reel .clip, .subpages .clip").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const d = Math.max(-1.6, Math.min(1.6, (r.top + r.height / 2 - vh / 2) / (vh / 2)));
      let rx = -d * 26, ry = 0, sc = 1 - Math.min(0.22, Math.abs(d) * 0.16), z = -Math.abs(d) * 60;
      if (tilt && tilt.el === el) { rx += -tilt.y * 9; ry = tilt.x * 11; sc *= 1.035; z += 20; }
      el.style.transform = `perspective(1100px) translateZ(${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
      if (!touch) el.style.filter = Math.abs(d) > 0.35 ? `blur(${((Math.abs(d) - 0.35) * 2.4).toFixed(2)}px)` : "";
    });
  }
  if (fine && !reduced) {
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest && e.target.closest(".reel .clip, .subpages .clip");
      if (!el) { if (tilt) { const old = tilt.el; tilt = null; old.classList.remove("tilting"); kickDepth(); } return; }
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (tilt && tilt.el !== el) tilt.el.classList.remove("tilting");
      tilt = { el, x, y };
      el.classList.add("tilting");
      el.style.setProperty("--gx", ((x + 1) * 50).toFixed(1) + "%");
      el.style.setProperty("--gy", ((y + 1) * 50).toFixed(1) + "%");
      if (!el.querySelector(".glare")) { const g = document.createElement("span"); g.className = "glare"; el.appendChild(g); }
      kickDepth();
    }, { passive: true });
  }
  let depthQueued = false;
  function kickDepth() {
    if (reduced || depthQueued) return;
    depthQueued = true;
    requestAnimationFrame(() => { depthQueued = false; depth(); });
  }

  /* ---------- reveals ---------- */
  const rvSel = ".subpages .clip, .still-card, .pool-head > :not(.logo-svg), .lm-group > .panel-label, .lm-card, .lm-go, .pool .vid, .pool .shot, .file, .pool-folder-title, .rv-note, " +
    "#showGrid .shot, .show .panel-label, .show-title, .stills .panel-label, .concert-head, .concert .shot, .artists .panel-label, .artist, .about .panel-label, .panel-text, .contact .panel-label, .contact-email, .socials, .colophon, .subpages-wrap .panel-label";
  const rvIO = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); rvIO.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px" });
  /* text that arrives in pieces: labels and the email letter by letter, prose word by word */
  const SPLIT = [[".panel-label", "ch"], [".contact-email", "ch"], [".panel-text", "w"]];
  function split(el, kind) {
    if (el.classList.contains("split")) return;
    const text = el.textContent; if (!text.trim()) return;
    el.classList.add("split");
    el.setAttribute("aria-label", text.trim());
    el.textContent = "";
    let i = 0;
    const parts = kind === "w" ? text.split(/(\s+)/) : Array.from(text);
    parts.forEach((p) => {
      if (!p) return;
      if (/^\s+$/.test(p)) { el.appendChild(document.createTextNode(p)); return; }
      const s = document.createElement("span"); s.className = kind; s.textContent = p; s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--i", i++); el.appendChild(s);
    });
  }
  // the hairline above each section draws itself out from the centre when you reach it
  const lineIO = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("line-in"); lineIO.unobserve(en.target); }
  }), { rootMargin: "0px 0px -12% 0px" });
  function armReveals() {
    SPLIT.forEach(([sel, kind]) => document.querySelectorAll(sel).forEach((el) => { if (!el.closest(".pin")) split(el, kind); }));
    document.querySelectorAll(".stills, .panel").forEach((sec) => { if (!sec._line) { sec._line = true; sec.classList.add("line-rv"); lineIO.observe(sec); } });
    document.querySelectorAll(rvSel).forEach((el) => {
      if (el.classList.contains("rv")) return;
      el.classList.add("rv");
      const sib = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.matches(rvSel)) : [];
      el.style.setProperty("--rvd", (Math.min(8, sib.indexOf(el)) * 0.07).toFixed(2) + "s");
      rvIO.observe(el);
    });
  }

  /* ---------- glue ---------- */
  // never stack glass on glass: the HUD steps aside while the "next films" pill passes under it
  function yieldHud() {
    if (!hud) return;
    const rm = document.querySelector(".reel-more");
    if (!rm) { hud.classList.remove("yield"); return; }
    const a = rm.getBoundingClientRect(), vh = window.innerHeight;
    hud.classList.toggle("yield", a.bottom > vh - 90 && a.top < vh);
  }
  function onScroll() { spySection(); kickDepth(); yieldHud(); }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { aimBlob(true); kickDepth(); });
  function boot() {
    watchConcerts(); lightTools(); armReveals(); spySection(); aimBlob(true); kickDepth(); yieldHud();
    // tool pages fill in after load (Drive folders, notes): reveal what arrives
    if (toolPage) { let q = 0; new MutationObserver(() => { cancelAnimationFrame(q); q = requestAnimationFrame(armReveals); })
      .observe(document.body, { childList: true, subtree: true }); }
    onActive(document.querySelector(".reel .clip.active"));   // app.js picked a film before we were listening
    // the reel re-renders when you page through films; pick the new tiles up
    const reel = document.getElementById("work");
    if (reel) new MutationObserver(kickDepth).observe(reel, { childList: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => aimBlob(true));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
