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
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
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
    return el;
  }

  function renderPage(p) {
    page = ((p % pageCount) + pageCount) % pageCount;      // wraps back round to the first five
    clipEls.forEach(stopPreview);
    reel.innerHTML = "";
    clipEls.length = 0;
    pageItems.length = 0;
    hoverIdx = -1;
    activeIdx = -1;                                        // force the HUD + target to reattach

    items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).forEach((c, i) => {
      const el = buildClip(c, i);
      reel.appendChild(el);
      clipEls.push(el);
      pageItems.push(c);
    });

    // one bar per film on this page
    barsWrap.innerHTML = "";
    bars = clipEls.map(() => { const b = document.createElement("i"); barsWrap.appendChild(b); return b; });

    if (pageCount > 1) reel.appendChild(buildMoreButton());
    refresh();          // reattach HUD + target to the new set straight away
  }

  function buildMoreButton() {
    const next = (page + 1) % pageCount;
    const count = items.slice(next * PAGE_SIZE, next * PAGE_SIZE + PAGE_SIZE).length;
    const btn = document.createElement("button");
    btn.className = "reel-more";
    btn.innerHTML = '<span class="rm-label">' +
        (next === 0 ? "Back to the first " + count : "Next " + count + " films") +
      '</span><span class="ar" aria-hidden="true">' + (next === 0 ? "\u2191" : "\u2193") + '</span>' +
      '<span class="ec tl"></span><span class="ec tr"></span><span class="ec bl"></span><span class="ec br"></span>';
    btn.addEventListener("click", () => goToPage(page + 1));
    return btn;
  }

  // fade the reel out, swap the films and land at the top while nobody can see it, fade back in
  let swapping = false;
  function goToPage(next) {
    if (swapping) return;                                  // ignore double-clicks mid-swap
    swapping = true;
    chrome.classList.add("hide");                          // brackets + HUD step aside for the swap
    hud.classList.add("hide");
    reel.classList.add("swap");

    const FADE = 300;                                      // keep in step with .reel's transition
    setTimeout(() => {
      renderPage(next);
      (document.scrollingElement || document.documentElement).scrollTop = 0;   // invisible jump
      setTimeout(() => {                                   // timer, not rAF — rAF stalls in background tabs
        reel.classList.remove("swap");
        swapping = false;
        refresh();                                         // target + HUD land on the new first film
      }, 20);
    }, FADE);
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
  const CORNER = 18, cornerAt = [];
  function positionTarget(i, r) {
    const el = elAt(i); if (!el) return;
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
    corners.forEach((c, k) => c.animate([{ opacity: 0, translate: LOCK_FROM[k].join(" ") }, { opacity: 1, translate: "0 0" }],
      { duration: 450, easing: "cubic-bezier(.16,1,.3,1)" }));
  }

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
  function refresh() {
    if (viewerOpen || swapping) return;
    // during the opening the brackets ride the films' rise on the compositor (opening.js), already parked
    // on their final place — reading rects here would measure the moving films and count the rise twice
    if (html.classList.contains("opening-run")) return;
    const { best, bestD, rects } = nearestToCenter();
    const useHover = hoverIdx >= 0;
    const a = useHover ? hoverIdx : best;
    const show = a >= 0 && (useHover || bestD < window.innerHeight * 0.7);

    chrome.classList.toggle("hide", !show);
    hud.classList.toggle("hide", !show);

    if (a >= 0 && show) {
      if (a !== activeIdx) setActive(a);
      positionTarget(a, rects[a]);
    }

  }

  /* Everything that follows the scroll runs in ONE frame callback, never straight in the scroll event:
     by the time a scroll event fires the page may have pending style, and reading positions there
     forced a recalculation on every event. Section offsets are cached until the layout changes. */
  const onFrame = [];                       // cheap per-frame jobs that only read cached numbers
  let vh = window.innerHeight;              // innerHeight itself can force a style pass in a scroll event
  const layoutJobs = [];                    // re-measure when the page's size changes (images, fonts, paging)
  if (window.ResizeObserver) new ResizeObserver(() => layoutJobs.forEach((f) => f())).observe(document.body);
  const after = window.cnScrollFrame = [];  // fx.js (depth, scrollspy) joins this same frame
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame((now) => {
      ticking = false;
      const y = window.scrollY;             // the frame's one fresh read; fx.js reuses it after the writes
      onFrame.forEach((f) => f()); refresh();
      after.forEach((f) => f(now, y));
    });
  }, { passive: true });
  window.addEventListener("resize", () => { vh = window.innerHeight; layoutJobs.forEach((f) => f()); onFrame.forEach((f) => f()); refresh(); });

  window.cnRefresh = refresh;   // opening.js puts the brackets back on the films once the opening is over
  renderPage(0);          // first five films (everything above must exist before this runs)
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
  };
  // the API is a chain of scripts: fetch it once the opening is over and the page is idle, not while it
  // plays (a phone's main thread is busiest right then). Opening a film earlier loads it on the spot.
  (function preloadYT() {
    const idle = () => (window.requestIdleCallback ? requestIdleCallback(loadYTApi, { timeout: 2000 }) : setTimeout(loadYTApi, 300));
    if (html.classList.contains("opening")) setTimeout(idle, 2600); else idle();
  })();

  /* The film starts loading the moment you click, hidden and muted, so it buffers during the
     grid + grow animation instead of after it. It is shown only once the stage has grown AND the
     film is actually playing; until then the poster shows a liquid loading state (.waiting). */
  let play = { token: 0 };
  const soundBtn = document.getElementById("vSound");
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
      mediaBox.innerHTML = '<div id="ytHost"></div>';
      let primed = false;
      ytPlayer = new YT.Player("ytHost", {
        videoId: c.v.id, width: "100%", height: "100%",
        playerVars: { autoplay: 1, mute: 1, controls: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 1, iv_load_policy: 3 },
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
              ? () => { try { p.seekTo(0, true); p.playVideo(); } catch (_) {} soundBtn.hidden = false; }
              : () => { try { p.seekTo(0, true); p.unMute(); p.setVolume(100); p.playVideo(); } catch (_) {} };
            ready(t);
          },
        },
      });
    } else if (c.v.type === "vimeo") {
      // Vimeo would autoplay with sound while still hidden, so it is mounted when the stage has grown
      play.mountLater = () => {
        mediaBox.innerHTML = `<iframe src="${c.v.player}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
        mediaBox.querySelector("iframe").addEventListener("load", () => setTimeout(() => ready(t), 400), { once: true });
      };
    } else {
      mediaBox.innerHTML = `<video src="${c.v.player}" controls playsinline preload="auto" muted></video>`;
      const v = mediaBox.querySelector("video");
      v.addEventListener("canplay", () => ready(t), { once: true });
      play.start = () => { v.currentTime = 0; v.muted = false; const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play(); }); };
    }
  }

  function setStage(x, y, w, h) {
    stage.style.left = x + "px"; stage.style.top = y + "px";
    stage.style.width = w + "px"; stage.style.height = h + "px";
  }
  function setLines(top, bottom, left, right) {   // transforms, so the beams glide on the compositor
    vLeadT.style.transform = `translateY(${top}px)`; vLeadB.style.transform = `translateY(${bottom}px)`;
    vLeadL.style.transform = `translateX(${left}px)`; vLeadR.style.transform = `translateX(${right}px)`;
  }
  function bigRect(aspect) {
    const a = aspect > 0 ? aspect : 0.5625;
    const vw = window.innerWidth, vh = window.innerHeight;
    const tw = Math.min(vw * 0.92, 1320);
    const th = Math.min(vh * 0.82, tw * a);
    const fw = Math.min(tw, th / a), fh = fw * a;
    return { x: (vw - fw) / 2, y: (vh - fh) / 2, w: fw, h: fh };
  }

  function openViewer(el, c) {
    viewerOpen = true;
    lastFocused = el;
    stopPreview(el);

    // start over the small clip; lines begin OUT at the screen edges (invisible frame)
    const r = el.getBoundingClientRect();
    setStage(r.left, r.top, r.width, r.height);
    setLines(0, window.innerHeight, 0, window.innerWidth);
    stage.style.backgroundImage = el._poster ? el._poster.style.backgroundImage : "none";
    const amb = document.getElementById("vAmb");      // the film's own colours light the frosted backdrop
    if (amb) {
      const u = /url\(["']?([^"')]+)["']?\)/.exec(stage.style.backgroundImage || "");
      if (u && window.cnSoftBg) window.cnSoftBg(amb, u[1]); else amb.style.backgroundImage = stage.style.backgroundImage;
    }
    mediaBox.innerHTML = "";

    cursor.classList.remove("show", "big"); cursorShown = false;   // hide the ring over the player
    viewer.hidden = false;
    viewer.classList.remove("loaded", "waiting");
    if (soundBtn) soundBtn.hidden = true;
    void viewer.offsetWidth;         // commit the edge start frame
    viewer.classList.add("open");
    document.body.style.overflow = "hidden";

    // BEAT 1: lines glide inward from the edges to frame the small photo (the grid forms)
    requestAnimationFrame(() => setLines(r.top, r.bottom, r.left, r.right));

    // BEAT 2: once the grid has settled, grow the photo + spread the lines back outward
    const GRID_HOLD = 1450;
    stage._grow = setTimeout(() => {
      const B = bigRect(clipAspect(c));
      setStage(B.x, B.y, B.w, B.h);
      setLines(B.y, B.y + B.h, B.x, B.x + B.w);
    }, GRID_HOLD);

    // the film starts loading now, hidden, so it buffers while the grid and the grow play
    const t = ++play.token;
    play = { token: t };
    mountPlayer(c, t);

    // BEAT 3 (same moment as always): the stage has grown — show the film if it's ready,
    // otherwise the poster gets the liquid loading state until it is
    stage._timer = setTimeout(() => {
      if (t !== play.token) return;
      play.grown = true;
      if (play.mountLater) play.mountLater();
      play.waitT = setTimeout(() => { if (t === play.token && !play.revealed) viewer.classList.add("waiting"); }, 200);
      play.safety = setTimeout(() => ready(t), 9000);   // never strand anyone on the poster
      settle(t);
    }, GRID_HOLD + 1250);

    closeBtn.focus();
  }

  function closeViewer() {
    if (viewer.hidden) return;
    clearTimeout(stage._timer);
    clearTimeout(stage._grow);
    clearTimeout(play.waitT); clearTimeout(play.safety);
    play = { token: play.token + 1 };                  // anything still loading for this film is ignored
    pendingMount = null;
    if (ytPlayer && ytPlayer.destroy) { try { ytPlayer.destroy(); } catch (_) {} ytPlayer = null; }
    mediaBox.innerHTML = "";

    // reverse: shrink back to wherever the clip now sits, lines close in
    const r = lastFocused ? lastFocused.getBoundingClientRect() : null;
    if (r) { setStage(r.left, r.top, r.width, r.height); setLines(r.top, r.bottom, r.left, r.right); }
    viewer.classList.remove("open", "loaded", "waiting");
    if (soundBtn) soundBtn.hidden = true;
    document.body.style.overflow = "";

    setTimeout(() => {
      viewer.hidden = true;
      viewerOpen = false;
      activeIdx = -1;               // force preview + target to reattach
      refresh();
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }, 1100);
  }

  closeBtn.addEventListener("click", closeViewer);
  viewer.addEventListener("click", (e) => { if (e.target === viewer) closeViewer(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !viewer.hidden) closeViewer(); });

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
      concertsWrap.appendChild(card);
    });
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
