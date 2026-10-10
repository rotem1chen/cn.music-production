/* CN Production — cursor-driven viewfinder reel (SITE + CLIPS from clips.js). */
(function () {
  "use strict";
  document.addEventListener("touchstart", () => {}, { passive: true });   // lets iOS Safari show :active press states

  /* ---------- Site text ---------- */
  document.title = SITE.name + " — Music Video Production";
  document.querySelectorAll("[data-brand]").forEach((el) => (el.textContent = SITE.name));
  document.querySelectorAll("[data-mark]").forEach((el) => (el.textContent = SITE.mark || SITE.name));
  document.querySelectorAll("[data-tagline]").forEach((el) => (el.textContent = SITE.tagline));
  const aEl = document.querySelector("[data-about]"); if (aEl) aEl.textContent = SITE.about;
  const yEl = document.querySelector("[data-year]"); if (yEl) yEl.textContent = new Date().getFullYear();
  const emailLink = document.querySelector("[data-email-link]");
  if (emailLink) { emailLink.textContent = SITE.email; emailLink.href = "mailto:" + SITE.email; }

  const socialWrap = document.getElementById("socials");
  if (socialWrap && SITE.socials) {
    const labels = { instagram: "Instagram", youtube: "YouTube", vimeo: "Vimeo", email: "Email" };
    Object.entries(SITE.socials).forEach(([k, v]) => {
      if (!v) return;
      const a = document.createElement("a");
      a.textContent = labels[k] || k;
      a.href = k === "email" ? "mailto:" + v : v;
      if (k !== "email") { a.target = "_blank"; a.rel = "noopener"; }
      socialWrap.appendChild(a);
    });
  }

  /* ---------- Video parsing ---------- */
  function parseVideo(url) {
    if (!url) return null;
    let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) {
      const id = m[1];
      return {
        type: "youtube", id,
        preview: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1&disablekb=1&fs=0&iv_load_policy=3`,
        player: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
        thumb: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
        thumbFallback: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
    }
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) {
      const id = m[1];
      return { type: "vimeo", id,
        preview: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1`,
        player: `https://player.vimeo.com/video/${id}?autoplay=1`, thumb: null, thumbFallback: null };
    }
    if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url)) {
      return { type: "file", id: url, preview: url, player: url, thumb: null, thumbFallback: null };
    }
    return null;
  }

  const items = (Array.isArray(CLIPS) ? CLIPS : [])
    .map((c) => ({ ...c, v: parseVideo(c.url) }))
    .filter((c) => c.v);

  /* ---------- Build reel — 5 films at a time, button swaps in the next 5 ---------- */
  const reel = document.getElementById("work");
  const total = String(items.length).padStart(2, "0");
  const PAGE_SIZE = 5;
  let page = 0;
  const clipEls = [];        // elements currently on screen (one page's worth)
  const pageItems = [];      // the clip data behind them, same order
  const subEls = [], subItems = [];   // the SOCIAL / RESTAURANT tiles under the reel

  /* The viewfinder targets the films AND the tiles below them, as one list:
     films first, tiles after, so a page swap never renumbers the tiles. */
  function targetCount() { return clipEls.length + subEls.length; }
  function elAt(i)   { return i < clipEls.length ? clipEls[i]   : subEls[i - clipEls.length]; }
  function itemAt(i) { return i < clipEls.length ? pageItems[i] : subItems[i - clipEls.length]; }

  /* A clip may declare its own shape, e.g. ratio: "1/1" for a square social post
     or "9/16" for a vertical one. Returns height / width; 16:9 when unset. */
  function clipAspect(c) {
    const r = c && c.ratio;
    if (!r) return 0.5625;
    if (typeof r === "number" && r > 0) return r;
    const m = String(r).match(/^\s*(\d+(?:\.\d+)?)\s*[\/:]\s*(\d+(?:\.\d+)?)\s*$/);
    if (m && +m[1] > 0 && +m[2] > 0) return +m[2] / +m[1];      // "w/h" -> h/w
    return 0.5625;
  }

  function buildClip(c, i) {
    const el = document.createElement("div");
    el.className = "clip";
    el.tabIndex = 0;

    // Non-16:9 films keep the row HEIGHT (so the reel's rhythm and the 50vh
    // centring maths are untouched) and simply get narrower — the tile matches
    // the film, so nothing is letterboxed.
    const aspect = clipAspect(c);
    if (Math.abs(aspect - 0.5625) > 0.001) {
      el.style.aspectRatio = (1 / aspect).toFixed(6) + " / 1";
      el.style.width = "auto";
    }
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Play " + (c.title || "clip"));

    const poster = document.createElement("div");
    poster.className = "poster";
    el.appendChild(poster);
    el._poster = poster;
    (function setPoster() {
      const primary = c.thumb || c.v.thumb, fb = c.v.thumbFallback;
      function fail() {                                   // no thumbnail available → clean titled tile
        el.classList.add("no-thumb");
        const lab = document.createElement("div");
        lab.className = "clip-fallback";
        lab.textContent = c.title || "";
        el.appendChild(lab);
      }
      function tryLoad(url, next) {
        if (!url) return next();
        const img = new Image();
        img.onload = () => { poster.style.backgroundImage = `url("${url}")`; };
        img.onerror = next;
        img.src = url;
      }
      tryLoad(primary, () => tryLoad(fb, fail));
    })();

    // mouse only moves the target-corners onto the pointed clip — no auto-centering
    el.addEventListener("mouseenter", () => { cursor.classList.add("big"); hoverIdx = i; refresh(); });
    el.addEventListener("mouseleave", () => { cursor.classList.remove("big"); if (hoverIdx === i) { hoverIdx = -1; refresh(); } });
    el.addEventListener("click", () => openViewer(el, c));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(el, c); } });
    holdCredits(el, c);
    // drag sideways across the film to flip through its scenes (scrub.js); the target treats it as the active film
    if (window.cnScrub && c.v.type === "youtube") window.cnScrub.attach(el, c.v.id, {
      onStart: () => { if (hoverIdx !== i) { hoverIdx = i; refresh(); } },
      onEnd: (pt) => { if (pt !== "mouse" && hoverIdx === i) { hoverIdx = -1; refresh(); } },
    });
    return el;
  }

  /* Press and hold a film: it turns over like a card and shows its credits — song, artist, your role.
     Let go and it turns back. Moving first is a scroll or a scrub, never a hold; a hold never opens the film. */
  function holdCredits(el, c) {
    const back = document.createElement("div");
    back.className = "clip-back"; back.setAttribute("aria-hidden", "true");
    const meta = [c.format, c.year].filter(Boolean).map(esc).join(" · ");
    back.innerHTML = `<span class="cb-k">Credits</span><b class="cb-title">${esc(c.title || "Untitled")}</b>` +
      (c.artist ? `<span class="cb-artist">${esc(c.artist)}</span>` : "") +
      `<span class="cb-role">${esc(c.role || "Directed · Shot · Edited — CN PROD")}</span>` +
      (meta ? `<span class="cb-meta">${meta}</span>` : "");
    el.appendChild(back);
    let t = 0, x0 = 0, y0 = 0, held = false, swallow = false;
    const cancel = () => clearTimeout(t);
    el.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary || e.button !== 0) return;
      x0 = e.clientX; y0 = e.clientY; swallow = false;
      cancel();
      t = setTimeout(() => {
        held = true; swallow = true;
        el.classList.add("credits");
        if (window.cnHaptic) window.cnHaptic(12);
      }, 450);
    });
    el.addEventListener("pointermove", (e) => { if (!held && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) cancel(); });
    const letGo = () => { cancel(); if (held) { held = false; el.classList.remove("credits"); } };
    el.addEventListener("pointerup", letGo);
    el.addEventListener("pointercancel", letGo);
    el.addEventListener("pointerleave", letGo);
    el.addEventListener("contextmenu", (e) => { if (held || swallow) e.preventDefault(); });
    el.addEventListener("click", (e) => { if (swallow) { swallow = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  }

  /* The reel is ONE list that grows. It starts with the first five; past the last film sits a pull
     zone — keep scrolling into it and a yellow ring fills ("Keep pulling · 4 more films"). When the
     ring is full the next films rise in right there, and you just carry on scrolling into them: no
     button, no jump back to the top. `page` stays 0 (indexes are reel-wide). */
  let shown = 0;
  let swapping = false;                                    // kept for refresh(): nothing swaps any more
  function addClip(c, i) {
    const el = buildClip(c, i);
    reel.insertBefore(el, pull && pull.parentNode === reel ? pull : null);
    clipEls.push(el); pageItems.push(c);
    const bar = document.createElement("i"); barsWrap.appendChild(bar); bars.push(bar);
    return el;
  }
  function renderPage(n) {                                 // (re)build the reel with the first n films
    clipEls.forEach(stopPreview);
    reel.innerHTML = "";
    clipEls.length = 0; pageItems.length = 0;
    barsWrap.innerHTML = ""; bars = [];
    hoverIdx = -1; activeIdx = -1;                         // force the HUD + target to reattach
    shown = Math.min(items.length, Math.max(PAGE_SIZE, n || PAGE_SIZE));
    items.slice(0, shown).forEach((c, i) => addClip(c, i));
    placePull();
    refresh();
  }

  /* ---------- the pull zone ---------- */
  let pull = null, pullTop = 0, pullH = 0, pullDone = false;
  let lastY = 0, lastT = 0, speed = 0, passed = false;   // speed decides intent: a slow pull loads, a flick skips
  const R = 26, CIRC = 2 * Math.PI * R;
  function placePull() {
    const left = items.length - shown;
    if (left <= 0) { if (pull) pull.remove(); pull = null; return; }
    if (!pull) {
      pull = document.createElement("div");
      pull.className = "reel-pull";

      pull.innerHTML = '<div class="rp-in"><svg class="rp-ring" viewBox="0 0 64 64">' +
        `<circle class="rp-track" cx="32" cy="32" r="${R}"/><circle class="rp-fill" cx="32" cy="32" r="${R}" ` +
        `stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}"/>` +
        '<path class="rp-ar" d="M32 22v18m-7-7 7 7 7-7"/></svg>' +
        '<span class="rp-t">Keep pulling</span><span class="rp-s"></span></div>';
      // keyboard / screen readers / anyone who'd rather press: the same thing as a real button
      const b = document.createElement("button");
      b.className = "rp-btn"; b.type = "button";
      b.addEventListener("click", () => revealMore());
      pull.appendChild(b);
    }
    const n = Math.min(PAGE_SIZE, left);
    pull.querySelector(".rp-s").textContent = n + (n === 1 ? " more film" : " more films");
    pull.querySelector(".rp-btn").textContent = "Show " + n + " more films";
    reel.appendChild(pull);
    pullDone = false; setPassed(false);
    pull.style.setProperty("--p", 0);
    measurePull();
  }
  function measurePull() {
    if (!pull) return;
    const r = pull.getBoundingClientRect();
    pullTop = r.top + window.scrollY; pullH = r.height;
  }
  // per frame, from cached numbers only: how far into the zone the bottom of the screen has travelled
  function pullFrame() {
    if (!pull || pullDone) return;
    const y = window.scrollY, t = performance.now();
    // px per ms: a fresh gesture starts from its own first step (no lag from zero), then decays gently
    const v = lastT && t - lastT < 120 ? (y - lastY) / Math.max(1, t - lastT) : 0;
    speed = Math.max(v, speed * 0.7);
    lastY = y; lastT = t;
    const p = Math.max(0, Math.min(1, (y + vh - pullTop - pullH * 0.25) / (pullH * 0.6)));
    // flicked straight through (faster than ~1.6px/ms, i.e. a throw, not a pull): that's a skip —
    // the ring dims and stays behind; coming back up above it re-arms the pull
    if (passed) { if (p < 0.15) setPassed(false); else return; }
    if (p >= 1 && speed > 1.6) { setPassed(true); return; }
    pull.style.setProperty("--p", p.toFixed(3));
    pull.querySelector(".rp-fill").style.strokeDashoffset = (CIRC * (1 - p)).toFixed(1);
    pull.classList.toggle("ready", p > 0.98);
    if (p >= 1) revealMore();
  }
  function setPassed(on) {
    passed = on;
    pull.classList.toggle("passed", on); if (on) pull.classList.remove("ready");
    const n = Math.min(PAGE_SIZE, items.length - shown), more = n + (n === 1 ? " more film" : " more films");
    pull.querySelector(".rp-t").textContent = on ? "Skipped" : "Keep pulling";
    pull.querySelector(".rp-s").textContent = on ? "Scroll back up for " + more : more;
  }
  function revealMore() {
    if (!pull || pullDone) return;
    pullDone = true;
    pull.classList.add("ready", "go");
    if (window.cnHaptic) window.cnHaptic(14);
    const from = shown;
    shown = Math.min(items.length, shown + PAGE_SIZE);
    const fresh = items.slice(from, shown).map((c, k) => addClip(c, from + k));
    // the films rise in where the ring was, a beat apart; the ring folds away
    const vhNow = window.innerHeight;
    if (!reducedMotion && fresh[0] && fresh[0].animate) fresh.forEach((el, k) => el.animate(
      [{ opacity: 0, translate: `0 ${(vhNow * 0.22).toFixed(0)}px`, scale: ".94" }, { opacity: 1, translate: "0 0", scale: "1" }],
      { duration: 720, delay: k * 60, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" }));
    const old = pull; pull = null;
    old.animate ? old.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.8)" }],
      { duration: 260, easing: "ease-in", fill: "forwards" }).finished.then(() => { old.remove(); placePull(); layoutJobs.forEach((f) => f()); })
      : (old.remove(), placePull());
    refresh();
  }

  /* ---------- Refs ---------- */
  const chrome = document.getElementById("chrome");
  const hud = document.getElementById("hud");
  const target = document.getElementById("target");
  const cursor = document.getElementById("cursor");
  const logoHero = document.getElementById("logoHero");
  const hudFormat = document.querySelector("[data-hud-format]");
  const hudTitle = document.querySelector("[data-hud-title]");
  const hudArtist = document.querySelector("[data-hud-artist]");
  const hudIndex = document.querySelector("[data-hud-index]");

  // left indicator: one bar per film on the current page, active one lit
  const barsWrap = document.querySelector(".deco-bars");
  let bars = [];

  let hoverIdx = -1;
  let activeIdx = -1;
  let viewerOpen = false;
  let animatingScroll = false, scrollRAF = null;

  function scrollToClip(i) {
    const el = clipEls[i]; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cur = window.scrollY;
    const raw = cur + rect.top + rect.height / 2 - window.innerHeight / 2;
    const dest = Math.max(0, Math.min(raw, document.documentElement.scrollHeight - window.innerHeight));
    if (Math.abs(dest - cur) < 4) return;
    cancelAnimationFrame(scrollRAF);
    animatingScroll = true;
    const start = cur, dist = dest - start, t0 = performance.now(), dur = 520;
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);          // easeOutCubic
      (document.scrollingElement || document.documentElement).scrollTop = start + dist * e;  // direct → no smooth/snap jump
      if (p < 1) scrollRAF = requestAnimationFrame(step);
      else animatingScroll = false;
    })(performance.now());
  }

  /* The brackets move on the compositor: each corner has its own translate, so gliding onto the
     next film never animates top/left/width/height (that was a layout pass on every scroll frame). */
  const corners = ["tl", "tr", "bl", "br"].map((k) => target.querySelector(".corner." + k));
  /* Phones: the same corners and the same glide as on a computer, but placed on the PAGE (position:absolute
     in document coordinates) instead of fixed to the screen. A phone scrolls on the compositor, and anything
     moved by script every scroll frame slips behind it — so these are written only when the film they
     frame changes (then they glide there, .42s), and in between they simply scroll with the page. Their
     place comes from the layout (offsetTop/Left), not the tilted on-screen rect, so it holds still. */
  const touchUI = !!(window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches);
  const docTarget = document.createElement("div");
  docTarget.className = "doc-target"; docTarget.setAttribute("aria-hidden", "true");
  docTarget.innerHTML = '<span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>';
  const docCorners = [...docTarget.children], docAt = [];
  if (touchUI) { document.documentElement.classList.add("doc-targeting"); document.body.appendChild(docTarget); }
  function docBox(el) {                                // layout position on the page (transforms ignored)
    let x = 0, y = 0;
    for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { left: x, top: y, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
  }
  const CORNER = 18, cornerAt = [];
  // track = following the scroll: the corners stay glued to the film, no glide. A CSS glide restarted on
  // every scroll frame made them trail the film by ~0.4s on phones (they're fixed, the film scrolls).
  // The glide is only for a pointer moving the target onto another film without scrolling.
  function positionTarget(i, r, track) {
    const el = elAt(i); if (!el) return;
    if (touchUI) {
      const b = docBox(el), pad = 10;
      const x0 = b.left - pad, y0 = b.top - pad, x1 = b.right + pad - CORNER, y1 = b.bottom + pad - CORNER;
      const first = !docAt.length;
      if (first) docCorners.forEach((c) => { c.style.transition = "none"; });
      [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([x, y], k) => {
        const v = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        if (docAt[k] !== v) { docAt[k] = v; docCorners[k].style.transform = v; }   // unchanged → nothing written
      });
      if (first) requestAnimationFrame(() => requestAnimationFrame(() => docCorners.forEach((c) => { c.style.transition = ""; })));
      return;
    }
    target.classList.toggle("track", !!track);
    r = r || el.getBoundingClientRect();
    const pad = 10, x0 = r.left - pad, y0 = r.top - pad, x1 = r.right + pad - CORNER, y1 = r.bottom + pad - CORNER;
    if (!cornerAt.length) {                    // first placement: appear in place, don't glide in from 0,0
      corners.forEach((c) => { c.style.transition = "none"; });
      requestAnimationFrame(() => requestAnimationFrame(() => corners.forEach((c) => { c.style.transition = ""; })));
    }
    [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([x, y], k) => {
      const v = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (cornerAt[k] !== v) { cornerAt[k] = v; corners[k].style.transform = v; }   // unchanged → no style work
    });
  }
  // the corners snap in from outside when a new film locks (was a CSS class restarted with a forced reflow)
  const LOCK_FROM = [["-12px", "-12px"], ["12px", "-12px"], ["-12px", "12px"], ["12px", "12px"]];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function lockOn() {
    if (!target.animate || reducedMotion) return;
    (touchUI ? docCorners : corners).forEach((c, k) => c.animate([{ opacity: 0, translate: LOCK_FROM[k].join(" ") }, { opacity: 1, translate: "0 0" }],
      { duration: 450, easing: "cubic-bezier(.16,1,.3,1)" }));
  }

  let lockedEl = null;                              // the film the last haptic tick was for
  function setActive(i) {
    const prev = elAt(activeIdx);
    if (prev) { prev.classList.remove("active"); stopPreview(prev); }
    activeIdx = i;
    const el = elAt(i), c = itemAt(i);
    if (!el || !c) return;
    el.classList.add("active");
    const isSub = i >= clipEls.length;
    // reel shows the still thumbnail only — the video plays when opened
    hudFormat.textContent = isSub ? (c.sub || "") : (c.format || "DIGITAL");
    hudTitle.textContent = c.title || "Untitled";
    hudArtist.textContent = isSub ? "" : (c.artist || "");
    hudIndex.textContent = isSub ? "" : String(page * PAGE_SIZE + i + 1).padStart(2, "0") + " — " + total;
    bars.forEach((b, j) => b.classList.toggle("on", !isSub && j === i));
    lockOn();
    // Android: a tiny tick as the target locks on — only for a new film (not the same one re-locking
    // after the viewer closes or the page re-renders) and never more than one per 150ms of scrolling
    if (el !== lockedEl) { lockedEl = el; if (window.cnHaptic) window.cnHaptic(8, 150); }
    document.dispatchEvent(new CustomEvent("cn:active", { detail: { el } }));   // fx.js: ambient light + HUD refresh
  }

  function startPreview(el, c) {
    if (el._media || viewerOpen) return;
    let media;
    if (c.v.type === "file") {
      media = document.createElement("video");
      media.src = c.v.preview; media.muted = true; media.loop = true; media.autoplay = true; media.playsInline = true;
      media.play && media.play().catch(() => {});
    } else {
      media = document.createElement("iframe");
      media.src = c.v.preview; media.allow = "autoplay; encrypted-media";
    }
    el.appendChild(media); el._media = media;
  }
  function stopPreview(el) { if (el && el._media) { el._media.remove(); el._media = null; } }

  /* ---------- Refresh (hover + scroll drive the target) ---------- */
  // one read pass: every rect first, so refresh() afterwards only writes
  function nearestToCenter() {
    const fy = window.innerHeight / 2;
    let best = -1, bestD = Infinity;
    const rects = [];
    for (let i = 0; i < targetCount(); i++) {
      const r = rects[i] = elAt(i).getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - fy);
      if (d < bestD) { bestD = d; best = i; }
    }
    return { best, bestD, rects };
  }

  const html = document.documentElement;
  function refresh(track) {
    if (viewerOpen || swapping) return;
    // during the opening the brackets ride the films' rise on the compositor (opening.js), already parked
    // on their final place — reading rects here would measure the moving films and count the rise twice
    if (html.classList.contains("opening-run")) return;
    const { best, bestD, rects } = nearestToCenter();
    const useHover = hoverIdx >= 0;
    const a = useHover ? hoverIdx : best;
    const show = a >= 0 && (useHover || bestD < window.innerHeight * 0.7);

    chrome.classList.toggle("hide", !show);
    docTarget.classList.toggle("hide", !show);
    hud.classList.toggle("hide", !show);

    if (a >= 0 && show) {
      if (a !== activeIdx) setActive(a);
      positionTarget(a, rects[a], track && !useHover);
    }

  }

  /* Everything that follows the scroll runs in ONE frame callback, never straight in the scroll event:
     by the time a scroll event fires the page may have pending style, and reading positions there
     forced a recalculation on every event. Section offsets are cached until the layout changes. */
  const onFrame = [];                       // cheap per-frame jobs that only read cached numbers
  let vh = window.innerHeight;              // innerHeight itself can force a style pass in a scroll event
  const layoutJobs = [];                    // re-measure when the page's size changes (images, fonts, paging)
  if (window.ResizeObserver) new ResizeObserver(() => layoutJobs.forEach((f) => f())).observe(document.body);
  onFrame.push(pullFrame); layoutJobs.push(measurePull);   // the reel's pull zone (above)
  const after = window.cnScrollFrame = [];  // fx.js (depth, scrollspy) joins this same frame
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame((now) => {
      ticking = false;
      const y = window.scrollY;             // the frame's one fresh read; fx.js reuses it after the writes
      onFrame.forEach((f) => f()); refresh(true);
      after.forEach((f) => f(now, y));
    });
  }, { passive: true });
  window.addEventListener("resize", () => { vh = window.innerHeight; layoutJobs.forEach((f) => f()); onFrame.forEach((f) => f()); refresh(); });

  window.cnRefresh = refresh;   // opening.js puts the brackets back on the films once the opening is over
  renderPage(PAGE_SIZE);  // first five films (everything above must exist before this runs)
  refresh();

  /* wheel does all the scrolling — free, no auto-centering */

  /* ---------- Cursor ring: retired (style.css hides it; the normal pointer is used) ----------
     It used to trail the mouse from a requestAnimationFrame loop that never stopped, so every
     device — phones included — did style work on every frame for an element nobody could see. */
  let cursorShown = false;

  /* ---------- Viewer: video grows, crosshair lines spread with it ---------- */
  const viewer = document.getElementById("viewer");
  const stage = document.getElementById("viewerStage");
  const mediaBox = document.getElementById("viewerMedia");
  const closeBtn = document.getElementById("viewerClose");
  const vLeadT = document.getElementById("vLeadT"), vLeadB = document.getElementById("vLeadB");
  const vLeadL = document.getElementById("vLeadL"), vLeadR = document.getElementById("vLeadR");
  const vAmb = document.getElementById("vAmb");
  const vPrev = document.getElementById("vPrev"), vNext = document.getElementById("vNext");
  let lastFocused = null;

  /* ---------- YouTube API: reveal the player only once it's actually playing ---------- */
  let ytApiReady = false, ytApiLoading = false, ytPlayer = null, pendingMount = null;
  const isTouch = !!(window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches) || "ontouchstart" in window;
  function loadYTApi() {
    if (ytApiReady || ytApiLoading) return;
    ytApiLoading = true;
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
  window.onYouTubeIframeAPIReady = function () {
    ytApiReady = true;
    if (pendingMount) { const f = pendingMount; pendingMount = null; f(); }
    warmKept();                                        // phones: a player waiting for the first tap
  };
  // the API is a chain of scripts: fetch it once the opening is over and the page is idle, not while it
  // plays (a phone's main thread is busiest right then). Opening a film earlier loads it on the spot.
  (function preloadYT() {
    const idle = () => (window.requestIdleCallback ? requestIdleCallback(loadYTApi, { timeout: 2000 }) : setTimeout(loadYTApi, 300));
    // phones need the waiting player ready before the first tap (that tap is what allows the sound),
    // so there it loads the moment the opening is over rather than when the page next goes idle
    const go = isTouch ? loadYTApi : idle;
    if (html.classList.contains("opening")) setTimeout(go, 2600); else go();
  })();

  /* The film starts loading the moment you click, hidden and muted, so it buffers during the
     grid + grow animation instead of after it. It is shown only once the stage has grown AND the
     film is actually playing; until then the poster shows a liquid loading state (.waiting). */
  let play = { token: 0 };
  const soundBtn = document.getElementById("vSound");
  /* Phones keep ONE YouTube player for the whole visit and only switch the video in it. Its frame never
     leaves the page (moving or removing an iframe reloads it): it is just hidden while another kind of
     film, or nothing, is on the stage. See warmKept below for why it exists before the first tap. */
  let ytKeep = null, ytCur = null;
  const ytWrap = document.createElement("div");
  ytWrap.className = "yt-keep"; ytWrap.hidden = true;
  function clearMedia() { [...mediaBox.children].forEach((ch) => { if (ch !== ytWrap) ch.remove(); }); }
  if (soundBtn) soundBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    try { ytPlayer.unMute(); ytPlayer.setVolume(100); ytPlayer.playVideo(); } catch (_) {}
    soundBtn.hidden = true;
  });
  function settle(t) {                                  // called whenever "grown" or "ready" changes
    if (t !== play.token || !play.grown || !play.ready || play.revealed) return;
    play.revealed = true;
    clearTimeout(play.waitT); clearTimeout(play.safety);
    if (play.start) play.start();                       // rewind, sound on, play — then show
    viewer.classList.remove("waiting");
    viewer.classList.add("loaded");
  }
  function ready(t) { if (t === play.token) { play.ready = true; settle(t); } }

  function mountPlayer(c, t) {
    if (c.v.type === "youtube") {
      if (!ytApiReady) { pendingMount = () => mountPlayer(c, t); loadYTApi(); return; }
      const from = play.seek || 0;                     // scrubbed to a point just before opening (scrub.js)
      if (isTouch) { mountKept(c, t, from); return; }
      clearMedia();
      mediaBox.insertAdjacentHTML("beforeend", '<div id="ytHost"></div>');
      let primed = false;
      ytPlayer = new YT.Player("ytHost", {
        videoId: c.v.id, width: "100%", height: "100%",
        playerVars: Object.assign({ autoplay: 1, mute: 1, controls: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 1, iv_load_policy: 3 },
          from ? { start: Math.floor(from) } : {}),
        events: {
          onReady: (e) => {
            try { e.target.mute(); e.target.playVideo(); } catch (_) {}
            // a phone in Low Power Mode refuses even muted autoplay: show YouTube's own play button soon
            if (isTouch) setTimeout(() => { if (!primed) ready(t); }, 2500);
          },
          onStateChange: (e) => {
            if (e.data !== YT.PlayerState.PLAYING || primed || t !== play.token) return;
            primed = true;                              // it plays: buffered and decoding. Hold it until we show it.
            const p = e.target;
            if (!play.grown) { try { p.pauseVideo(); } catch (_) {} }
            // phones only allow a video to play by itself if it's muted, so there it starts muted
            // and "Tap for sound" turns the sound on; computers start with sound straight away
            play.start = isTouch
              ? () => { try { p.seekTo(from, true); p.playVideo(); } catch (_) {} soundBtn.hidden = false; }
              : () => { try { p.seekTo(from, true); p.unMute(); p.setVolume(100); p.playVideo(); } catch (_) {} };
            ready(t);
          },
        },
      });
    } else if (c.v.type === "vimeo") {
      // Vimeo would autoplay with sound while still hidden, so it is mounted when the stage has grown
      play.mountLater = () => {
        clearMedia();
        mediaBox.insertAdjacentHTML("beforeend", `<iframe src="${c.v.player}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`);
        mediaBox.querySelector("iframe").addEventListener("load", () => setTimeout(() => ready(t), 400), { once: true });
      };
    } else {
      clearMedia();
      mediaBox.insertAdjacentHTML("beforeend", `<video src="${c.v.player}" controls playsinline preload="auto" muted></video>`);
      const v = mediaBox.querySelector("video");
      v.addEventListener("canplay", () => ready(t), { once: true });
      play.start = () => { v.currentTime = 0; v.muted = false; const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play(); }); };
    }
  }
  /* Phones: the kept player is made as soon as the YouTube API is here (empty, hidden), so that the TAP
     that opens a film can start it — with sound — right inside that tap. YouTube on a phone mutes any
     play that doesn't come from a tap (and shows its own small unmute button); a play started 2.5s
     later, after the opening, never counts. The film then waits, paused, until the stage has grown. */
  let keptReady = false, ytPre = null;
  function warmKept() {
    if (!isTouch || ytKeep || !ytApiReady) return;
    if (!ytWrap.isConnected) mediaBox.appendChild(ytWrap);
    ytWrap.innerHTML = '<div id="ytHost"></div>';
    ytKeep = new YT.Player("ytHost", {
      width: "100%", height: "100%",
      playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 1, iv_load_policy: 3 },
      events: {
        onReady: () => { keptReady = true; },
        onStateChange: (e) => keptState(e.target, e.data),
      },
    });
  }
  function startKept(id, from) {                      // call only inside a tap: that's what allows the sound
    try { ytKeep.unMute(); ytKeep.setVolume(100); ytKeep.loadVideoById({ videoId: id, startSeconds: Math.floor(from || 0) }); } catch (_) {}
  }
  function mountKept(c, t, from) {
    clearMedia();
    ytCur = { t, from, primed: false };
    ytWrap.hidden = false;
    if (!ytWrap.isConnected) mediaBox.appendChild(ytWrap);
    if (ytKeep && keptReady) {
      ytPlayer = ytKeep;
      if (ytPre && ytPre.id === c.v.id) {              // already started inside the swipe's touch (goFilm)
        ytPre = null;
        let st = -1; try { st = ytKeep.getPlayerState(); } catch (_) {}
        if (st === YT.PlayerState.PLAYING) keptState(ytKeep, st);
      } else startKept(c.v.id, from);                  // openViewer runs inside the tap on the tile
    } else if (!ytKeep) {
      // the API arrived only with this tap: no player yet to start inside it — this one starts muted
      ytWrap.innerHTML = '<div id="ytHost"></div>';
      ytKeep = ytPlayer = new YT.Player("ytHost", {
        videoId: c.v.id, width: "100%", height: "100%",
        playerVars: Object.assign({ autoplay: 1, mute: 1, controls: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 1, iv_load_policy: 3 },
          from ? { start: Math.floor(from) } : {}),
        events: {
          onReady: (e) => { keptReady = true; try { e.target.mute(); e.target.playVideo(); } catch (_) {} },
          onStateChange: (e) => keptState(e.target, e.data),
        },
      });
    } else {                                           // made but not ready yet: start it the moment it is —
      const wait = setInterval(() => {                 // no longer inside the tap, so muted (a phone allows
        if (!ytCur || ytCur.t !== t) { clearInterval(wait); return; }   // that) and the "Tap for sound" pill
        if (keptReady) {
          clearInterval(wait); ytPlayer = ytKeep;
          try { ytKeep.mute(); ytKeep.loadVideoById({ videoId: c.v.id, startSeconds: Math.floor(from || 0) }); } catch (_) {}
        }
      }, 100);
    }
    // Low Power Mode refuses even muted autoplay: show YouTube's own play button soon
    setTimeout(() => { if (ytCur && ytCur.t === t && !ytCur.primed) ready(t); }, 2500);
  }
  function keptState(p, state) {
    const cur = ytCur;
    if (!cur || state !== YT.PlayerState.PLAYING || cur.primed || cur.t !== play.token) return;
    cur.primed = true;
    // NOT paused for the opening (a computer pauses it there): on an iPhone the play that resumes it
    // later isn't a tap, so it's refused and the film waits for YouTube's play button. So it just keeps
    // playing from the tap — the music starts while the grid forms, the picture fades in once grown.
    play.start = () => {
      soundBtn.hidden = true;
      // if YouTube kept it muted after all (a tap before the player was ready), our big "Tap for sound"
      const live = () => ytCur === cur && cur.t === play.token;
      setTimeout(() => {
        if (!live()) return;
        let m = false; try { m = p.isMuted(); } catch (_) {}
        if (m) soundBtn.hidden = false;
      }, 600);
    };
    ready(cur.t);
  }

  // the stage has grown: show the film if it's ready, otherwise the poster gets the liquid loading state
  function grown(t) {
    if (t !== play.token) return;
    play.grown = true;
    if (play.mountLater) play.mountLater();
    play.waitT = setTimeout(() => { if (t === play.token && !play.revealed) viewer.classList.add("waiting"); }, 200);
    play.safety = setTimeout(() => ready(t), 9000);   // never strand anyone on the poster
    settle(t);
  }
  // stop whatever is playing or still loading for the film on the stage
  function dropMedia(swap) {                         // swap: the next film was already started by the swipe
    clearTimeout(play.waitT); clearTimeout(play.safety);
    play = { token: play.token + 1 };                  // anything still loading for this film is ignored
    pendingMount = null;
    if (ytPlayer && ytPlayer === ytKeep) {           // phones: keep the player, just stop it
      if (!(swap && ytPre)) { ytPre = null; try { ytKeep.pauseVideo(); } catch (_) {} }
      ytPlayer = null;
    } else if (ytPlayer && ytPlayer.destroy) { try { ytPlayer.destroy(); } catch (_) {} ytPlayer = null; }
    ytCur = null;
    ytWrap.hidden = true;
    clearMedia();
    viewer.classList.remove("loaded", "waiting");
    if (soundBtn) soundBtn.hidden = true;
  }

  let stageBox = null, linesAt = [0, 0, 0, 0];   // where the stage is laid out / the beams were sent (no reads back)
  function setStage(x, y, w, h) {
    stageBox = { x, y, w, h };
    stage.style.left = x + "px"; stage.style.top = y + "px";
    stage.style.width = w + "px"; stage.style.height = h + "px";
  }
  function setLines(top, bottom, left, right) {   // transforms, so the beams glide on the compositor
    linesAt = [top, bottom, left, right];
    vLeadT.style.transform = `translateY(${top}px)`; vLeadB.style.transform = `translateY(${bottom}px)`;
    vLeadL.style.transform = `translateX(${left}px)`; vLeadR.style.transform = `translateX(${right}px)`;
  }
  function bigRect(aspect) {
    const a = aspect > 0 ? aspect : 0.5625;
    const vw = window.innerWidth, vh = window.innerHeight;
    // a film with a scene strip leaves room for it under the film (strip 46px + gap 16px + air)
    const c = typeof film === "number" ? items[film] : null;
    const room = c && c.v.type === "youtube" && window.STORYBOARDS && window.STORYBOARDS[c.v.id] ? 84 : 0;
    const tw = Math.min(vw * 0.92, 1320);
    const th = Math.min(vh * 0.82 - room, tw * a);
    const fw = Math.min(tw, th / a), fh = fw * a;
    return { x: (vw - fw) / 2, y: (vh - fh - room) / 2, w: fw, h: fh };
  }

  /* The film on the stage is one of ALL the films (not just this page's five): you can swipe through
     every one of them, and closing lands back in its own tile — the reel turns to that tile's page
     and brings it on screen behind the frosted glass first, so the film always has a home to go to. */
  let film = -1;                 // index into items
  let phase = "closed";          // "grid" (beams forming) → "grow" → "open"; "closing"
  let closeT = null;
  function posterFor(c, apply) {
    const i = pageItems.indexOf(c), el = clipEls[i];
    const bg = el && el._poster && el._poster.style.backgroundImage;
    if (bg && bg !== "none") { apply(bg); return; }
    // not on this page: the small cover straight away, the big one if YouTube has it
    if (c.v.thumbFallback) apply(`url("${c.v.thumbFallback}")`);
    const u = c.thumb || c.v.thumb; if (!u) return;
    const im = new Image();
    im.onload = () => { if (im.naturalWidth > 200 && items[film] === c) apply(`url("${u}")`); };
    im.src = u;
  }
  /* Grid frames: as the yellow grid locks onto the film, the eight boxes around it fill with stills from
     the film, one after another clockwise from top-left (in story order), each easing back slowly. When the
     film grows they are pushed out to the screen edges, away from it. Stills: storyboards.js `cells`. */
  const cells = document.createElement("div");
  cells.className = "v-cells"; cells.setAttribute("aria-hidden", "true");
  cells.innerHTML = "<i><b></b></i>".repeat(8);
  if (vAmb) vAmb.after(cells); else viewer.prepend(cells);
  const cellEls = [...cells.children];
  const CELL_ORDER = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
  let cellTok = 0;
  // the grid is an even 3x3 over the whole screen: the film sits in the middle box, the frames fill the
  // other eight — all the same size
  // Phones show two whole frames instead of eight cropped ones: the film's box is a full 16:9, with one
  // frame above and one below it (side by side when the phone is turned), each the film's size, uncropped.
  const mobileGrid = () => touchUI || window.innerWidth < 700;
  const MG = 10;                                         // gap between the film and a frame on phones
  function gridRect() {
    const W = window.innerWidth, H = window.innerHeight;
    let w = W / 3, h = H / 3;
    if (mobileGrid()) {
      const M = 16, a = 9 / 16;
      w = H >= W ? Math.min(W - 2 * M, (H - 2 * M - 2 * MG) / 3 / a) : Math.min((W - 2 * M - 2 * MG) / 3, (H - 2 * M) / a);
      h = w * a;
    }
    const left = (W - w) / 2, top = (H - h) / 2;
    return { left, top, right: left + w, bottom: top + h, width: w, height: h };
  }
  function showCells(c, g) {
    hideCells();
    const sb = c && c.v.type === "youtube" && window.STORYBOARDS && window.STORYBOARDS[c.v.id];
    if (!sb || !sb.cells || sb.cells.length < 8) return;
    const t = ++cellTok, GAP = 8, t0 = performance.now();
    // computers: nine equal boxes, the whole screen in thirds
    const xs = [0, g.left, g.right, window.innerWidth], ys = [0, g.top, g.bottom, window.innerHeight];
    // phones: just two, the film's size — above/below it (upright) or either side (turned)
    const two = mobileGrid(), port = window.innerHeight >= window.innerWidth;
    const spots = !two ? null : port ? { 1: [g.left, g.top - g.height - MG], 5: [g.left, g.bottom + MG] }
                                     : { 7: [g.left - g.width - MG, g.top], 3: [g.right + MG, g.top] };
    cells.classList.toggle("fit", two);
    CELL_ORDER.forEach(([col, row], n) => {
      const el = cellEls[n];
      let x = xs[col] + GAP, y = ys[row] + GAP, w = xs[col + 1] - xs[col] - 2 * GAP, h = ys[row + 1] - ys[row] - 2 * GAP;
      // phones: the earlier moment above / on the left, the later one below / on the right, in that order
      const first = two && (n === 1 || n === 7), still = two ? (first ? 1 : 5) : n;
      if (two) { if (!spots[n]) { el.hidden = true; return; } [x, y] = spots[n]; w = g.width; h = g.height; }
      el.classList.remove("in");
      if (w < 48 || h < 40) { el.hidden = true; return; }
      el.hidden = false;
      el.style.left = x + "px"; el.style.top = y + "px"; el.style.width = w + "px"; el.style.height = h + "px";
      el.style.setProperty("--dx", col - 1); el.style.setProperty("--dy", row - 1);   // pushed straight away from the film
      el.firstChild.style.backgroundImage = `url("${sb.cells[still]}")`;
      // crop toward the subject (a tall phone box shows only a slice of a wide frame)
      const f = sb.focus && sb.focus[still];
      el.firstChild.style.backgroundPosition = f ? `${(f[0] * 100).toFixed(1)}% ${(f[1] * 100).toFixed(1)}%` : "";
      // each lands on its beat once the lines have nearly arrived — and never before its still has loaded
      const due = t0 + (reducedMotion ? 400 : 750 + (two ? (first ? 0 : 280) : n * 110));
      const im = new Image(); im.src = sb.cells[still];
      const go = () => { if (t === cellTok) setTimeout(() => { if (t === cellTok) el.classList.add("in"); }, Math.max(0, due - performance.now())); };
      if (im.decode) im.decode().then(go, go); else im.onload = go;
    });
    cells.classList.remove("out"); cells.classList.add("on");
  }
  function pushCells() { cellTok++; cells.classList.add("out"); }
  function hideCells() { cellTok++; cells.classList.remove("on", "out"); cellEls.forEach((el) => el.classList.remove("in")); }

  /* Scene strip under the open film: ten of its scenes (the scrub's storyboard frames) in a glass row.
     Tap or drag along it to jump the film there; a yellow playhead follows the film as it plays. */
  const strip = document.createElement("div");
  strip.className = "v-strip"; strip.setAttribute("aria-label", "Scenes");
  strip.innerHTML = '<div class="v-strip-row"></div><i class="v-strip-head"></i><span class="v-strip-time"></span>';
  stage.appendChild(strip);
  const stripRow = strip.firstChild, stripHead = strip.querySelector(".v-strip-head"), stripTime = strip.querySelector(".v-strip-time");
  let stripSB = null, stripPoll = 0, stripDrag = null;
  function fmtT(s) { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function buildStrip(c) {
    clearInterval(stripPoll);
    const sb = c && c.v.type === "youtube" && window.STORYBOARDS && window.STORYBOARDS[c.v.id];
    stripSB = sb && sb.sheets && sb.sheets.length ? sb : null;
    strip.hidden = !stripSB;
    if (!stripSB) return;
    const W = parseFloat(stage.style.width) || stage.offsetWidth, TH = strip.offsetHeight || 46;
    // ten scenes on a computer; fewer, wider ones on a phone (a 36px box is too thin to read)
    const N_SCENES = Math.max(5, Math.min(10, Math.round(W / 64)));
    // each frame COVERS its box and is centred in it: scaling by width alone left a phone's narrow boxes
    // taller than the frame, so the neighbouring frames of the sprite sheet showed through (2–4 per box)
    const tw = W / N_SCENES, sc = Math.max(tw / sb.w, TH / sb.h), per = sb.cols * sb.rows;
    const ox = (tw - sb.w * sc) / 2, oy = (TH - sb.h * sc) / 2;
    stripRow.innerHTML = "";
    for (let k = 0; k < N_SCENES; k++) {
      const idx = Math.min(sb.count - 1, Math.floor((k + 0.5) / N_SCENES * sb.count));
      const sh = Math.floor(idx / per), j = idx - sh * per;
      const t = document.createElement("span");
      t.style.backgroundImage = `url("${sb.sheets[Math.min(sh, sb.sheets.length - 1)]}")`;
      t.style.backgroundSize = `${(sb.cols * sb.w * sc).toFixed(1)}px ${(sb.rows * sb.h * sc).toFixed(1)}px`;
      t.style.backgroundPosition = `${(ox - (j % sb.cols) * sb.w * sc).toFixed(1)}px ${(oy - Math.floor(j / sb.cols) * sb.h * sc).toFixed(1)}px`;
      stripRow.appendChild(t);
    }
    setHead(0);
    stripPoll = setInterval(() => {                    // the playhead follows the film (YouTube's own clock)
      if (stripDrag || !ytPlayer || !ytPlayer.getCurrentTime) return;
      try { const d = ytPlayer.getDuration() || stripSB.duration; setHead(ytPlayer.getCurrentTime() / d); } catch (_) {}
    }, 400);
  }
  function setHead(p) {
    p = Math.max(0, Math.min(1, p));
    stripHead.style.transform = `translateX(${(p * strip.offsetWidth).toFixed(1)}px)`;
    if (stripSB) stripTime.textContent = fmtT(p * stripSB.duration);
    stripTime.style.transform = `translateX(${Math.max(0, Math.min(strip.offsetWidth - 52, p * strip.offsetWidth - 26)).toFixed(1)}px)`;
    return p;
  }
  function stripP(e) { const r = strip.getBoundingClientRect(); return (e.clientX - r.left) / r.width; }
  strip.addEventListener("pointerdown", (e) => {
    if (!stripSB) return;
    e.stopPropagation();
    try { strip.setPointerCapture(e.pointerId); } catch (_) {}
    stripDrag = { id: e.pointerId, p: setHead(stripP(e)) };
    strip.classList.add("dragging");
  });
  strip.addEventListener("pointermove", (e) => { if (stripDrag && e.pointerId === stripDrag.id) stripDrag.p = setHead(stripP(e)); });
  function stripUp(e) {
    if (!stripDrag || e.pointerId !== stripDrag.id) return;
    const p = stripDrag.p; stripDrag = null;
    strip.classList.remove("dragging");
    if (e.type === "pointercancel") return;
    try {                                              // jump the film there and keep it playing
      const d = (ytPlayer && ytPlayer.getDuration && ytPlayer.getDuration()) || stripSB.duration;
      ytPlayer.seekTo(p * d, true); ytPlayer.playVideo();
    } catch (_) {}
    if (window.cnHaptic) window.cnHaptic(10);
  }
  strip.addEventListener("pointerup", stripUp);
  strip.addEventListener("pointercancel", stripUp);

  function showPoster(c) {
    posterFor(c, (bg) => {
      stage.style.backgroundImage = bg;
      const u = /url\(["']?([^"')]+)["']?\)/.exec(bg || "");   // the film's own colours light the frosted backdrop
      if (vAmb) { if (u && window.cnSoftBg) window.cnSoftBg(vAmb, u[1]); else vAmb.style.backgroundImage = bg; }
    });
    // the neighbours' covers are ready before the swipe
    [film - 1, film + 1].forEach((j) => { const n = items[j]; if (n && (n.thumb || n.v.thumb)) new Image().src = n.thumb || n.v.thumb; });
    buildStrip(c);
  }
  function canFilm(dir) { const j = film + dir; return j >= 0 && j < items.length; }
  function markFilmEnds() {
    viewer.classList.toggle("at-first", !canFilm(-1));
    viewer.classList.toggle("at-last", !canFilm(1));
  }
  // the tile this film closes back into, on screen (turning the reel's page / scrolling while unseen)
  function sourceTile() {
    const c = items[film]; if (!c) return lastFocused;
    let i = pageItems.indexOf(c);
    if (i < 0) { renderPage(Math.ceil((film + 1) / PAGE_SIZE) * PAGE_SIZE); i = pageItems.indexOf(c); }
    const el = clipEls[i]; if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - window.innerHeight / 2, behavior: "instant" });
      el._centred = true;                               // its reel tilt is a frame behind: measure it flat
    }
    lastFocused = el;
    return el;
  }
  function tileRect(el) {
    if (!el) return null;
    if (!el._centred) return el.getBoundingClientRect();
    el._centred = false;
    const tf = el.style.transform; el.style.transform = "none";
    const r = el.getBoundingClientRect(); el.style.transform = tf;
    return r;
  }

  function openViewer(el, c) {
    if (phase === "closing") hardReset();             // a new film while the last one is still shrinking away
    clearTimeout(closeT);
    viewerOpen = true;
    lastFocused = el;
    film = items.indexOf(c);
    stopPreview(el);
    // opened straight after scrubbing it: the film starts where the scrub left it
    const seek = window.cnScrub ? window.cnScrub.takeSeek(el) : null;
    if (window.cnScrub) window.cnScrub.reset(el);

    // start over the small clip; lines begin OUT at the screen edges (invisible frame)
    const r = el.getBoundingClientRect();
    setStage(r.left, r.top, r.width, r.height);
    setLines(0, window.innerHeight, 0, window.innerWidth);
    stage.style.backgroundImage = el._poster ? el._poster.style.backgroundImage : "none";
    if (vAmb) {
      const u = /url\(["']?([^"')]+)["']?\)/.exec(stage.style.backgroundImage || "");
      if (u && window.cnSoftBg) window.cnSoftBg(vAmb, u[1]); else vAmb.style.backgroundImage = stage.style.backgroundImage;
    }
    clearMedia();

    cursor.classList.remove("show", "big"); cursorShown = false;   // hide the ring over the player
    viewer.hidden = false;
    viewer.style.pointerEvents = "";
    viewer.classList.remove("loaded", "waiting", "ready");
    markFilmEnds();
    if (soundBtn) soundBtn.hidden = true;
    void viewer.offsetWidth;         // commit the edge start frame
    viewer.classList.add("open");
    document.body.style.overflow = "hidden";
    phase = "grid";

    // BEAT 1: lines glide inward from the edges to frame the film (the grid forms); the film eases into
    // the centre box, and the eight boxes around it fill with frames from the film
    const g = gridRect();
    viewer.classList.add("gridding");
    requestAnimationFrame(() => {
      if (phase !== "grid" || vfxOn()) return;
      setStage(g.left, g.top, g.width, g.height);
      setLines(g.top, g.bottom, g.left, g.right);
    });
    showCells(c, g);

    // BEAT 2: once the grid has been seen, grow the film + spread the lines back outward, pushing the frames off
    const GRID_HOLD = 2900;
    stage._grow = setTimeout(() => {
      phase = "grow";
      viewer.classList.remove("gridding");
      pushCells();
      const B = bigRect(clipAspect(c));
      setStage(B.x, B.y, B.w, B.h);
      setLines(B.y, B.y + B.h, B.x, B.x + B.w);
    }, GRID_HOLD);

    // the film starts loading now, hidden, so it buffers while the grid and the grow play
    const t = ++play.token;
    play = { token: t, seek: seek || 0 };
    mountPlayer(c, t);

    // BEAT 3 (same moment as always): the stage has grown — show the film if it's ready,
    // otherwise the poster gets the liquid loading state until it is
    stage._timer = setTimeout(() => {
      if (t !== play.token) return;
      phase = "open";
      viewer.classList.add("ready"); filmReady();                  // swipe / arrows / handle are live from here
      showPoster(c);                                   // (warms the neighbours' covers)
      grown(t);
    }, GRID_HOLD + 1250);

    closeBtn.focus();
  }

  function closeViewer() {
    hideCells(); viewer.classList.remove("gridding");
    if (viewer.hidden || phase === "closing") return;
    // anything still moving (the opening, a drag, a swipe) reverses from where it is on screen right now
    if (phase !== "open" || vfxOn()) { springClose({ x: 0, y: 0 }); return; }
    clearTimeout(stage._timer);
    clearTimeout(stage._grow);
    dropMedia();
    phase = "closing";

    // reverse: shrink back to wherever the clip now sits, lines close in
    const r = tileRect(sourceTile());
    if (r) { setStage(r.left, r.top, r.width, r.height); setLines(r.top, r.bottom, r.left, r.right); }
    viewer.classList.remove("open", "loaded", "waiting", "ready");
    viewer.style.pointerEvents = "none";            // the page is usable again right away
    document.body.style.overflow = "";

    closeT = setTimeout(() => {
      viewer.hidden = true;
      viewer.style.pointerEvents = "";
      phase = "closed";
      viewerOpen = false;
      activeIdx = -1;               // force preview + target to reattach
      refresh();
      if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
    }, 1100);
  }

  /* ---------- Viewer physics: drag down to close, swipe to the next film ----------
     The opening above stays a CSS sequence (its slow timing is the look). The moment a finger takes
     hold — or anything interrupts the opening — the viewer switches to springs (.vfx): the stage keeps
     its laid-out box and moves by transform, the beams chase its edges, the backdrop follows --va.
     Every spring starts from what is on screen right now, so nothing ever has to finish first. */
  const PF = window.PlightFX || {};
  const reducedV = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const noGlassV = window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
  const V = PF.Spring ? {
    x: new PF.Spring(0, 0.5), y: new PF.Spring(0, 0.5), s: new PF.Spring(1, 0.002),
    a: new PF.Spring(1, 0.004),          // backdrop + chrome: 1 shown, 0 gone
    sp: new PF.Spring(0, 0.002),         // beams: 0 on the stage's edges, 1 out at the screen's edges
    off: new PF.Spring(0, 0.002),        // what is left of the beams' own head start when the springs took over
  } : null;
  let box = null, beamDelta = [0, 0, 0, 0], vraf = null, vlast = 0, vEnd = null, pendingFilm = 0;
  const beamsEls = [vLeadT, vLeadB, vLeadL, vLeadR];
  function vfxOn() { return viewer.classList.contains("vfx"); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function stageEdges() {                          // the stage's live edges: laid-out box + springs
    const cx = box.x + box.w / 2 + V.x.x, cy = box.y + box.h / 2 + V.y.x, hw = box.w * V.s.x / 2, hh = box.h * V.s.x / 2;
    return [cy - hh, cy + hh, cx - hw, cx + hw];
  }
  function vRender() {
    stage.style.transform = `translate3d(${V.x.x.toFixed(2)}px, ${V.y.x.toFixed(2)}px, 0) scale(${V.s.x.toFixed(4)})`;
    const a = clamp01(V.a.x), sp = clamp01(V.sp.x), off = V.off.x;
    viewer.style.setProperty("--va", a.toFixed(3));
    if (!isTouch && !noGlassV) viewer.style.backdropFilter = viewer.style.webkitBackdropFilter = `blur(${(26 * a).toFixed(1)}px) saturate(${(1 + 0.6 * a).toFixed(2)})`;
    const e = stageEdges(), far = [0, window.innerHeight, 0, window.innerWidth];
    beamsEls.forEach((b, k) => {
      const v = e[k] + (far[k] - e[k]) * sp + beamDelta[k] * off;
      b.style.transform = (k < 2 ? "translateY(" : "translateX(") + v.toFixed(1) + "px)";
      b.style.opacity = (0.95 * a * (1 - sp * 0.5)).toFixed(3);
    });
  }
  function vLoop(now) {
    const dt = Math.min(0.05, (now - vlast) / 1000); vlast = now;
    Object.values(V).forEach((s) => s.tick(dt));
    if (pendingFilm && (Math.abs(V.x.x) >= window.innerWidth * 0.92 || V.x.done())) swapFilm();
    vRender();
    if (Object.values(V).every((s) => s.done()) && !pendingFilm && !vd) {
      Object.values(V).forEach((s) => s.jump(s.target));
      vRender(); vraf = null;
      const f = vEnd; vEnd = null; if (f) f();
      return;
    }
    vraf = requestAnimationFrame(vLoop);
  }
  function vKick() { if (!vraf) { vlast = performance.now(); vraf = requestAnimationFrame(vLoop); } }

  // springs take over from the CSS: read the presentation values (the opening may be mid-flight) and pin them
  function takeOver() {
    if (vfxOn()) return;
    let b = stageBox, lines = linesAt.slice(), a = 1;
    if (phase === "grid" || phase === "grow") {
      clearTimeout(stage._grow); clearTimeout(stage._timer);
      pushCells(); viewer.classList.remove("gridding");     // a finger took the film: the frames make way
      const cs = getComputedStyle(stage);
      b = { x: parseFloat(cs.left), y: parseFloat(cs.top), w: parseFloat(cs.width), h: parseFloat(cs.height) };
      lines = beamsEls.map((el, k) => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); return k < 2 ? m.m42 : m.m41; });
      const bg = /rgba?\(([^)]+)\)/.exec(getComputedStyle(viewer).backgroundColor);
      const alpha = bg ? parseFloat(bg[1].split(",")[3] == null ? 1 : bg[1].split(",")[3]) : 1;
      a = clamp01(alpha / (noGlassV ? 0.96 : 0.62));
    }
    viewer.classList.add("vfx");
    setStage(b.x, b.y, b.w, b.h);
    box = stageBox;
    V.x.jump(0); V.y.jump(0); V.s.jump(1); V.a.jump(a);
    // the beams: how far out they still are (the grid forming), and whatever is left over rides on `off`
    const e = [b.y, b.y + b.h, b.x, b.x + b.w], far = [0, window.innerHeight, 0, window.innerWidth];
    let sp = 0, n = 0;
    e.forEach((v, k) => { const span = far[k] - v; if (Math.abs(span) > 20) { sp += (lines[k] - v) / span; n++; } });
    sp = phase === "grid" && n ? clamp01(sp / n) : 0;
    V.sp.jump(sp);
    beamDelta = e.map((v, k) => lines[k] - (v + (far[k] - v) * sp));
    V.off.jump(1); V.off.to(0, { response: 0.3 });
    vRender(); vKick();
  }
  // springs at rest on the open film → hand the viewer back to the CSS, with nothing visibly changing
  function backToRest() {
    if (phase !== "open" || !vfxOn() || vd) return;
    stage.style.transform = "";
    const B = stageBox;
    viewer.style.removeProperty("--va");
    viewer.style.backdropFilter = viewer.style.webkitBackdropFilter = "";
    beamsEls.forEach((b) => { b.style.opacity = ""; });
    setLines(B.y, B.y + B.h, B.x, B.x + B.w);
    viewer.classList.remove("vfx");
  }
  function hardReset() {                             // drop everything at once (a new film interrupting a close)
    hideCells(); viewer.classList.remove("gridding");
    if (vraf) { cancelAnimationFrame(vraf); vraf = null; }
    vEnd = null; pendingFilm = 0; vd = null;
    clearTimeout(closeT);
    viewer.classList.remove("vfx", "open", "ready", "loaded", "waiting");
    stage.style.transform = ""; stage.style.opacity = "";
    viewer.style.removeProperty("--va");
    viewer.style.backdropFilter = viewer.style.webkitBackdropFilter = "";
    beamsEls.forEach((b) => { b.style.opacity = ""; });
    viewer.hidden = true; phase = "closed";
  }

  // close from wherever the stage is: shrink into its tile (handing over the finger's velocity)
  function springClose(vel) {
    if (!V) { phase = "open"; viewer.classList.remove("vfx"); closeViewer(); return; }
    const from = phase;
    takeOver();
    clearTimeout(stage._grow); clearTimeout(stage._timer);
    dropMedia();
    if (pendingFilm) { pendingFilm = 0; }
    phase = "closing";
    viewer.classList.remove("open", "ready");
    viewer.style.pointerEvents = "none";
    document.body.style.overflow = "";
    const r = tileRect(sourceTile());
    if (r && box.w) {
      const s = Math.sqrt((r.width * r.height) / (box.w * box.h));
      V.x.to(r.left + r.width / 2 - (box.x + box.w / 2), { velocity: vel.x, response: 0.42 });
      V.y.to(r.top + r.height / 2 - (box.y + box.h / 2), { velocity: vel.y, response: 0.42 });
      V.s.to(s, { response: 0.42 });
    } else {                                           // no tile to land in: sink away in the direction it went
      V.y.to(V.y.x + (vel.y >= 0 ? 1 : -1) * window.innerHeight * 0.25, { velocity: vel.y });
      V.s.to(0.9);
      stage.animate && stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
    }
    V.a.to(0, { response: 0.32 });
    // interrupted while the grid was still forming: the beams go back out the way they came
    V.sp.to(from === "grid" ? 1 : 0, { response: 0.45 });
    vEnd = finishSpringClose;
    if (reducedV && viewer.animate) {                // reduced motion: no travel, a short fade
      viewer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).onfinish = finishSpringClose;
      vEnd = null;
    }
    vKick();
  }
  function finishSpringClose() {
    if (phase !== "closing") return;
    viewer.hidden = true;
    viewer.style.pointerEvents = "";
    viewer.classList.remove("vfx", "loaded", "waiting");
    stage.style.transform = ""; stage.style.opacity = "";
    stage.getAnimations && stage.getAnimations().forEach((an) => an.cancel());
    viewer.style.removeProperty("--va");
    viewer.style.backdropFilter = viewer.style.webkitBackdropFilter = "";
    beamsEls.forEach((b) => { b.style.opacity = ""; });
    V.x.jump(0); V.y.jump(0); V.s.jump(1); V.a.jump(1); V.sp.jump(0); V.off.jump(0);
    phase = "closed";
    viewerOpen = false;
    activeIdx = -1;
    refresh();
    if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
  }
  // let go during the opening without closing: carry on growing, now as a spring
  function resumeGrow(vel) {
    const B = bigRect(clipAspect(items[film]));
    const s = Math.sqrt((B.w * B.h) / (box.w * box.h));
    V.x.to(B.x + B.w / 2 - (box.x + box.w / 2), { damping: 0.8, response: 0.5, velocity: vel.x });
    V.y.to(B.y + B.h / 2 - (box.y + box.h / 2), { damping: 0.8, response: 0.5, velocity: vel.y });
    V.s.to(s, { response: 0.5 }); V.a.to(1, { response: 0.35 }); V.sp.to(0, { response: 0.5 });
    vEnd = () => {
      setStage(B.x, B.y, B.w, B.h); box = stageBox;
      V.x.jump(0); V.y.jump(0); V.s.jump(1); vRender();
      phase = "open";
      viewer.classList.add("ready"); filmReady();
      showPoster(items[film]);
      grown(play.token);
      backToRest();
    };
    vKick();
  }

  /* ---------- next / previous film without closing ---------- */
  function nudgeFilm(dir) {                          // nothing that way: a short push that springs straight back
    takeOver();
    V.x.to(0, { damping: 0.62, response: 0.34, velocity: -dir * 1100 });
    vEnd = backToRest; vKick();
  }
  function goFilm(dir, velocity) {
    if (phase !== "open" || !V) return;
    if (pendingFilm) swapFilm();                      // a fast second press finishes the first instantly
    if (!canFilm(dir)) { nudgeFilm(dir); return; }
    takeOver();
    try { if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); } catch (_) {}
    const v = mediaBox.querySelector("video"); if (v) v.pause();
    // phones: start the next film now, inside this swipe's touch — later it could only play muted
    const nx = items[film + dir];
    if (isTouch && ytKeep && keptReady && nx && nx.v.type === "youtube") { ytPre = { id: nx.v.id }; startKept(nx.v.id, 0); }
    pendingFilm = dir;
    if (reducedV) { swapFilm(); return; }
    V.x.to(-dir * window.innerWidth, { response: 0.32, velocity: velocity || 0 });
    V.sp.to(1, { response: 0.3 });                   // the beams let go and spread to the screen edges
    vKick();
  }
  function swapFilm() {
    const dir = pendingFilm; pendingFilm = 0;
    film += dir;
    const c = items[film];
    dropMedia(true);
    const B = bigRect(clipAspect(c));
    setStage(B.x, B.y, B.w, B.h); box = stageBox;
    showPoster(c);
    markFilmEnds();
    try {                                              // the sheen sweeps the new film
      stage.animate([{ opacity: 1, backgroundPosition: "130% 0" }, { opacity: 1, backgroundPosition: "-130% 0" }],
        { duration: 1100, easing: "cubic-bezier(.16,1,.3,1)", pseudoElement: "::before" });
    } catch (_) {}
    const vx = V.x.v;
    V.x.jump(dir * window.innerWidth * 0.6);          // enter from the side it was thrown toward
    V.x.to(0, { response: 0.36, velocity: vx * 0.6 });
    V.y.to(0); V.s.to(1); V.a.to(1, { response: 0.3 });
    V.sp.to(0, { response: 0.55 });                  // and the beams close in to frame it
    if (reducedV && stage.animate) { V.x.jump(0); stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240 }); }
    // the new film loads exactly like an opened one: hidden, then shown once it plays
    const t = ++play.token;
    play = { token: t };
    mountPlayer(c, t);
    grown(t);
    vEnd = backToRest;
    vKick();
  }
  if (vPrev) vPrev.addEventListener("click", (e) => { e.stopPropagation(); goFilm(-1); });
  if (vNext) vNext.addEventListener("click", (e) => { e.stopPropagation(); goFilm(1); });

  /* ---------- direct manipulation (anywhere but the film itself: YouTube keeps its own gestures) ---------- */
  let vd = null, vJustDragged = false;

  /* Phones close a film by dragging it down (the CLOSE button is hidden there, kept for screen readers).
     To make that obvious: a "Swipe down to close" label above the film with an arrow bobbing toward the
     handle, a one-time dip-and-spring of the film the first time it opens, and while dragging the label
     turns into a yellow "Release to close" once letting go WILL close it (a light tick on Android).
     After one drag-close on this phone the label stops showing; the handle stays. */
  const hint = document.createElement("div");
  hint.className = "v-hint"; hint.setAttribute("aria-hidden", "true");
  hint.innerHTML = '<span class="a">Swipe down to close</span><span class="b">Release to close</span><i class="v-hint-ch"></i>';
  stage.appendChild(hint);
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } };
  let dragLearned = store("cnDragClose") === "1", nudged = false;
  function filmReady() {                             // the film has arrived and can be grabbed
    if (!isTouch) return;
    viewer.classList.toggle("hinting", !dragLearned);
    if (dragLearned || nudged || reducedV || !stage.animate) return;
    nudged = true;                                    // once per visit: the film dips toward the gesture and springs back
    setTimeout(() => {
      if (phase !== "open" || vd || vfxOn()) return;
      stage.animate([{ translate: "0 0" }, { translate: "0 22px", offset: 0.38 }, { translate: "0 -4px", offset: 0.72 }, { translate: "0 0" }],
        { duration: 1100, easing: "cubic-bezier(.33,0,.2,1)" });
    }, 650);
  }
  function setWillClose(on) {
    if (viewer.classList.contains("will-close") === on) return;
    viewer.classList.toggle("will-close", on);
    if (on && window.cnHaptic) window.cnHaptic(8);
  }
  viewer.addEventListener("pointerdown", (e) => {
    if (!V || viewer.hidden || phase === "closing" || phase === "closed" || e.button > 0) return;
    if (e.target.closest("button, a, iframe, video, .v-strip")) return;
    vd = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, hist: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
    stage.getAnimations && stage.getAnimations().forEach((an) => { if (an.effect && an.effect.getKeyframes()[1] && "translate" in an.effect.getKeyframes()[1]) an.cancel(); });
  });
  viewer.addEventListener("pointermove", (e) => {
    if (!vd || e.pointerId !== vd.id) return;
    const dx = e.clientX - vd.x0, dy = e.clientY - vd.y0;
    if (!vd.axis) {
      if (Math.hypot(dx, dy) < 10) return;             // hysteresis before committing to a direction
      const axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis === "x" && phase !== "open") { vd = null; return; }   // no swiping until the film has arrived
      vd.axis = axis;
      try { viewer.setPointerCapture(e.pointerId); } catch (_) {}
      if (pendingFilm) swapFilm();
      takeOver();
      vEnd = null;
      // grab from wherever the stage is right now, and keep the grabbed spot under the finger
      vd.bx = V.x.x; vd.by = V.y.x; vd.ba = V.a.x;
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      vd.lx = (vd.x0 - cx - V.x.x) / V.s.x; vd.ly = (vd.y0 - cy - V.y.x) / V.s.x;
    }
    vd.hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (vd.hist.length > 6) vd.hist.shift();
    if (vd.axis === "x") {
      let nx = vd.bx + dx;
      if (!canFilm(nx < 0 ? 1 : -1)) nx = PF.rubberband(nx, Math.max(320, window.innerWidth));   // first / last film: stretch
      V.x.jump(nx);
    } else {
      const H = window.innerHeight, travel = vd.by + dy;
      const s = 1 - Math.min(0.25, Math.abs(travel) / H * 0.5);
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      V.s.jump(s);
      V.x.jump(e.clientX - cx - vd.lx * s); V.y.jump(e.clientY - cy - vd.ly * s);
      V.a.jump(Math.min(vd.ba, 1 - Math.min(1, Math.abs(travel) / (H * 0.6))));   // backdrop, glow and beams fade with it
      setWillClose(Math.abs(travel + PF.project(PF.velocity(vd.hist).y)) > 180);   // same test as the release
    }
    vRender(); vKick();
  });
  function vRelease(e) {
    if (!vd || e.pointerId !== vd.id) return;
    const d = vd; vd = null;
    if (!d.axis) return;                               // a tap, not a drag
    vJustDragged = true; setTimeout(() => { vJustDragged = false; }, 0);
    const v = e.type === "pointercancel" ? { x: 0, y: 0 } : PF.velocity(d.hist);
    if (d.axis === "x") {
      const end = V.x.x + PF.project(v.x), dir = end < 0 ? 1 : -1;
      if (e.type !== "pointercancel" && Math.abs(end) > window.innerWidth * 0.3 && canFilm(dir)) {
        goFilm(dir, v.x);
        if (window.cnHaptic) window.cnHaptic(10);   // the swipe committed: same frame as the film leaving
      } else {
        V.x.to(0, { damping: 0.8, response: 0.32, velocity: canFilm(dir) ? v.x : v.x * 0.4 });
        vEnd = backToRest; vKick();
      }
      return;
    }
    const end = V.y.x + PF.project(v.y);
    setWillClose(false);
    if (e.type !== "pointercancel" && Math.abs(end) > 180) {
      if (isTouch && !dragLearned) { dragLearned = true; store("cnDragClose", "1"); viewer.classList.remove("hinting"); }
      springClose(v); return;
    }
    if (phase === "open") {                           // not far enough: back into place, a little bounce from the throw
      V.x.to(0, { damping: 0.8, response: 0.32, velocity: v.x });
      V.y.to(0, { damping: 0.8, response: 0.32, velocity: v.y });
      V.s.to(1); V.a.to(1, { response: 0.3 });
      vEnd = backToRest; vKick();
    } else resumeGrow(v);                             // grabbed during the opening: finish arriving
  }
  viewer.addEventListener("pointerup", vRelease);
  viewer.addEventListener("pointercancel", vRelease);
  viewer.addEventListener("dragstart", (e) => e.preventDefault());
  // a drag that ends over the backdrop must not count as "click outside to close"
  viewer.addEventListener("click", (e) => { if (vJustDragged) { e.stopPropagation(); e.preventDefault(); } }, true);

  closeBtn.addEventListener("click", closeViewer);
  viewer.addEventListener("click", (e) => { if (e.target === viewer) closeViewer(); });
  document.addEventListener("keydown", (e) => {
    if (viewer.hidden || phase === "closing") return;
    if (e.key === "Escape") closeViewer();
    else if (e.key === "ArrowLeft") { e.preventDefault(); goFilm(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); goFilm(1); }
  });
  window.cnViewer = { state: () => ({ phase, film, vfx: vfxOn(), hidden: viewer.hidden, x: V ? V.x.x : 0, y: V ? V.y.x : 0, s: V ? V.s.x : 1, seek: play.seek || 0 }) };   // tests / debugging

  /* ---------- STILLS: concert contact sheets + photo lightbox ---------- */
  const concertsData = (typeof CONCERTS !== "undefined" && Array.isArray(CONCERTS)) ? CONCERTS : [];
  const concertsWrap = document.getElementById("concerts");
  const shotEls = {};                                   // "ci:si" → visible preview tile
  let openPhoto = function () {};                       // set up below once the lightbox exists
  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  // one cover per concert, like an album grid; it opens the full gallery (show.html)
  if (concertsWrap) {
    concertsWrap.classList.add("still-grid");
    let last = null; try { last = sessionStorage.getItem("cn_last_concert"); } catch (_) {}
    concertsData.forEach((con, ci) => {
      const shots = con.shots || [];
      const cover = con.cover || shots[0]; if (!cover) return;
      const card = document.createElement("a"); card.className = "still-card"; card.href = "show.html?c=" + ci;
      const meta = [con.venue, con.date].filter(Boolean).map(esc).join(" · ");
      card.innerHTML =
        `<img class="still-img" loading="lazy" alt="${esc(con.artist || "still")}" src="${esc((con.dir || "") + "thumb/" + cover)}">` +
        `<span class="still-count">${shots.length}</span>` +
        `<span class="still-cap"><b class="still-artist">${esc(con.artist || "")}</b>` + (meta ? `<small>${meta}</small>` : "") + `</span>`;
      const img = card.querySelector("img");
      img.onerror = () => { img.onerror = null; img.src = (con.dir || "") + cover; };
      // the cover flies into the gallery (view transition): only the card you open carries the name
      if (String(ci) === last) img.style.viewTransitionName = "still-cover";
      card.addEventListener("click", () => {
        document.querySelectorAll(".still-img").forEach((im) => { im.style.viewTransitionName = ""; });
        img.style.viewTransitionName = "still-cover";
        try { sessionStorage.setItem("cn_last_concert", String(ci)); } catch (_) {}
      });
      flipThrough(card, con, shots, cover);
      concertsWrap.appendChild(card);
    });
  }

  /* Drag (or, on a computer, move the mouse) across a concert cover to flip through its photos without
     opening the gallery. Twelve shots spread across the set keep it light; a tap still opens the gallery. */
  function flipThrough(card, con, shots, cover) {
    if (shots.length < 2) return;
    const N = Math.min(12, shots.length);
    const pick = Array.from({ length: N }, (_, k) => shots[Math.floor(k * shots.length / N)]);
    const url = (f) => (con.dir || "") + "thumb/" + f;
    const flip = document.createElement("img");
    flip.className = "still-flip"; flip.alt = ""; flip.decoding = "async";
    card.insertBefore(flip, card.querySelector(".still-count"));
    const count = card.querySelector(".still-count"), total = shots.length;
    let warmed = false, cur = -1, drag = null, swallow = false;
    const warm = () => { if (!warmed) { warmed = true; pick.forEach((f) => { new Image().src = url(f); }); } };
    function show(p) {
      const k = Math.max(0, Math.min(N - 1, Math.floor(p * N)));
      if (k === cur) return;
      cur = k;
      flip.src = url(pick[k]);
      card.classList.add("flipping");
      count.textContent = String(Math.floor(k * total / N) + 1).padStart(2, "0") + " / " + total;
      if (drag && window.cnHaptic) window.cnHaptic(6, 60);
    }
    function rest() { cur = -1; card.classList.remove("flipping"); count.textContent = total; }
    const pAt = (e, r) => (e.clientX - r.left) / r.width;
    card.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary || e.button !== 0) return;
      warm(); swallow = false;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, r: null };
    });
    card.addEventListener("pointermove", (e) => {
      if (drag && e.pointerId === drag.id) {
        const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        if (!drag.on) {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
            drag.on = true; drag.r = card.getBoundingClientRect();
            try { card.setPointerCapture(e.pointerId); } catch (_) {}
          } else if (Math.abs(dy) > 10) { drag = null; return; }
          else return;
        }
        show(pAt(e, drag.r));
        return;
      }
      if (e.pointerType === "mouse" && !e.buttons && matchMedia("(hover: hover)").matches) {
        warm(); show(pAt(e, card.getBoundingClientRect()));
      }
    });
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.on) { swallow = true; setTimeout(rest, 700); }
      drag = null;
    };
    card.addEventListener("pointerup", up);
    card.addEventListener("pointercancel", up);
    card.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !drag) rest(); });
    card.addEventListener("click", (e) => { if (swallow) { swallow = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    card.addEventListener("dragstart", (e) => e.preventDefault());
  }

  const plight = document.getElementById("plight");
  const plightImg = document.getElementById("plightImg");
  const plightCaption = document.getElementById("plightCaption");
  const plightCount = document.getElementById("plightCount");
  let pCon = 0, pShot = 0;

  function showPhoto() {
    const con = concertsData[pCon]; if (!con) return;
    const shots = con.shots || []; if (!shots.length) return;
    const wrap = (i) => ((i % shots.length) + shots.length) % shots.length;
    pShot = wrap(pShot);
    plightImg.src = (con.dir || "") + shots[pShot];
    plightCaption.textContent = [con.artist, con.venue, con.date].filter(Boolean).join(" · ");
    plightCount.textContent = String(pShot + 1).padStart(2, "0") + " / " + String(shots.length).padStart(2, "0");
    [pShot + 1, pShot - 1].forEach((i) => { new Image().src = (con.dir || "") + shots[wrap(i)]; });   // neighbours ready before the swipe
  }

  if (plight) {
    const fx = PlightFX({
      root: plight, stage: document.getElementById("plightStage"), img: plightImg,
      step: (dir) => { pShot += dir; showPhoto(); },
      count: () => ((concertsData[pCon] || {}).shots || []).length,
      index: () => pShot,                               // stops at the first / last photo (rubber band), no wrap
      sourceEl: () => shotEls[pCon + ":" + pShot] || null,
      onClosed: () => { plightImg.src = ""; document.body.style.overflow = ""; },
    });
    openPhoto = function (ci, si, el) { pCon = ci; pShot = si; showPhoto(); document.body.style.overflow = "hidden"; fx.open(el); };
    document.getElementById("plightPrev").addEventListener("click", () => fx.go(-1));
    document.getElementById("plightNext").addEventListener("click", () => fx.go(1));
    document.getElementById("plightClose").addEventListener("click", () => fx.close());
    plight.addEventListener("click", (e) => { if (e.target === plight) fx.close(); });
    document.addEventListener("keydown", (e) => {
      if (plight.hidden) return;
      if (e.key === "Escape") fx.close();
      else if (e.key === "ArrowLeft") fx.go(-1);
      else if (e.key === "ArrowRight") fx.go(1);
    });
  }

  /* ---------- SUB-PAGES: clip-sized tiles under the films (SOCIAL, RESTAURANT) ---------- */
  (function subPages() {
    const wrap = document.getElementById("subpagesWrap");
    const host = document.getElementById("subpages");
    const data = (typeof SUBPAGES !== "undefined" && Array.isArray(SUBPAGES)) ? SUBPAGES : [];
    if (!wrap || !host) return;
    if (!data.length) { wrap.hidden = true; return; }

    data.forEach((c) => {
      const el = document.createElement("a");
      el.className = "clip link-tile";
      el.href = c.link;
      el.setAttribute("aria-label", "Open " + (c.title || "page"));
      const poster = document.createElement("div");
      poster.className = "poster";
      if (c.thumb) poster.style.backgroundImage = `url("${c.thumb}")`;
      el.appendChild(poster);
      const lab = document.createElement("div");
      lab.className = "link-label";
      lab.innerHTML = '<span class="ll-title">' + esc(c.title || "") + '</span>' +
                      '<span class="ll-sub">' + esc(c.sub || "") + ' <span class="ar">\u2197</span></span>';
      // long words (RESTAURANT) have to shrink or they run off the tile
      lab.style.setProperty("--len", String((c.title || "").length || 6));
      el.appendChild(lab);
      const idx = () => clipEls.length + subEls.indexOf(el);
      el.addEventListener("mouseenter", () => { cursor.classList.add("big"); hoverIdx = idx(); refresh(); });
      el.addEventListener("mouseleave", () => { cursor.classList.remove("big"); if (hoverIdx === idx()) { hoverIdx = -1; refresh(); } });
      host.appendChild(el);
      subEls.push(el);
      subItems.push(c);
    });
    refresh();                 // the brackets can reach the tiles from now on
  })();

  /* ---------- Contact email: one tap copies it ----------
     A glass "Copied ✓" pill materialises where you tapped and floats away; a small glass popover,
     grown out of the same spot, offers Copy (again) / Email (opens the mail app). */
  (function emailCopy() {
    const link = document.querySelector("[data-email-link]");
    if (!link || !SITE.email) return;
    const addr = SITE.email;
    function legacyCopy(t) {                           // no async clipboard (old Safari, http): a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
      let done = false; try { done = document.execCommand("copy"); } catch (_) {}
      ta.remove(); return done;
    }
    function copy(t) {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => legacyCopy(t));
      return Promise.resolve(legacyCopy(t));
    }
    function pill(x, y, text) {
      const el = document.createElement("div");
      el.className = "copied-pill"; el.setAttribute("role", "status"); el.textContent = text;
      el.style.left = x + "px"; el.style.top = y + "px";
      document.body.appendChild(el);
      el.addEventListener("animationend", () => el.remove());
      setTimeout(() => el.remove(), 2400);              // reduced motion / no animation: still goes
    }
    function copyAt(x, y) {
      copy(addr).then((done) => {
        pill(x, y, done ? "Copied ✓" : addr);       // couldn't copy: at least show the address to select
        if (done && window.cnHaptic) window.cnHaptic(12);
      });
    }

    // the popover: built once, anchored to the email, grows out of the point that was tapped
    const pop = document.createElement("div");
    pop.className = "email-pop"; pop.hidden = true; pop.setAttribute("role", "menu");
    pop.innerHTML = '<button type="button" role="menuitem" data-act="copy">Copy</button>' +
      `<a role="menuitem" data-act="mail" href="mailto:${addr}">Email ↗</a>`;
    document.body.appendChild(pop);
    let shut = 0;
    function openPop(x, y) {
      clearTimeout(shut);
      const r = link.getBoundingClientRect();
      pop.hidden = false;
      const pw = pop.offsetWidth, sx = window.scrollX, sy = window.scrollY;
      const left = Math.max(12, Math.min(window.innerWidth - pw - 12, x - pw / 2));
      const top = r.bottom + 12;
      pop.style.left = (left + sx) + "px"; pop.style.top = (top + sy) + "px";
      pop.style.transformOrigin = `${(x - left).toFixed(0)}px ${(y - top).toFixed(0)}px`;   // anchored to its source
      void pop.offsetWidth;
      pop.classList.add("on");
      shut = setTimeout(closePop, 6000);
    }
    function closePop() {
      clearTimeout(shut);
      if (pop.hidden || !pop.classList.contains("on")) return;
      pop.classList.remove("on");                       // dematerialises back into the email
      setTimeout(() => { if (!pop.classList.contains("on")) pop.hidden = true; }, 320);
    }
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const r = link.getBoundingClientRect();
      const x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;   // keyboard: the middle
      copyAt(x, y);
      openPop(x, y);
      if (e.detail === 0) { const b = pop.querySelector("button"); if (b) b.focus({ preventScroll: true }); }
    });
    pop.addEventListener("click", (e) => {
      const t = e.target.closest("[data-act]"); if (!t) return;
      if (t.dataset.act === "copy") {
        const r = t.getBoundingClientRect();
        copyAt(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
      }
      setTimeout(closePop, t.dataset.act === "copy" ? 250 : 0);
    });
    document.addEventListener("pointerdown", (e) => { if (!pop.hidden && !pop.contains(e.target) && !link.contains(e.target)) closePop(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
    window.addEventListener("scroll", () => { if (!pop.hidden) closePop(); }, { passive: true });
  })();

  /* ---------- ARTISTS: everyone we've worked with ---------- */
  (function artistList() {
    const wrap = document.getElementById("artistList");
    const data = (typeof ARTISTS !== "undefined" && Array.isArray(ARTISTS)) ? ARTISTS : [];
    if (!wrap || !data.length) return;

    data.forEach((a, i) => {
      const row = document.createElement("div"); row.className = "artist";
      row.innerHTML = '<span class="a-idx">' + String(i + 1).padStart(2, "0") + '</span>' +
                      '<span class="a-name">' + esc(a.name || "") + '</span>';

      const links = document.createElement("span"); links.className = "a-links";
      [["spotify", "Spotify"], ["youtube", "YouTube"], ["instagram", "Instagram"]].forEach(([k, label]) => {
        if (!a[k]) return;                                  // no link → no chip
        const el = document.createElement("a");
        el.className = "a-link"; el.textContent = label;
        el.href = a[k]; el.target = "_blank"; el.rel = "noopener";
        links.appendChild(el);
      });
      row.appendChild(links);
      wrap.appendChild(row);
    });
  })();

  /* NEXT SHOOTS (shows.js): upcoming shows, soonest first; a show drops off the day after its date and the
     section stays hidden when nothing is coming up. The soonest one wears a yellow NEXT UP (TONIGHT on the day). */
  (function nextShoots() {
    const sec = document.getElementById("shows"), list = document.getElementById("showList");
    const data = (typeof SHOWS !== "undefined" && Array.isArray(SHOWS)) ? SHOWS : [];
    if (!sec || !list) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
    const up = data.map((s) => ({ ...s, d: day(s.date) })).filter((s) => s.d && s.d >= today).sort((a, b) => a.d - b.d);
    if (!up.length) return;
    const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    up.forEach((s, i) => {
      const row = document.createElement("div"); row.className = "show-row" + (i === 0 ? " next" : "");
      const tonight = +s.d === +today;
      row.innerHTML =
        '<span class="sh-date"><b>' + String(s.d.getDate()).padStart(2, "0") + '</b><i>' + MON[s.d.getMonth()] + '</i></span>' +
        '<span class="sh-main"><span class="sh-artist">' + esc(s.artist || "") + '</span>' +
        '<span class="sh-where">' + esc([s.venue, s.city].filter(Boolean).join(" · ")) + '</span></span>' +
        (i === 0 ? '<span class="sh-tag">' + (tonight ? "TONIGHT" : "NEXT UP") + '</span>' : "");
      if (s.link) {
        const a = document.createElement("a");
        a.className = "a-link sh-link"; a.textContent = "Tickets \u2197";
        a.href = s.link; a.target = "_blank"; a.rel = "noopener";
        row.appendChild(a);
      }
      list.appendChild(row);
    });
    sec.hidden = false;
  })();

  /* GRADE (grades.js): before / after the colour grade, right after the films. One big frame — raw on
     the left of the yellow line, graded on the right — and thumbnails to pick another. The line sweeps in
     the first time the section comes into view; then it follows the mouse (computers) or a sideways drag
     (phones: the page still scrolls up and down), or the arrow keys. Opacity / clip-path / transform only. */
  (function gradeSection() {
    const sec = document.getElementById("grade"), st = document.getElementById("grStage"), thumbs = document.getElementById("grThumbs");
    const data = ((typeof GRADES !== "undefined" && Array.isArray(GRADES)) ? GRADES : []).filter((g) => g && g.before && g.after);
    if (!sec || !st || !data.length) return;
    const after = st.querySelector(".gr-after"), before = st.querySelector(".gr-before"), line = st.querySelector(".gr-line");
    const film = sec.querySelector(".gr-film"), count = sec.querySelector(".gr-count");
    const fine = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    let idx = 0, p = 0.5, raf = 0, seen = false, drag = null;
    const set = (v) => { p = Math.max(0, Math.min(1, v)); st.style.setProperty("--sx", (p * 100).toFixed(2) + "%"); line.setAttribute("aria-valuenow", Math.round(p * 100)); };
    function sweep(from, to, ms) {
      cancelAnimationFrame(raf);
      if (reducedMotion) { set(to); return; }
      const t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); set(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }
    function show(i, animate) {
      idx = i; const g = data[i];
      st.classList.add("swap");                       // a quick dip, then the new frame
      setTimeout(() => {
        after.src = g.after; before.src = g.before;
        after.alt = (g.film ? g.film + " — " : "") + "graded"; before.alt = (g.film ? g.film + " — " : "") + "raw";
        st.classList.remove("swap");
        if (animate) sweep(1, 0.5, 1000);
      }, animate === false ? 0 : 160);
      film.textContent = [g.film, g.artist].filter(Boolean).join(" \u2014 ");
      count.textContent = data.length > 1 ? String(i + 1).padStart(2, "0") + " / " + String(data.length).padStart(2, "0") : "";
      [...thumbs.children].forEach((b, k) => { b.classList.toggle("on", k === i); b.setAttribute("aria-pressed", k === i); });
    }
    if (data.length > 1) data.forEach((g, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "gr-thumb"; b.setAttribute("aria-label", (g.film || "Frame") + " " + (i + 1));
      b.style.backgroundImage = `url("${g.after}")`;
      b.addEventListener("click", () => { if (i !== idx) show(i, true); });
      thumbs.appendChild(b);
    });
    data.forEach((g) => { new Image().src = g.after; new Image().src = g.before; });   // all frames ready to switch to
    set(1); show(0, false);
    // the first time it comes into view: the line sweeps in from the right, revealing the grade
    new IntersectionObserver((es, io) => {
      if (!es[0].isIntersecting || seen) return;
      seen = true; io.disconnect(); setTimeout(() => sweep(1, 0.5, 1300), 250);
    }, { threshold: 0.45 }).observe(st);
    // the side "skip to stills / other work" pills would float over the frame: they step aside while it's on screen
    new IntersectionObserver((es) => document.body.classList.toggle("grade-in", es[0].isIntersecting), { threshold: 0.15 }).observe(st);
    const at = (e) => { const r = drag ? drag.r : st.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    // computers: the line just follows the mouse across the frame
    if (fine) st.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && !drag) { cancelAnimationFrame(raf); set(at(e)); } });
    // phones (and click-drag): a sideways drag moves the line; up / down is still the page's scroll
    st.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && fine) return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, r: st.getBoundingClientRect() };
    });
    st.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.on) {
        const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // scrolling the page
        if (Math.abs(dx) < 6) return;
        drag.on = true; cancelAnimationFrame(raf); st.classList.add("dragging");
        try { st.setPointerCapture(e.pointerId); } catch (_) {}
      }
      set(at(e));
    });
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.on && e.type === "pointerup") { cancelAnimationFrame(raf); sweep(p, at(e), 380); }   // a tap: glide there
      drag = null; st.classList.remove("dragging");
    };
    st.addEventListener("pointerup", up); st.addEventListener("pointercancel", up);
    line.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); cancelAnimationFrame(raf); set(p + (e.key === "ArrowRight" ? 0.05 : -0.05)); }
    });
    sec.hidden = false;
  })();

  /* ---------- Structured data for the work itself ----------
     The films and artists live in clips.js / artists.js, so the only way to put
     them in front of a crawler without keeping a second copy in the HTML is to
     build the JSON-LD from the same arrays at runtime. Google renders the page
     before indexing, so it reads this; it is a second pass, which is why the
     brand's own Organization block stays static in index.html. */
  (function workSchema() {
    const films = (Array.isArray(CLIPS) ? CLIPS : []).filter((c) => c.url && c.title);
    if (!films.length) return;
    const artists = (typeof ARTISTS !== "undefined" && Array.isArray(ARTISTS)) ? ARTISTS : [];

    const data = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Music videos by " + SITE.name,
      itemListElement: films.map((c, i) => {
        const work = { "@type": "CreativeWork", name: c.title, url: c.url,
          genre: "Music video", producer: { "@type": "Organization", name: SITE.name } };
        if (c.artist) work.creator = { "@type": "Person", name: c.artist };
        return { "@type": "ListItem", position: i + 1, item: work };
      }),
    };
    if (artists.length) {
      data.about = artists.filter((a) => a.name).map((a) => {
        const p = { "@type": "Person", name: a.name };
        const links = [a.spotify, a.instagram, a.youtube].filter(Boolean);
        if (links.length) p.sameAs = links;
        return p;
      });
    }
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
  })();

  /* ---------- Scroll cue: names whatever section is next, so nothing below looks like the end ---------- */
  (function scrollCue() {
    const btn = document.getElementById("goMore");
    if (!btn) return;
    const label = btn.querySelector(".ss-label");

    const hasTiles = typeof SUBPAGES !== "undefined" && Array.isArray(SUBPAGES) && SUBPAGES.length;
    const stops = [
      hasTiles ? { el: document.getElementById("subpagesWrap"), text: "Scroll for other work", short: "Other work" } : null,
      { el: document.getElementById("stills"), text: "Scroll for stills", short: "Stills" },
    ].filter((s) => s && s.el);
    if (!stops.length) { btn.remove(); return; }

    let stop = null;
    const phone = window.matchMedia("(max-width: 760px)");   // phones get the short label in a small pill

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!stop) return;
      const root = document.documentElement;
      const prevSnap = root.style.scrollSnapType;
      root.style.scrollSnapType = "none";
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const r = stop.el.getBoundingClientRect();
      // centre the tiles; land on the top edge of a full section like the stills
      const dest = stop.el.id === "stills"
        ? r.top + window.scrollY
        : r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
      window.scrollTo({ top: Math.max(0, dest), behavior: reduce ? "instant" : "smooth" });
      setTimeout(() => { root.style.scrollSnapType = prevSnap; }, 1100);
    });

    // the next stop is the first one whose top is still below the fold
    let tops = null;                                         // cached offsets, dropped when the layout changes
    layoutJobs.push(() => { tops = null; });
    function sync() {
      if (!tops) tops = stops.map((s) => s.el.offsetTop);
      const edge = window.scrollY + vh * 0.75;
      const i = tops.findIndex((t) => t > edge), next = i < 0 ? null : stops[i];
      if (next !== stop) {
        stop = next;
        if (stop) { label.textContent = phone.matches ? stop.short : stop.text; btn.href = "#" + stop.el.id; }
        btn.classList.toggle("gone", !stop);
      }
    }
    onFrame.push(sync);
    sync();
    btn.classList.toggle("gone", !stop);
  })();

  /* ---------- Corner button: "Skip to stills" going down, "Back to top" once you're there ---------- */
  (function skipStills() {
    const btn = document.getElementById("skipStills");
    const stills = document.getElementById("stills");
    if (!btn || !stills) return;
    const label = btn.querySelector(".ss-label");
    const arrow = btn.querySelector(".ar");
    let atStills = false;                       // false → jumps down to stills, true → jumps back to top

    function glideTo(dest, hash) {
      const root = document.documentElement;
      // mobile keeps `scroll-snap-type: y proximity`, which can drag the page
      // back onto a clip mid-flight — suspend it until we have landed.
      const prevSnap = root.style.scrollSnapType;
      root.style.scrollSnapType = "none";
      // "instant", not "auto" — auto defers to html{scroll-behavior:smooth} and animates anyway
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: dest, behavior: reduce ? "instant" : "smooth" });
      history.replaceState(null, "", hash);
      setTimeout(() => { root.style.scrollSnapType = prevSnap; }, 1100);
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (atStills) glideTo(0, location.pathname + location.search);
      else glideTo(stills.getBoundingClientRect().top + window.scrollY, "#stills");
    });

    // once the stills are reached — and everywhere below them — the button turns round
    let stillsTop = null;
    layoutJobs.push(() => { stillsTop = null; });
    function sync() {
      if (stillsTop === null) stillsTop = stills.offsetTop;
      const reached = window.scrollY >= stillsTop - vh * 0.2;
      if (reached === atStills) return;
      atStills = reached;
      btn.classList.toggle("up", reached);
      btn.href = reached ? "#top" : "#stills";
      if (label) label.textContent = reached ? "Back to top" : "Skip to stills";
      if (arrow) arrow.textContent = reached ? "\u2191" : "\u2193";
    }

    // the offset is re-read whenever the layout changes — swapping the reel to a shorter page moves the stills up
    onFrame.push(sync);
    sync();
  })();

  /* ---------- Go ---------- */
  refresh();
})();
