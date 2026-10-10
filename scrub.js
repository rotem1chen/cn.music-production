/* CN PROD — scrub a film with your finger (home reel + SOCIAL / RESTAURANT tiles). Touch only: a mouse
   over a film shows its cover and nothing else (hover- and mouse-drag-scrubbing were removed on request).
   Drag sideways across a film tile and it flips through the film's scenes, like scrubbing in Photos,
   without loading the video. Frames come from YouTube's storyboard sprite sheets, copied into the repo
   by `node tools/storyboards.mjs` (storyboards.js → window.STORYBOARDS).

   - Finger drag: down, then >10px sideways commits to the scrub (pointer captured);
     >10px vertical first is the page's scroll (tiles are `touch-action: pan-y`, the browser scrolls natively).
     The frame follows the pointer 1:1: left edge = start, right edge = end.
   - Release: the frame lingers, then fades back to the poster. A tap (no drag) still opens the viewer.
   - Only background-position / transform / opacity change while scrubbing; one rect read per gesture. */
(function () {
  "use strict";
  const SB = window.STORYBOARDS || {};
  const SLOP = 10, LINGER = 650;
  const loaded = {};                                  // sheet url → true once decoded, false while loading
  const waiting = new Set();                          // draws held for a sheet that is still on its way

  function preload(sb) {
    sb.sheets.forEach((u) => {
      if (u in loaded) return;
      loaded[u] = false;
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { loaded[u] = true; waiting.forEach((f) => f()); };
      im.src = u;
    });
  }
  function haptic() {
    if (window.cnHaptic) return window.cnHaptic(8, 70);
    // pages without plight-fx.js: same guard (Android only — iOS has no vibrate API)
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) try { navigator.vibrate(8); } catch (_) {}
  }

  function attach(el, id, opts) {
    const sb = SB[id];
    if (!el || !sb || !sb.sheets || !sb.sheets.length || el._scrub) return null;
    opts = opts || {};
    el.classList.add("scrubbable");
    const per = sb.cols * sb.rows;
    let ui = null, frameEl = null;
    const st = { mode: "idle", pid: -1, x0: 0, y0: 0, rect: null, W: 0, p: 0, frame: -1, sheet: -1, bucket: -1,
                 raf: 0, linger: 0, seek: null, seekUntil: 0, swallow: false };

    function build() {
      ui = document.createElement("div");
      ui.className = "scrub"; ui.setAttribute("aria-hidden", "true");
      ui.innerHTML = '<div class="scrub-frame"></div>';     // just the frame: no timeline, no time label
      frameEl = ui.firstChild;
      frameEl.style.width = sb.w + "px"; frameEl.style.height = sb.h + "px";
      el.appendChild(ui);
    }
    // the gesture takes over: the one layout read (where the tile is now), then only writes
    function begin(mode) {
      if (!ui) build();
      clearTimeout(st.linger);
      st.mode = mode;
      st.rect = el.getBoundingClientRect();
      const W = el.offsetWidth, H = el.offsetHeight;   // laid-out size (the tilt is a transform on top)
      st.W = W;
      // cover the tile like the poster does; 2% over so the sprite's neighbouring frames never bleed in at the edge
      const s = Math.max(W / sb.w, H / sb.h) * 1.02;
      frameEl.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
      st.frame = -1; st.bucket = -1;
      el.classList.add("scrub-on", "scrubbing");
      waiting.add(draw);
      if (opts.onStart) opts.onStart();
    }
    function setP(x) {
      const r = st.rect;
      st.p = Math.max(0, Math.min(1, (x - r.left) / r.width));
      if (!st.raf) st.raf = requestAnimationFrame(draw);
    }
    function draw() {
      st.raf = 0;
      if (!ui) return;
      const p = st.p;
      const idx = Math.min(sb.count - 1, Math.floor(p * sb.count));
      const sh = Math.min(sb.sheets.length - 1, Math.floor(idx / per)), k = idx - sh * per;
      const url = sb.sheets[sh];
      if (loaded[url]) {
        if (sh !== st.sheet) { st.sheet = sh; frameEl.style.backgroundImage = `url("${url}")`; }
        if (idx !== st.frame) {
          st.frame = idx;
          frameEl.style.backgroundPosition = `${-(k % sb.cols) * sb.w}px ${-Math.floor(k / sb.cols) * sb.h}px`;
        }
        el.classList.add("scrub-ready");
      }
      el.dataset.scrubFrame = idx;
      // Android: a very light tick every 10% of the film — only for a deliberate drag
      const b = Math.floor(p * 10);
      if (st.mode === "drag" && st.bucket >= 0 && b !== st.bucket) haptic();
      st.bucket = b;
    }
    function end(linger) {
      waiting.delete(draw);
      el.classList.remove("scrubbing");
      clearTimeout(st.linger);
      const hide = () => { el.classList.remove("scrub-on", "scrub-ready"); };
      if (linger) st.linger = setTimeout(hide, LINGER); else hide();
      st.mode = "idle";
      if (opts.onEnd) opts.onEnd(st.ptype);
    }

    el.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary || e.button !== 0 || e.pointerType === "mouse") return;
      st.swallow = false;
      preload(sb);
      st.mode = "pending"; st.ptype = e.pointerType; st.pid = e.pointerId; st.x0 = e.clientX; st.y0 = e.clientY;
    });
    el.addEventListener("pointermove", (e) => {
      if (st.mode === "pending" && e.pointerId === st.pid) {
        const dx = e.clientX - st.x0, dy = e.clientY - st.y0;
        if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
          begin("drag"); setP(e.clientX);
        } else if (Math.abs(dy) > SLOP) st.mode = "idle";         // it's the page's scroll
        return;
      }
      if (st.mode === "drag" && e.pointerId === st.pid) setP(e.clientX);
    });
    function release(e) {
      if (e.pointerId !== st.pid) return;
      if (st.mode === "drag") {
        st.swallow = true;                                          // the click that follows is not a tap
        st.seek = st.p > 0.01 ? st.p * sb.duration : null;
        st.seekUntil = performance.now() + LINGER + 400;
        end(e.type === "pointerup");
      } else if (st.mode === "pending") st.mode = "idle";
    }
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("click", (e) => {
      if (st.swallow) { st.swallow = false; e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
    el.addEventListener("dragstart", (e) => e.preventDefault());

    return (el._scrub = {
      // seconds to start the film at, if it was just scrubbed by a drag (and the frame is still showing)
      takeSeek() {
        const s = st.seek; st.seek = null;
        return s != null && performance.now() < st.seekUntil ? s : null;
      },
      reset() { if (st.mode !== "idle") end(false); else { clearTimeout(st.linger); el.classList.remove("scrub-on", "scrub-ready"); } },
    });
  }

  window.cnScrub = {
    attach,
    has: (id) => !!(SB[id] && SB[id].sheets && SB[id].sheets.length),
    takeSeek: (el) => (el && el._scrub ? el._scrub.takeSeek() : null),
    reset: (el) => { if (el && el._scrub) el._scrub.reset(); },
  };
})();
