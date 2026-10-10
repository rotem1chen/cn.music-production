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
  // no lens when transparency is reduced or contrast is raised (style.css makes the glass solid then)
  const noGlass = window.matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more)").matches;
  const GLASS = ".nav, .hud, .skip-stills, .reel-more, .plight-close, .plight-nav, .viewer-close, .v-nav, .pin-pad button:not(.pin-del), .pin-boxes span, " +
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
  function show(bg) {
    front = 1 - front;
    layers[front].style.background = bg;
    layers[front].classList.add("on");
    layers[1 - front].classList.remove("on");
  }
  /* Phones: an 80px live blur over a full-screen layer at 3x density is what froze iPhone Safari for
     seconds after every load. There the light is blurred ONCE: the image is shrunk to a tiny canvas,
     tinted, and stretched back up — a 64px image scaled to the screen is already soft, and costs nothing. */
  const tinyCache = {};
  function tiny(url, done) {
    if (tinyCache[url]) return done(tinyCache[url]);
    const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async";
    im.onload = () => {
      try {
        const a = document.createElement("canvas"); a.width = 16; a.height = 9;
        a.getContext("2d").drawImage(im, 0, 0, 16, 9);             // shrinking = the blur
        const c = document.createElement("canvas"); c.width = 64; c.height = 36;
        const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(a, 0, 0, 64, 36);
        const d = x.getImageData(0, 0, 64, 36), p = d.data;
        for (let i = 0; i < p.length; i += 4) {                      // saturate 1.7, brightness .55 (as the CSS did)
          const l = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
          for (let k = 0; k < 3; k++) p[i + k] = Math.max(0, Math.min(255, (l + (p[i + k] - l) * 1.7) * 0.55));
        }
        x.putImageData(d, 0, 0);
        done(tinyCache[url] = c.toDataURL("image/jpeg", 0.85));
      } catch (_) { done(null); }
    };
    im.onerror = () => done(null);
    im.src = url;
  }
  // the film viewer and photo lightbox glows use the same pre-blur on phones (app.js, plight-fx.js)
  window.cnSoftBg = (el, url) => {
    if (!touch) { el.style.backgroundImage = `url("${url}")`; return; }
    el.dataset.want = url;
    tiny(url, (data) => { if (el.dataset.want === url && data) el.style.backgroundImage = `url("${data}")`; });
  };
  function ambient(bg) {
    if (!bg || bg === lastBg) return;
    lastBg = bg;
    const m = touch && /url\(["']?([^"')]+)["']?\)/.exec(bg);
    if (!m) return show(bg);
    tiny(m[1], (data) => { if (lastBg === bg && data) show(`url("${data}") center / cover no-repeat`); });
  }
  document.addEventListener("cn:active", (e) => onActive(e.detail && e.detail.el));
  const hud = document.getElementById("hud");
  // the HUD's text re-forms for the new film: each line rises out of a blur (phones: no blur, it repaints)
  function pulseHud() {
    if (!hud || reduced || !hud.animate) return;
    const soft = (px) => (touch ? {} : { filter: `blur(${px}px)` });
    Array.from(hud.children).forEach((s, i) => s.animate(
      [Object.assign({ opacity: 0, translate: "0 7px" }, soft(8)), Object.assign({ opacity: 1, translate: "0 0" }, soft(0))],
      { duration: 550, delay: i * 40, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" }));
  }
  function onActive(el) {
    if (!el) return;
    pulseHud();
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
    const y = viewH * 0.4;
    let cur = links[0];
    spy.forEach(([href, id]) => {
      const sec = id && document.getElementById(id);
      if (sec && placeOf(sec).top - scrollPos < y) cur = links.find((l) => l.getAttribute("href") === href) || cur;
    });
    if (id("about") && placeOf(id("about")).top - scrollPos < y) cur = links.find((l) => l.getAttribute("href") === "#contact") || cur;
    if (cur !== activeLink) { activeLink = cur; aimBlob(); }
  }
  function id(x) { return document.getElementById(x); }

  /* ---------- reel depth + Apple TV-style tilt ----------
     Scroll-linked, so it is written straight onto the frame — no CSS transition on transform/filter
     (a transition restarted on every scroll frame lags the scroll and lands in steps: the "boxy" feel).
     No rects either: each tile's place in the document is measured once (and again when the layout
     changes), so a scroll frame only reads scrollY. The hover lean eases in JS instead. */
  let tilt = null;   // { el, x, y } in -1..1
  let tiles = [], tilesDirty = true;
  let viewH = window.innerHeight;                  // cached: reading innerHeight mid-scroll can force a style pass
  let scrollPos = window.scrollY;                  // read once per frame, before anything is written
  function docTop(el) { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; }
  const places = new Map();                       // element → its place in the document, same lifetime as the tiles'
  function placeOf(el) {
    if (tilesDirty) measureTiles();
    let p = places.get(el);
    if (!p) places.set(el, (p = { top: docTop(el), h: el.offsetHeight }));
    return p;
  }
  function measureTiles() {
    tilesDirty = false;
    places.clear();
    tiles = Array.from(document.querySelectorAll(".reel .clip, .subpages .clip")).map((el) => {
      const old = el._depth || { x: 0, y: 0, k: 0, t: "", f: "" };
      el._depth = old;
      return { el, top: docTop(el), h: el.offsetHeight, s: old };
    });
  }
  let depthLast = 0;
  function depth(now) {
    if (tilesDirty) measureTiles();
    const vh = viewH, sy = scrollPos;
    const dt = Math.min(0.05, Math.max(0, (now - depthLast) / 1000) || 0.016); depthLast = now;
    const a = 1 - Math.exp(-dt / 0.075);           // ≈ the old .3s ease on the hover lean
    let moving = false;
    for (const t of tiles) {
      const top = t.top - sy;
      if (top + t.h < -200 || top > vh + 200) continue;
      const d = Math.max(-1.6, Math.min(1.6, (top + t.h / 2 - vh / 2) / (vh / 2)));
      const s = t.s, on = tilt && tilt.el === t.el;
      s.x += ((on ? tilt.x : 0) - s.x) * a; s.y += ((on ? tilt.y : 0) - s.y) * a; s.k += ((on ? 1 : 0) - s.k) * a;
      if (Math.abs((on ? tilt.x : 0) - s.x) + Math.abs((on ? tilt.y : 0) - s.y) + Math.abs((on ? 1 : 0) - s.k) > 0.004) moving = true;
      const rx = -d * 26 - s.y * 9, ry = s.x * 11, sc = (1 - Math.min(0.22, Math.abs(d) * 0.16)) * (1 + 0.035 * s.k), z = -Math.abs(d) * 60 + 20 * s.k;
      const tf = `perspective(1100px) translateZ(${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
      if (tf !== s.t) { s.t = tf; t.el.style.transform = tf; }          // unchanged → no style work
      if (!touch) {
        const f = Math.abs(d) > 0.35 ? `blur(${((Math.abs(d) - 0.35) * 2.4).toFixed(1)}px)` : "";
        if (f !== s.f) { s.f = f; t.el.style.filter = f; }
      }
    }
    if (moving) kickDepth();                         // the lean is still easing toward the pointer
  }
  if (fine && !reduced) {
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest && e.target.closest(".reel .clip, .subpages .clip");
      if (!el) { if (tilt) { const old = tilt.el; tilt = null; old.classList.remove("tilting"); kickDepth(); } return; }
      const r = el.getBoundingClientRect();
      // clamped: a captured scrub drag (scrub.js) keeps reporting the tile after the pointer has left it
      const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)), y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
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
    requestAnimationFrame((now) => { depthQueued = false; scrollPos = window.scrollY; depth(now); });
  }

  /* ---------- reveals ---------- */
  const rvSel = ".subpages .clip, .still-card, .pool-head > :not(.logo-svg), .lm-group > .panel-label, .lm-card, .lm-go, .pool .vid, .pool .shot, .file, .pool-folder-title, .rv-note, " +
    "#showGrid .shot, .show .panel-label, .show-title, .stills .panel-label, .concert-head, .concert .shot, .artists .panel-label, .artist, .shows .panel-label, .show-row, .grade .panel-label, .gr-stage, .gr-thumbs, .covers .panel-label, .cv-note, .cover, .about .panel-label, .panel-text, .contact .panel-label, .contact-email, .socials, .colophon, .subpages-wrap .panel-label";
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
    const p = placeOf(rm), vh = viewH, top = p.top - scrollPos;
    hud.classList.toggle("yield", top + p.h > vh - 90 && top < vh);
  }
  // all scroll work in one frame callback (reads, then writes) instead of straight in the scroll event.
  // On the home page it rides app.js's own scroll frame, after the reel has been read, with the scroll
  // position app.js read first — so the whole frame measures once and writes once.
  function scrollFrame(now, y) { scrollPos = y == null ? window.scrollY : y; spySection(); yieldHud(); if (!depthQueued) depth(now); }
  let scrollQueued = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame((now) => { scrollQueued = false; scrollFrame(now); });
  }
  if (Array.isArray(window.cnScrollFrame)) window.cnScrollFrame.push(scrollFrame);
  else window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { viewH = window.innerHeight; tilesDirty = true; aimBlob(true); kickDepth(); });
  // the tiles' places only change when the layout does (images, fonts, paging, rotation)
  if (window.ResizeObserver) new ResizeObserver(() => { tilesDirty = true; kickDepth(); }).observe(document.body);
  function boot() {
    watchConcerts(); lightTools(); armReveals(); spySection(); aimBlob(true); kickDepth(); yieldHud();
    // tool pages fill in after load (Drive folders, notes): reveal what arrives
    if (toolPage) { let q = 0; new MutationObserver(() => { cancelAnimationFrame(q); q = requestAnimationFrame(armReveals); })
      .observe(document.body, { childList: true, subtree: true }); }
    onActive(document.querySelector(".reel .clip.active"));   // app.js picked a film before we were listening
    // the reel re-renders when you page through films; pick the new tiles up
    const reel = document.getElementById("work");
    if (reel) new MutationObserver(() => { tilesDirty = true; kickDepth(); }).observe(reel, { childList: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => aimBlob(true));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
