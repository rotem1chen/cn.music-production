/* CN Production — cursor-driven viewfinder reel (SITE + CLIPS from clips.js). */
(function () {
  "use strict";

  /* ---------- Intro (Enter to play with sound, once per session) ---------- */
  (function intro() {
    const el = document.getElementById("intro");
    if (!el) return;
    const video = document.getElementById("introVideo");
    const enter = document.getElementById("introEnter");
    const skip = document.getElementById("introSkip");
    let done = false;

    // already played this session → skip the gate entirely
    if (sessionStorage.getItem("cn_intro_played")) { el.remove(); return; }

    document.body.classList.add("intro-lock");

    function end() {
      if (done) return; done = true;
      try { sessionStorage.setItem("cn_intro_played", "1"); } catch (_) {}
      el.classList.add("done");
      document.body.classList.remove("intro-lock");
      setTimeout(() => el.remove(), 600);
    }

    function start() {
      el.classList.add("playing");
      if (enter) enter.hidden = true;
      if (skip) skip.hidden = false;
      if (!video) return end();
      video.addEventListener("ended", end, { once: true });
      video.addEventListener("error", end, { once: true });
      video.muted = false;                                   // user gesture → sound allowed
      video.volume = 0.3;                                    // quieter intro
      try { video.currentTime = 0; } catch (_) {}
      const p = video.play && video.play();
      if (p && p.catch) p.catch(() => {                      // if playing-with-sound is refused, fall back to muted
        video.muted = true;
        const p2 = video.play && video.play();
        if (p2 && p2.catch) p2.catch(end);
      });
    }

    if (enter) enter.addEventListener("click", start);
    if (skip) skip.addEventListener("click", end);
  })();

  /* ---------- Site text ---------- */
  document.title = SITE.name + " — Music Video Production";
  document.querySelectorAll("[data-brand]").forEach((el) => (el.textContent = SITE.name));
  document.querySelectorAll("[data-mark]").forEach((el) => (el.textContent = SITE.mark || SITE.name));
  document.querySelectorAll("[data-tagline]").forEach((el) => (el.textContent = SITE.tagline));
  const aEl = document.querySelector("[data-about]"); if (aEl) aEl.textContent = SITE.about;
  const yEl = document.querySelector("[data-year]"); if (yEl) yEl.textContent = new Date().getFullYear();
  const emailLink = document.querySelector("[data-email-link]");
  if (emailLink) { emailLink.textContent = SITE.email; emailLink.href = "mailto:" + SITE.email; }

  // logo: use logo.png if present, else fall back to the SVG mark
  const logoPhoto = document.getElementById("logoPhoto");
  const logoFallback = document.getElementById("logoFallback");
  if (logoPhoto) logoPhoto.addEventListener("error", () => {
    logoPhoto.style.display = "none";
    if (logoFallback) logoFallback.style.display = "block";
  });

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

  /* ---------- Build reel ---------- */
  const reel = document.getElementById("work");
  const total = String(items.length).padStart(2, "0");
  const clipEls = [];

  items.forEach((c, i) => {
    const el = document.createElement("div");
    el.className = "clip";
    el.tabIndex = 0;
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

    el.addEventListener("mouseenter", () => {
      cursor.classList.add("big");
      if (animatingScroll) return;                        // ignore enters during the auto-scroll
      if (performance.now() - lastMoveTs > 160) return;   // enter caused by content shifting, not a real move → ignore
      hoverIdx = i;
      scrollToClip(i);
      refresh();
    });
    el.addEventListener("mouseleave", () => {
      cursor.classList.remove("big");
      if (performance.now() - lastMoveTs > 160) return;   // leave caused by content shifting → ignore
      if (hoverIdx === i && !animatingScroll) { hoverIdx = -1; refresh(); }
    });
    el.addEventListener("click", () => openViewer(el, c));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(el, c); } });
    reel.appendChild(el);
    clipEls.push(el);
  });

  /* ---------- Refs ---------- */
  const chrome = document.getElementById("chrome");
  const hud = document.getElementById("hud");
  const target = document.getElementById("target");
  const cursor = document.getElementById("cursor");
  const logoHero = document.getElementById("logoHero");
  const squares = document.getElementById("squares").querySelectorAll("i");
  const hudFormat = document.querySelector("[data-hud-format]");
  const hudTitle = document.querySelector("[data-hud-title]");
  const hudArtist = document.querySelector("[data-hud-artist]");
  const hudIndex = document.querySelector("[data-hud-index]");

  // left indicator: one bar per film, active one lit (shows position + how many left)
  const barsWrap = document.querySelector(".deco-bars");
  barsWrap.innerHTML = "";
  const bars = items.map(() => { const b = document.createElement("i"); barsWrap.appendChild(b); return b; });

  let hoverIdx = -1;
  let activeIdx = -1;
  let viewerOpen = false;
  let animatingScroll = false, scrollRAF = null, lastMoveTs = 0;

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

  function positionTarget(i) {
    const r = clipEls[i].getBoundingClientRect();
    const pad = 10;
    target.style.left = (r.left - pad) + "px";
    target.style.top = (r.top - pad) + "px";
    target.style.width = (r.width + pad * 2) + "px";
    target.style.height = (r.height + pad * 2) + "px";
  }

  function setActive(i) {
    if (clipEls[activeIdx]) { clipEls[activeIdx].classList.remove("active"); stopPreview(clipEls[activeIdx]); }
    activeIdx = i;
    const el = clipEls[i], c = items[i];
    if (!el) return;
    el.classList.add("active");
    // reel shows the still thumbnail only — the video plays when opened
    hudFormat.textContent = c.format || "DIGITAL";
    hudTitle.textContent = c.title || "Untitled";
    hudArtist.textContent = c.artist || "";
    hudIndex.textContent = String(i + 1).padStart(2, "0") + " — " + total;
    bars.forEach((b, j) => b.classList.toggle("on", j === i));
    target.classList.remove("lock"); void target.offsetWidth; target.classList.add("lock");
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
  function nearestToCenter() {
    const fy = window.innerHeight / 2;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < clipEls.length; i++) {
      const r = clipEls[i].getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - fy);
      if (d < bestD) { bestD = d; best = i; }
    }
    return { best, bestD };
  }

  function refresh() {
    if (viewerOpen) return;
    const { best, bestD } = nearestToCenter();
    const useHover = hoverIdx >= 0;
    const a = useHover ? hoverIdx : best;
    const show = a >= 0 && (useHover || bestD < window.innerHeight * 0.7);

    chrome.classList.toggle("hide", !show);
    hud.classList.toggle("hide", !show);

    if (a >= 0 && show) {
      if (a !== activeIdx) setActive(a);
      positionTarget(a);
    }

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const frac = max > 0 ? window.scrollY / max : 0;
    const on = Math.min(squares.length - 1, Math.floor(frac * squares.length));
    squares.forEach((s, i) => s.classList.toggle("on", i === on));
  }

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(() => { refresh(); ticking = false; }); ticking = true; }
  }, { passive: true });
  window.addEventListener("resize", refresh);

  /* ---------- Cursor ring follows the mouse (with a little lag) ---------- */
  let cx = window.innerWidth / 2, cy = window.innerHeight / 2, tx = cx, ty = cy, cursorShown = false;
  window.addEventListener("mousemove", (e) => {
    tx = e.clientX; ty = e.clientY;
    lastMoveTs = performance.now();               // mark genuine mouse movement
    if (viewerOpen) return;                        // ring hidden over the player (iframe eats mouse events)
    if (!cursorShown) { cursorShown = true; cursor.classList.add("show"); }
  });
  window.addEventListener("mouseout", (e) => { if (!e.relatedTarget) { cursorShown = false; cursor.classList.remove("show"); } });
  (function cursorLoop() {
    cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
    cursor.style.left = cx + "px"; cursor.style.top = cy + "px";
    requestAnimationFrame(cursorLoop);
  })();

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
  loadYTApi();

  function mountPlayer(c) {
    if (c.v.type === "youtube") {
      if (!ytApiReady) { pendingMount = () => mountPlayer(c); return; }
      mediaBox.innerHTML = '<div id="ytHost"></div>';
      ytPlayer = new YT.Player("ytHost", {
        videoId: c.v.id, width: "100%", height: "100%",
        playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 1, iv_load_policy: 3 },
        events: {
          onReady: (e) => { try { e.target.playVideo(); } catch (_) {} },
          onStateChange: (e) => { if (e.data === YT.PlayerState.PLAYING) viewer.classList.add("loaded"); },
        },
      });
      setTimeout(() => viewer.classList.add("loaded"), 3000);   // safety fallback
    } else if (c.v.type === "vimeo") {
      mediaBox.innerHTML = `<iframe src="${c.v.player}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      setTimeout(() => viewer.classList.add("loaded"), 1000);
    } else {
      mediaBox.innerHTML = `<video src="${c.v.player}" controls autoplay playsinline></video>`;
      const v = mediaBox.querySelector("video");
      v.addEventListener("playing", () => viewer.classList.add("loaded"), { once: true });
      setTimeout(() => viewer.classList.add("loaded"), 1500);
    }
  }

  function setStage(x, y, w, h) {
    stage.style.left = x + "px"; stage.style.top = y + "px";
    stage.style.width = w + "px"; stage.style.height = h + "px";
  }
  function setLines(top, bottom, left, right) {
    vLeadT.style.top = top + "px"; vLeadB.style.top = bottom + "px";
    vLeadL.style.left = left + "px"; vLeadR.style.left = right + "px";
  }
  function bigRect() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const tw = Math.min(vw * 0.92, 1320);
    const th = Math.min(vh * 0.82, tw * 0.5625);
    const fw = Math.min(tw, th / 0.5625), fh = fw * 0.5625;
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
    mediaBox.innerHTML = "";

    cursor.classList.remove("show", "big"); cursorShown = false;   // hide the ring over the player
    viewer.hidden = false;
    viewer.classList.remove("loaded");
    void viewer.offsetWidth;         // commit the edge start frame
    viewer.classList.add("open");
    document.body.style.overflow = "hidden";

    // BEAT 1: lines glide inward from the edges to frame the small photo (the grid forms)
    requestAnimationFrame(() => setLines(r.top, r.bottom, r.left, r.right));

    // BEAT 2: once the grid has settled, grow the photo + spread the lines back outward
    const GRID_HOLD = 1450;
    stage._grow = setTimeout(() => {
      const B = bigRect();
      setStage(B.x, B.y, B.w, B.h);
      setLines(B.y, B.y + B.h, B.x, B.x + B.w);
    }, GRID_HOLD);

    // BEAT 3: reveal the video once it has grown (poster stays until it's actually playing)
    stage._timer = setTimeout(() => mountPlayer(c), GRID_HOLD + 1250);

    closeBtn.focus();
  }

  function closeViewer() {
    if (viewer.hidden) return;
    clearTimeout(stage._timer);
    clearTimeout(stage._grow);
    pendingMount = null;
    if (ytPlayer && ytPlayer.destroy) { try { ytPlayer.destroy(); } catch (_) {} ytPlayer = null; }
    mediaBox.innerHTML = "";

    // reverse: shrink back to wherever the clip now sits, lines close in
    const r = lastFocused ? lastFocused.getBoundingClientRect() : null;
    if (r) { setStage(r.left, r.top, r.width, r.height); setLines(r.top, r.bottom, r.left, r.right); }
    viewer.classList.remove("open", "loaded");
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
  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  if (concertsWrap) {
    concertsData.forEach((con, ci) => {
      const block = document.createElement("div"); block.className = "concert";
      const head = document.createElement("div"); head.className = "concert-head";
      const meta = [con.venue, con.date].filter(Boolean).map(esc).join(" · ");
      head.innerHTML = `<span class="concert-artist">${esc(con.artist || "")}</span>` + (meta ? `<span class="concert-meta">${meta}</span>` : "");
      block.appendChild(head);
      const grid = document.createElement("div"); grid.className = "concert-grid";
      (con.shots || []).forEach((file, si) => {
        const shot = document.createElement("div"); shot.className = "shot";
        const img = document.createElement("img"); img.loading = "lazy"; img.alt = con.artist || "still";
        img.src = (con.dir || "") + file;
        const idx = document.createElement("span"); idx.className = "sidx"; idx.textContent = String(si + 1).padStart(2, "0");
        shot.append(img, idx);
        shot.addEventListener("click", () => openPhoto(ci, si));
        grid.appendChild(shot);
      });
      block.appendChild(grid);
      concertsWrap.appendChild(block);
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
    pShot = ((pShot % shots.length) + shots.length) % shots.length;
    plightImg.src = (con.dir || "") + shots[pShot];
    plightCaption.textContent = [con.artist, con.venue, con.date].filter(Boolean).join(" · ");
    plightCount.textContent = String(pShot + 1).padStart(2, "0") + " / " + String(shots.length).padStart(2, "0");
  }
  function openPhoto(ci, si) { pCon = ci; pShot = si; showPhoto(); plight.hidden = false; document.body.style.overflow = "hidden"; }
  function closePhoto() { plight.hidden = true; plightImg.src = ""; document.body.style.overflow = ""; }

  if (plight) {
    document.getElementById("plightPrev").addEventListener("click", () => { pShot--; showPhoto(); });
    document.getElementById("plightNext").addEventListener("click", () => { pShot++; showPhoto(); });
    document.getElementById("plightClose").addEventListener("click", closePhoto);
    plight.addEventListener("click", (e) => { if (e.target === plight) closePhoto(); });
    document.addEventListener("keydown", (e) => {
      if (plight.hidden) return;
      if (e.key === "Escape") closePhoto();
      else if (e.key === "ArrowLeft") { pShot--; showPhoto(); }
      else if (e.key === "ArrowRight") { pShot++; showPhoto(); }
    });
  }

  /* ---------- Go ---------- */
  refresh();
})();
