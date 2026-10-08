/* CN Production — fluid photo lightbox (shared by index, show and media pages).
   The page keeps its own index/caption logic; this file owns the motion:
   - opens out of the tapped thumbnail and closes back into it
   - the photo follows the finger 1:1; a flick throws it to the next one
   - drag down to dismiss
   - every move is a spring that starts from where the photo is now, so nothing has to finish first */
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

  window.PlightFX = function (o) {
    const root = o.root, stage = o.stage, img = o.img;
    const S = { x: new Spring(0, 0.5), y: new Spring(0, 0.5), s: new Spring(1, 0.002), a: new Spring(0, 0.004), o: new Spring(1, 0.004) };
    let raf = null, last = 0, closing = false, source = null, pendingSwap = 0, justDragged = false;

    function render() {
      stage.style.transform = `translate3d(${S.x.x}px, ${S.y.x}px, 0) scale(${S.s.x})`;
      stage.style.opacity = Math.max(0, Math.min(1, S.o.x));
      const a = Math.max(0, Math.min(1, S.a.x));
      root.style.backgroundColor = `rgba(0,0,0,${(0.96 * a).toFixed(3)})`;
      root.style.setProperty("--pa", a.toFixed(3));   // chrome (arrows, close, caption) fades with the backdrop
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
      if (!f.width) return false;
      const s = Math.sqrt((r.width * r.height) / (f.width * f.height));
      S.s.jump(s);
      S.x.jump(r.left + r.width / 2 - (f.left + f.width / 2));
      S.y.jump(r.top + r.height / 2 - (f.top + f.height / 2));
      return true;
    }
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
      if (wasHidden) {
        S.a.jump(0); S.o.jump(1);
        const r = thumbRect();
        if (!(r && flipFrom(r))) { S.x.jump(0); S.y.jump(24); S.s.jump(0.94); S.o.jump(0); }
      }
      S.x.to(0); S.y.to(0); S.s.to(1); S.o.to(1);
      S.a.to(1, { response: 0.3 });
      render(); kick();
    }

    /* ---------- close: shrink back into the thumbnail ---------- */
    function close(opts) {
      if (root.hidden || closing) return;
      closing = true;
      root.style.pointerEvents = "none";            // the page is usable again right away
      const v = (opts && opts.velocity) || { x: 0, y: 0 };
      stage.style.transform = "none";
      const r = thumbRect();
      const f = stage.getBoundingClientRect();
      render();
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
      kick();
    }
    function finishClose() {
      closing = false;
      root.hidden = true;
      root.style.pointerEvents = "";
      S.x.jump(0); S.y.jump(0); S.s.jump(1); S.o.jump(1); render();
      if (o.onClosed) o.onClosed();
    }

    /* ---------- step: old photo leaves one way, the next arrives from the other ---------- */
    function width() { return Math.max(320, window.innerWidth); }
    function go(dir, velocity) {
      if (root.hidden || closing) return;
      if (pendingSwap) swap();                        // a fast second press finishes the first instantly
      if (o.count && o.count() < 2) { S.x.to(0, { damping: 0.8, response: 0.32 }); kick(); return; }
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
      const v = S.x.v;
      S.x.jump(dir * width() * 0.6);                 // enter from the side it was thrown toward
      S.x.to(0, { response: 0.36, velocity: v * 0.6 });
      S.y.to(0); S.s.to(1); S.o.to(1);
    }

    /* ---------- direct manipulation ---------- */
    let drag = null;
    root.addEventListener("pointerdown", (e) => {
      if (root.hidden || closing || e.button > 0) return;
      if (e.target.closest("button, a")) return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null,
               bx: S.x.x, by: S.y.x, hist: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
    });
    root.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < 10) return;           // hysteresis before committing to a direction
        drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        try { root.setPointerCapture(e.pointerId); } catch (_) {}
        if (pendingSwap) swap();
        drag.bx = S.x.x; drag.by = S.y.x;              // grab from wherever the photo is right now
      }
      drag.hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      if (drag.hist.length > 6) drag.hist.shift();
      if (drag.axis === "x") {
        let nx = drag.bx + dx;
        if (o.count && o.count() < 2) nx = rubberband(nx, width());
        S.x.jump(nx);
      } else {
        const ny = drag.by + dy, H = window.innerHeight;
        S.y.jump(ny); S.x.jump(drag.bx);
        S.s.jump(1 - Math.min(0.25, Math.abs(ny) / H * 0.5));
        S.a.jump(1 - Math.min(1, Math.abs(ny) / (H * 0.6)));
      }
      render();
    });
    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.axis) return;                             // a tap, not a drag
      if (e.type === "pointercancel") {                // the system took the gesture → just settle back
        S.x.to(0); S.y.to(0); S.s.to(1); S.a.to(1, { response: 0.3 }); kick(); return;
      }
      justDragged = true; setTimeout(() => { justDragged = false; }, 0);
      const h = d.hist, a = h[0], b = h[h.length - 1], dt = Math.max(1, b.t - a.t) / 1000;
      const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
      if (d.axis === "x") {
        const end = S.x.x + project(vx);
        if (Math.abs(end) > width() * 0.35 && !(o.count && o.count() < 2)) go(end < 0 ? 1 : -1, vx);
        else { S.x.to(0, { damping: 0.8, response: 0.32, velocity: vx }); kick(); }
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

    return { open, close, go };
  };
})();
