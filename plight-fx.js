/* CN Production — fluid photo lightbox (shared by index, show and media pages).
   The page keeps its own index/caption logic; this file owns the motion:
   - opens out of the tapped thumbnail and closes back into it
   - the photo follows the finger 1:1; a flick throws it to the next one
   - at the first / last photo it stretches and springs back instead of wrapping round
   - drag down to dismiss
   - pinch (or double-tap / double-click) to zoom; while zoomed one finger pans the photo
   - every move is a spring that starts from where the photo is now, so nothing has to finish first
   The Spring, the projection and the rubber band are shared with the film viewer (app.js). */
(function () {
  "use strict";

  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Apple-style spring: damping ratio + response (seconds). Mass 1. */
  function Spring(value, eps) {
    this.x = value; this.v = 0; this.target = value; this.eps = eps || 0.5;
    this.k = 0; this.c = 0; this.set(1, 0.38);
  }
  Spring.prototype.set = function (damping, response) {
    this.k = Math.pow((2 * Math.PI) / response, 2);
    this.c = (4 * Math.PI * damping) / response;
    return this;
  };
  Spring.prototype.to = function (target, opts) {
    opts = opts || {};
    this.set(opts.damping == null ? 1 : opts.damping, opts.response || 0.38);
    this.target = target;
    if (opts.velocity != null) this.v = opts.velocity;
    if (reduced) { this.x = target; this.v = 0; }
  };
  Spring.prototype.jump = function (value) { this.x = this.target = value; this.v = 0; };
  Spring.prototype.tick = function (dt) {
    const h = 1 / 240;
    for (let t = 0; t < dt; t += h) {
      const a = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += a * h; this.x += this.v * h;
    }
  };
  Spring.prototype.done = function () { return Math.abs(this.x - this.target) < this.eps && Math.abs(this.v) < this.eps * 4; };

  /* where a flick comes to rest (Apple's projection, scroll-like deceleration) */
  function project(v, rate) { rate = rate || 0.998; return (v / 1000) * rate / (1 - rate); }
  function rubberband(over, dim) { const c = 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }
  /* release velocity from the last few pointer samples (px/s) */
  function velocity(hist) {
    const a = hist[0], b = hist[hist.length - 1], dt = Math.max(1, b.t - a.t) / 1000;
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }

  /* Haptics: Android only (iOS Safari has no vibration API, so this is a no-op there).
     Very short ticks, only after the visitor has touched the page (Chrome refuses — and logs — before that). */
  const buzz = /Android/i.test(navigator.userAgent || "") && typeof navigator.vibrate === "function";
  let lastBuzz = 0;
  window.cnHaptic = function (ms, minGap) {
    if (!buzz) return false;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    const now = performance.now();
    if (minGap && now - lastBuzz < minGap) return false;
    lastBuzz = now;
    try { return navigator.vibrate(Math.max(8, Math.min(15, ms || 10))); } catch (_) { return false; }
  };

  const noGlass = window.matchMedia && window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
  // phones: the frosting is a fixed-radius layer that fades with the backdrop (style.css, .plight::before) —
  // re-blurring the whole screen at a new radius on every frame of a swipe is too much for a phone GPU
  const touch = window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const MAX_ZOOM = 4, TAP_ZOOM = 2.5;

  window.PlightFX = function (o) {
    const root = o.root, stage = o.stage, img = o.img;
    // sp = how far the yellow beams have spread out toward the screen edges (1) vs locked on the photo (0)
    // zs / zx / zy = the zoom of the photo inside the stage (scale about its centre, then a pan)
    const S = { x: new Spring(0, 0.5), y: new Spring(0, 0.5), s: new Spring(1, 0.002), a: new Spring(0, 0.004), o: new Spring(1, 0.004), sp: new Spring(1, 0.002),
                zs: new Spring(1, 0.002), zx: new Spring(0, 0.5), zy: new Spring(0, 0.5) };

    /* the photo's own colours light the frosted backdrop; four beams of yellow light frame it */
    const amb = document.createElement("div"); amb.className = "p-amb"; amb.setAttribute("aria-hidden", "true");
    root.prepend(amb);
    const beams = ["t", "b", "l", "r"].map((k) => {
      const b = document.createElement("span"); b.className = "p-lead p-lead-" + k; b.setAttribute("aria-hidden", "true");
      root.appendChild(b); return b;
    });
    function lightFrom() {
      const u = img.currentSrc || img.src; if (!u) return;
      if (window.cnSoftBg) window.cnSoftBg(amb, u); else amb.style.backgroundImage = `url("${u}")`;
    }
    function sheen() { stage.classList.remove("sheen"); void stage.offsetWidth; stage.classList.add("sheen"); }
    let raf = null, last = 0, closing = false, source = null, pendingSwap = 0, justDragged = false;
    /* the stage's untransformed box, measured once (open, close, a new photo, rotation) — the beams are
       placed from it and the springs, so a frame never has to read the layout back */
    let base = null, W = window.innerWidth, H = window.innerHeight;
    function measureBase() {                         // hidden (0×0) is not a size worth keeping
      const w = stage.offsetWidth;
      base = w ? { l: stage.offsetLeft, t: stage.offsetTop, w, h: stage.offsetHeight } : null;
    }
    img.addEventListener("load", () => { base = null; if (!root.hidden) kick(); });
    window.addEventListener("resize", () => { base = null; W = window.innerWidth; H = window.innerHeight; });

    /* the ends of the set: pages that pass index() stop at the first / last photo (older callers wrap) */
    function can(dir) {
      const n = o.count ? o.count() : 2;
      if (n < 2) return false;
      if (!o.index) return true;
      const i = o.index() + dir;
      return i >= 0 && i < n;
    }
    function markEnds() {
      root.classList.toggle("at-first", !can(-1));
      root.classList.toggle("at-last", !can(1));
    }

    let zoomTf = "", zoomCls = false;
    function render() {
      stage.style.transform = `translate3d(${S.x.x}px, ${S.y.x}px, 0) scale(${S.s.x})`;
      stage.style.opacity = Math.max(0, Math.min(1, S.o.x));
      const a = Math.max(0, Math.min(1, S.a.x));
      if (noGlass) root.style.backgroundColor = `rgba(0,0,0,${(0.96 * a).toFixed(3)})`;
      else {
        root.style.backgroundColor = `rgba(0,0,0,${(0.6 * a).toFixed(3)})`;
        if (!touch) root.style.backdropFilter = root.style.webkitBackdropFilter = `blur(${(26 * a).toFixed(1)}px) saturate(${(1 + 0.6 * a).toFixed(2)})`;
      }
      amb.style.opacity = (0.85 * a).toFixed(3);
      // the zoom lives on the photo, not the stage, so open / close / swipe keep their own springs
      const zs = S.zs.x;
      const tf = Math.abs(zs - 1) < 0.0005 && Math.abs(S.zx.x) < 0.05 && Math.abs(S.zy.x) < 0.05 ? "" :
        `translate3d(${S.zx.x.toFixed(2)}px, ${S.zy.x.toFixed(2)}px, 0) scale(${zs.toFixed(4)})`;
      if (tf !== zoomTf) { zoomTf = tf; img.style.transform = tf; }
      const z = zs > 1.02;
      if (z !== zoomCls) { zoomCls = z; root.classList.toggle("zoomed", z); }
      // beams ride the photo's edges (wherever it is: zooming, swiping, dragging), spread out when sp → 1
      if (!base) measureBase();
      const b = base || { l: 0, t: 0, w: 0, h: 0 };
      const cx = b.l + b.w / 2 + S.x.x + S.zx.x, cy = b.t + b.h / 2 + S.y.x + S.zy.x;
      const hw = b.w * S.s.x * zs / 2, hh = b.h * S.s.x * zs / 2;
      const r = { left: cx - hw, right: cx + hw, top: cy - hh, bottom: cy + hh, width: hw * 2 }, sp = Math.max(0, Math.min(1, S.sp.x));
      if (r.width > 2) {
        const lerp = (p, q) => p + (q - p) * sp;
        beams[0].style.transform = `translateY(${lerp(r.top, 0).toFixed(1)}px)`;
        beams[1].style.transform = `translateY(${lerp(r.bottom, H).toFixed(1)}px)`;
        beams[2].style.transform = `translateX(${lerp(r.left, 0).toFixed(1)}px)`;
        beams[3].style.transform = `translateX(${lerp(r.right, W).toFixed(1)}px)`;
      }
      const bo = (a * (1 - sp * 0.5)).toFixed(3);
      beams.forEach((b) => { b.style.opacity = bo; });
      root.style.setProperty("--pa", a.toFixed(3));   // chrome (arrows, close, caption) materialises with the backdrop
    }
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      Object.values(S).forEach((sp) => sp.tick(dt));
      maybeSwap();
      render();
      if (Object.values(S).every((sp) => sp.done()) && !pendingSwap) {
        Object.values(S).forEach((sp) => sp.jump(sp.target));
        render(); raf = null;
        if (closing) finishClose();
        return;
      }
      raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

    /* ---------- zoom ---------- */
    // the photo's centre on screen while unzoomed (the stage's box plus its own springs)
    function centre() {
      if (!base) measureBase();
      const b = base || { l: W / 2, t: H / 2, w: 0, h: 0 };
      return { x: b.l + b.w / 2 + S.x.x, y: b.t + b.h / 2 + S.y.x, w: b.w, h: b.h };
    }
    // how far the zoomed photo may pan at scale s: its edges may not come inside the screen's
    function panRange(s) {
      const c = centre(), hw = c.w * s / 2, hh = c.h * s / 2;
      return { x0: Math.min(0, W - hw - c.x), x1: Math.max(0, hw - c.x), y0: Math.min(0, H - hh - c.y), y1: Math.max(0, hh - c.y) };
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function soft(v, lo, hi, dim) {                  // past the edge the photo stretches instead of stopping
      if (v < lo) return lo + rubberband(v - lo, dim);
      if (v > hi) return hi + rubberband(v - hi, dim);
      return v;
    }
    function zoomed() { return S.zs.target > 1.01 || S.zs.x > 1.01; }
    function unzoom(opts) {
      S.zs.to(1, opts); S.zx.to(0, opts); S.zy.to(0, opts);
    }
    // zoom so that the point (px, py) on screen stays under the finger
    function zoomTo(s, px, py, opts) {
      const c = centre(), s0 = S.zs.x;
      const lx = (px - c.x - S.zx.x) / s0, ly = (py - c.y - S.zy.x) / s0;   // that point on the unzoomed photo
      const R = panRange(s);
      S.zs.to(s, opts);
      S.zx.to(clamp(px - c.x - lx * s, R.x0, R.x1), opts);
      S.zy.to(clamp(py - c.y - ly * s, R.y0, R.y1), opts);
      kick();
    }
    function toggleZoom(px, py) {
      if (root.hidden || closing) return;
      if (zoomed()) unzoom({ response: 0.4 }); else zoomTo(TAP_ZOOM, px, py, { response: 0.4 });
      kick();
    }

    /* ---------- open: grow out of the thumbnail ---------- */
    function thumbRect() {
      const src = o.sourceEl ? o.sourceEl() : source;    // the thumbnail of the photo on screen now (none → fade)
      const t = src && (src.querySelector("img") || src);
      if (!t || !t.isConnected) return null;
      const r = t.getBoundingClientRect();
      if (r.width < 2 || r.bottom < 0 || r.top > window.innerHeight) return null;   // scrolled away → no anchor
      return r;
    }
    function flipFrom(r) {
      // stage is laid out at its final place with transform cleared; map the thumb onto it
      stage.style.transform = "none";
      const f = stage.getBoundingClientRect();
      measureBase();
      if (!f.width) return false;
      const s = Math.sqrt((r.width * r.height) / (f.width * f.height));
      S.s.jump(s);
      S.x.jump(r.left + r.width / 2 - (f.left + f.width / 2));
      S.y.jump(r.top + r.height / 2 - (f.top + f.height / 2));
      return true;
    }
    /* Before / after: if this photo has a raw version (o.rawFor), a handle you drag across the photo
       shows the raw shot on its left and the edit on its right. Nothing appears for photos without one. */
    const split = document.createElement("div");
    split.className = "p-split"; split.hidden = true;
    split.innerHTML = '<img class="p-raw" alt="" decoding="async"><span class="p-split-line"><i aria-hidden="true">\u2194</i></span>' +
      '<b class="p-lab l">Raw</b><b class="p-lab r">Edit</b>';
    stage.appendChild(split);
    const rawImg = split.querySelector(".p-raw"), knob = split.querySelector(".p-split-line");
    function updateSplit() {
      const u = o.rawFor ? o.rawFor() : null;
      split.hidden = !u;
      if (!u) { rawImg.removeAttribute("src"); return; }
      rawImg.src = u; split.style.setProperty("--sx", "50%");
    }
    let sd = null;
    knob.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      try { knob.setPointerCapture(e.pointerId); } catch (_) {}
      sd = { id: e.pointerId, r: split.getBoundingClientRect() };
      split.classList.add("dragging");
    });
    knob.addEventListener("pointermove", (e) => {
      if (!sd || e.pointerId !== sd.id) return;
      const p = Math.max(0, Math.min(1, (e.clientX - sd.r.left) / sd.r.width));
      split.style.setProperty("--sx", (p * 100).toFixed(2) + "%");
    });
    const sUp = (e) => { if (sd && e.pointerId === sd.id) { sd = null; split.classList.remove("dragging"); } };
    knob.addEventListener("pointerup", sUp);
    knob.addEventListener("pointercancel", sUp);

    function open(sourceEl) {
      source = sourceEl || null;
      closing = false;
      root.style.pointerEvents = "";
      // show the already-loaded thumbnail instantly, swap to full-res once it arrives
      const full = img.src, th = source && source.querySelector("img");
      if (th && th.complete && th.naturalWidth && th.currentSrc && th.currentSrc !== full) {
        const preview = th.currentSrc;
        img.src = preview;
        const hi = new Image();
        hi.onload = () => { if (img.src === preview) img.src = full; };   // unless they've already moved on
        hi.src = full;
      }
      const wasHidden = root.hidden;
      root.hidden = false;
      lightFrom(); sheen(); markEnds(); updateSplit();
      if (wasHidden) {
        S.a.jump(0); S.o.jump(1); S.sp.jump(1); S.zs.jump(1); S.zx.jump(0); S.zy.jump(0);
        const r = thumbRect();
        if (!(r && flipFrom(r))) { S.x.jump(0); S.y.jump(24); S.s.jump(0.94); S.o.jump(0); }
      }
      S.x.to(0); S.y.to(0); S.s.to(1); S.o.to(1);
      S.a.to(1, { response: 0.3 });
      S.sp.to(0, { response: 0.6 });                  // the beams glide in from the screen edges and lock on
      render(); kick();
    }

    /* ---------- close: shrink back into the thumbnail ---------- */
    function close(opts) {
      if (root.hidden || closing) return;
      closing = true;
      drag = null; pinch = null; pts.clear();
      root.style.pointerEvents = "none";            // the page is usable again right away
      const v = (opts && opts.velocity) || { x: 0, y: 0 };
      stage.style.transform = "none";
      const r = thumbRect();
      const f = stage.getBoundingClientRect();
      measureBase();
      render();
      unzoom({ response: 0.34 });                     // a zoomed photo settles back into its frame on the way
      if (r && f.width) {
        const s = Math.sqrt((r.width * r.height) / (f.width * f.height));
        S.x.to(r.left + r.width / 2 - (f.left + f.width / 2), { velocity: v.x });
        S.y.to(r.top + r.height / 2 - (f.top + f.height / 2), { velocity: v.y });
        S.s.to(s);
      } else {
        S.y.to(S.y.x + (v.y >= 0 ? 1 : -1) * window.innerHeight * 0.25, { velocity: v.y });
        S.s.to(0.9); S.o.to(0, { response: 0.3 });
      }
      S.a.to(0, { response: 0.3 });
      S.sp.to(1, { response: 0.45 });                 // and retreat back out
      kick();
    }
    function finishClose() {
      closing = false;
      root.hidden = true;
      root.style.pointerEvents = "";
      S.x.jump(0); S.y.jump(0); S.s.jump(1); S.o.jump(1); S.sp.jump(1); S.zs.jump(1); S.zx.jump(0); S.zy.jump(0); render();
      if (o.onClosed) o.onClosed();
    }

    /* ---------- step: old photo leaves one way, the next arrives from the other ---------- */
    function width() { return Math.max(320, window.innerWidth); }
    // at the first / last photo: a short push toward the missing neighbour that springs straight back
    function nudge(dir, v) {
      S.x.to(0, { damping: 0.62, response: 0.34, velocity: v != null ? v : -dir * 1100 });
      kick();
    }
    function go(dir, velocity) {
      if (root.hidden || closing) return;
      if (pendingSwap) swap();                        // a fast second press finishes the first instantly
      if (!can(dir)) { nudge(dir); return; }
      if (zoomed()) unzoom({ response: 0.3 });
      pendingSwap = dir;
      S.x.to(-dir * width(), { response: 0.3, velocity: velocity || 0 });
      if (reduced) swap();
      kick();
    }
    function maybeSwap() {
      if (!pendingSwap) return;
      if (Math.abs(S.x.x) >= width() * 0.92 || S.x.done()) swap();
    }
    function swap() {
      const dir = pendingSwap; pendingSwap = 0;
      o.step(dir);
      lightFrom(); sheen(); markEnds(); updateSplit();
      const v = S.x.v;
      S.zs.jump(1); S.zx.jump(0); S.zy.jump(0);       // a new photo always arrives unzoomed
      S.x.jump(dir * width() * 0.6);                 // enter from the side it was thrown toward
      S.x.to(0, { response: 0.36, velocity: v * 0.6 });
      S.y.to(0); S.s.to(1); S.o.to(1);
    }

    /* ---------- direct manipulation ----------
       One recogniser for every gesture: the first finger can become a swipe (x), a dismiss (y) or —
       while zoomed — a pan; a second finger turns whatever is happening into a pinch. */
    let drag = null, pinch = null, lastTap = null, lastZoomAt = 0;
    const pts = new Map();                            // every finger on the glass: id → { x, y }
    function startDrag(id, x, y, t, axis) {
      drag = { id, x0: x, y0: y, axis: axis || null, bx: S.x.x, by: S.y.x, zx: S.zx.x, zy: S.zy.x,
               hist: [{ x, y, t }] };
    }
    function startPinch() {
      const [p, q] = Array.from(pts.values());
      if (drag && drag.axis && drag.axis !== "pan") {   // a swipe / dismiss already under way gives way to the pinch
        S.x.to(0); S.y.to(0); S.s.to(1); S.a.to(1, { response: 0.3 });
      }
      if (pendingSwap) swap();
      drag = null;
      pts.forEach((_, id) => { try { root.setPointerCapture(id); } catch (_) {} });
      const c = centre();
      // grab the zoom where it is right now (it may still be springing)
      S.zs.jump(S.zs.x); S.zx.jump(S.zx.x); S.zy.jump(S.zy.x);
      pinch = { d0: Math.max(10, Math.hypot(q.x - p.x, q.y - p.y)), s0: S.zs.x, c,
                lx: ((p.x + q.x) / 2 - c.x - S.zx.x) / S.zs.x, ly: ((p.y + q.y) / 2 - c.y - S.zy.x) / S.zs.x,
                m: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } };
      kick();
    }
    function movePinch() {
      const [p, q] = Array.from(pts.values());
      const d = Math.max(10, Math.hypot(q.x - p.x, q.y - p.y)), m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      let s = pinch.s0 * d / pinch.d0;
      // past the limits the photo resists, like a rubber band
      if (s > MAX_ZOOM) s = MAX_ZOOM * Math.pow(s / MAX_ZOOM, 0.25);
      else if (s < 1) s = Math.pow(s, 0.45);
      pinch.m = m; pinch.s = s;
      // the point that was under the fingers stays under the fingers (scale about the midpoint, 1:1)
      S.zs.jump(s); S.zx.jump(m.x - pinch.c.x - pinch.lx * s); S.zy.jump(m.y - pinch.c.y - pinch.ly * s);
      render();
    }
    function endPinch() {
      const p = pinch; pinch = null;
      const s = clamp(S.zs.x, 1, MAX_ZOOM);
      if (s <= 1.01) unzoom({ response: 0.38 });
      else zoomTo(s, p.m.x, p.m.y, { response: 0.38 });   // back inside the limits, still about the fingers
      kick();
    }

    root.addEventListener("pointerdown", (e) => {
      if (root.hidden || closing || e.button > 0) return;
      // a second finger landing on an arrow is still half of a pinch
      if (e.target.closest("button, a") && !(pts.size === 1 && e.pointerType === "touch")) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { startPinch(); return; }
      if (pts.size > 2) return;
      startDrag(e.pointerId, e.clientX, e.clientY, e.timeStamp);
    });
    root.addEventListener("pointermove", (e) => {
      const pt = pts.get(e.pointerId);
      if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
      if (pinch) { if (pts.size >= 2) movePinch(); return; }
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < (zoomed() ? 4 : 10)) return;   // hysteresis before committing to a direction
        // zoomed: one finger moves the photo around; otherwise the first clear direction wins
        drag.axis = zoomed() ? "pan" : Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        try { root.setPointerCapture(e.pointerId); } catch (_) {}
        if (pendingSwap) swap();
        drag.bx = S.x.x; drag.by = S.y.x;              // grab from wherever the photo is right now
        drag.zx = S.zx.x; drag.zy = S.zy.x;
      }
      drag.hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      if (drag.hist.length > 6) drag.hist.shift();
      const mx = e.clientX - drag.x0, my = e.clientY - drag.y0;
      if (drag.axis === "pan") {
        const R = panRange(S.zs.x);
        S.zx.jump(soft(drag.zx + mx, R.x0, R.x1, W)); S.zy.jump(soft(drag.zy + my, R.y0, R.y1, H));
      } else if (drag.axis === "x") {
        let nx = drag.bx + mx;
        if (!can(nx < 0 ? 1 : -1)) nx = rubberband(nx, width());   // nothing that way: stretch, don't wrap
        S.x.jump(nx);
      } else {
        const ny = drag.by + my;
        S.y.jump(ny); S.x.jump(drag.bx);
        S.s.jump(1 - Math.min(0.25, Math.abs(ny) / H * 0.5));
        S.a.jump(1 - Math.min(1, Math.abs(ny) / (H * 0.6)));
      }
      render();
    });
    function release(e) {
      if (pts.has(e.pointerId)) pts.delete(e.pointerId);
      if (pinch) {
        if (pts.size < 2) {
          endPinch();
          justDragged = true; setTimeout(() => { justDragged = false; }, 0);
          // one finger still down on a zoomed photo carries on as a pan, from where it is
          const rest = pts.size === 1 && Array.from(pts.entries())[0];
          if (rest && zoomed()) startDrag(rest[0], rest[1].x, rest[1].y, e.timeStamp, "pan");
        }
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.axis) {                                   // a tap, not a drag — two quick taps on the photo zoom
        if (e.type === "pointerup" && e.pointerType !== "mouse" && stage.contains(e.target)) {
          if (lastTap && e.timeStamp - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
            lastTap = null; lastZoomAt = performance.now(); toggleZoom(e.clientX, e.clientY);
          } else lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
        }
        return;
      }
      if (e.type === "pointercancel") {                // the system took the gesture → just settle back
        if (d.axis === "pan") { const R = panRange(S.zs.x); S.zx.to(clamp(S.zx.x, R.x0, R.x1)); S.zy.to(clamp(S.zy.x, R.y0, R.y1)); }
        else { S.x.to(0); S.y.to(0); S.s.to(1); S.a.to(1, { response: 0.3 }); }
        kick(); return;
      }
      justDragged = true; setTimeout(() => { justDragged = false; }, 0);
      const v = velocity(d.hist), vx = v.x, vy = v.y;
      if (d.axis === "pan") {
        // the pan coasts like a scroll and stops at the photo's edge (or springs back to it)
        const R = panRange(S.zs.x);
        S.zx.to(clamp(S.zx.x + project(vx, 0.995), R.x0, R.x1), { response: 0.55, velocity: vx });
        S.zy.to(clamp(S.zy.x + project(vy, 0.995), R.y0, R.y1), { response: 0.55, velocity: vy });
        kick();
      } else if (d.axis === "x") {
        const end = S.x.x + project(vx), dir = end < 0 ? 1 : -1;
        if (Math.abs(end) > width() * 0.35 && can(dir)) {
          go(dir, vx);
          if (window.cnHaptic) window.cnHaptic(10);   // the flick committed: same frame as the photo leaving
        } else { S.x.to(0, { damping: 0.8, response: 0.32, velocity: can(dir) ? vx : vx * 0.4 }); kick(); }
      } else {
        const end = S.y.x + project(vy);
        if (Math.abs(end) > 180) close({ velocity: { x: 0, y: vy } });
        else {
          S.y.to(0, { damping: 0.8, response: 0.32, velocity: vy });
          S.s.to(1); S.a.to(1, { response: 0.3 }); kick();
        }
      }
    }
    root.addEventListener("dragstart", (e) => e.preventDefault());   // no native image drag-and-drop
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);
    // a drag that ends over the backdrop must not count as "click outside to close"
    root.addEventListener("click", (e) => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
    // double-click on a computer zooms in on that spot (and back out)
    stage.addEventListener("dblclick", (e) => {
      if (performance.now() - lastZoomAt < 500) return;    // a touch double-tap already handled it
      e.preventDefault(); toggleZoom(e.clientX, e.clientY);
    });
    // trackpad pinch arrives as ctrl + wheel
    root.addEventListener("wheel", (e) => {
      if (!e.ctrlKey || root.hidden || closing) return;
      e.preventDefault();
      const s = clamp(S.zs.x * Math.exp(-e.deltaY * 0.01), 1, MAX_ZOOM);
      if (s <= 1.001) { unzoom({ response: 0.3 }); kick(); return; }
      const c = centre(), s0 = S.zs.x, lx = (e.clientX - c.x - S.zx.x) / s0, ly = (e.clientY - c.y - S.zy.x) / s0, R = panRange(s);
      S.zs.jump(s); S.zx.jump(clamp(e.clientX - c.x - lx * s, R.x0, R.x1)); S.zy.jump(clamp(e.clientY - c.y - ly * s, R.y0, R.y1));
      render();
    }, { passive: false });
    // iOS Safari: keep its own page zoom out of the lightbox
    root.addEventListener("gesturestart", (e) => e.preventDefault());

    return { open, close, go, zoomed, unzoom: () => { unzoom({ response: 0.38 }); kick(); },
             state: () => ({ x: S.x.x, y: S.y.x, s: S.s.x, zoom: S.zs.x, zx: S.zx.x, zy: S.zy.x, moving: !!raf }) };
  };
  // the film viewer (app.js) moves with the same physics
  window.PlightFX.Spring = Spring;
  window.PlightFX.project = project;
  window.PlightFX.rubberband = rubberband;
  window.PlightFX.velocity = velocity;
})();
