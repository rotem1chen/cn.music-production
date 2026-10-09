/* CN Production — the opening (home page, every load and refresh).
   No gate and no overlay: it plays on the real page.
   1. the metal CN mark materialises big in the centre, the sheen crosses it
   2. the ambient light blooms out from it
   3. the mark travels up into its place; the glass nav forms where it arrives
   4. the films rise out of depth, then the side chrome fades in
   Nothing is locked: any scroll, click, tap or key fast-forwards it to the end (never a hard cut).
   index.html adds html.opening before first paint so nothing flashes in its final place first.

   Nothing here measures anything per frame: the yellow corners ride the films' rise as their own
   compositor animation. Computers also get the blur-in (filter); phones get transform + opacity only —
   animating a blur over the whole reel repaints it on every frame, which a phone can't keep up with. */
(function () {
  "use strict";
  const html = document.documentElement;
  if (!html.classList.contains("opening")) return;
  if (window.scrollY > 40) { html.classList.remove("opening"); return; }   // reopened mid-page: just show it

  const $ = (s) => document.querySelector(s);
  const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const blur = (px) => (touch ? {} : { filter: `blur(${px}px)` });
  const logo = $(".logo-hero");
  const E = "cubic-bezier(.16, 1, .3, 1)";            // critically damped feel, no overshoot
  const anims = [];
  function play(el, frames, opts) {
    if (!el) return;
    anims.push(el.animate(frames, Object.assign({ fill: "backwards", easing: E }, opts)));
  }

  if (logo) {
    // from the centre of the screen, bigger, to where the logo lives
    const r = logo.getBoundingClientRect();
    const dy = window.innerHeight / 2 - (r.top + r.height / 2);
    const s = Math.min(1.7, (window.innerHeight * 0.4) / Math.max(1, r.height));
    const at = (sc) => `translateX(-50%) translateY(${dy.toFixed(1)}px) scale(${sc.toFixed(3)})`;
    play(logo, [
      Object.assign({ offset: 0,   opacity: 0, transform: at(s * 0.86) }, blur(18)),
      Object.assign({ offset: .34, opacity: 1, transform: at(s), easing: "linear" }, blur(0)),
      Object.assign({ offset: .46, opacity: 1, transform: at(s), easing: E }, blur(0)),
      Object.assign({ offset: 1,   opacity: 1, transform: "translateX(-50%) translateY(0px) scale(1)" }, blur(0)),
    ], { duration: 1650, easing: "linear" });
    // the word under the mark arrives with the landing (letter-spacing is a layout per frame: computers only)
    play(logo.querySelector(".logo-word"), touch ? [{ opacity: 0 }, { opacity: 1 }] : [
      { opacity: 0, letterSpacing: "0.9em" }, { opacity: 1, letterSpacing: "0.28em" },
    ], { duration: 700, delay: 1150 });
  }
  // light blooms out from the mark
  play($(".ambient"), [
    { opacity: 0, transform: "scale(.55)" }, { opacity: 1, transform: "scale(1)" },
  ], { duration: 1500, delay: 250 });
  // the glass nav materialises just after the logo lands under it (blur + scale together, not just a fade)
  play($(".nav"), [
    Object.assign({ opacity: 0, transform: "translateX(-50%) translateY(26px) scale(.86)" }, blur(12)),
    Object.assign({ opacity: 1, transform: "translateX(-50%) translateY(0px) scale(1)" }, blur(0)),
  ], { duration: 750, delay: 1350 });
  // the films rise out of depth, and the yellow corners ride the very same motion: both scale about
  // the centre of the screen, so the brackets (parked on the film's final place by app.js) stay glued
  // to it frame by frame without anything reading the film's position while it moves
  const work = $("#work"), chrome = $("#chrome");
  const RISE = [{ transform: "translateY(90px) scale(.94)" }, { transform: "translateY(0px) scale(1)" }];
  if (work) {
    work.style.transformOrigin = `50% ${(window.innerHeight / 2 - work.getBoundingClientRect().top).toFixed(1)}px`;
    play(work, [Object.assign({ opacity: 0 }, RISE[0], blur(14)), Object.assign({ opacity: 1 }, RISE[1], blur(0))],
      { duration: 950, delay: 1150 });
    play(chrome, RISE, { duration: 950, delay: 1150 });
  }
  // side chrome last, so it never competes with the reveal
  ["#chrome", "#hud", "#goMore", "#skipStills"].forEach((sel, i) => {
    play($(sel), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 1600 + i * 60, easing: "ease-out" });
  });

  // the animations now hold the start state, so the CSS hiding can go;
  // until they end, app.js leaves the brackets where they are (they move with the films instead)
  html.classList.remove("opening");
  html.classList.add("opening-run");

  // interruptible: input fast-forwards whatever is still playing — a quick catch-up, never a cut
  let ff = false;
  function fastForward() {
    if (ff) return; ff = true;
    const rate = touch ? 10 : 7;                     // a thumb that's already scrolling shouldn't wait
    anims.forEach((a) => { try { a.updatePlaybackRate(rate); } catch (_) { a.playbackRate = rate; } });
    off();
  }
  const evs = ["wheel", "pointerdown", "keydown", "touchstart"];
  function off() { evs.forEach((e) => window.removeEventListener(e, fastForward, true)); }
  evs.forEach((e) => window.addEventListener(e, fastForward, { capture: true, passive: true }));
  Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => {
    off();
    if (work) work.style.transformOrigin = "";
    html.classList.remove("opening-run");
    if (window.cnRefresh) window.cnRefresh();       // catch up with anything scrolled during the opening
  });
})();
