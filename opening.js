/* CN Production — the opening (home page, every load and refresh).
   No gate and no overlay: it plays on the real page.
   1. the metal CN mark materialises big in the centre, the sheen crosses it
   2. the ambient light blooms out from it
   3. the mark travels up into its place; the glass nav forms where it arrives
   4. the films rise out of depth, then the side chrome fades in
   Nothing is locked: any scroll, click, tap or key fast-forwards it to the end (never a hard cut).
   index.html adds html.opening before first paint so nothing flashes in its final place first. */
(function () {
  "use strict";
  const html = document.documentElement;
  if (!html.classList.contains("opening")) return;
  if (window.scrollY > 40) { html.classList.remove("opening"); return; }   // reopened mid-page: just show it

  const $ = (s) => document.querySelector(s);
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
      { offset: 0,   opacity: 0, filter: "blur(18px)", transform: at(s * 0.86) },
      { offset: .34, opacity: 1, filter: "blur(0px)",  transform: at(s), easing: "linear" },
      { offset: .46, opacity: 1, filter: "blur(0px)",  transform: at(s), easing: E },
      { offset: 1,   opacity: 1, filter: "blur(0px)",  transform: "translateX(-50%) translateY(0px) scale(1)" },
    ], { duration: 1650, easing: "linear" });
    // the word under the mark arrives with the landing
    play(logo.querySelector(".logo-word"), [
      { opacity: 0, letterSpacing: "0.9em" }, { opacity: 1, letterSpacing: "0.28em" },
    ], { duration: 700, delay: 1150 });
  }
  // light blooms out from the mark
  play($(".ambient"), [
    { opacity: 0, transform: "scale(.55)" }, { opacity: 1, transform: "scale(1)" },
  ], { duration: 1500, delay: 250 });
  // the glass nav materialises just after the logo lands under it (blur + scale together, not just a fade)
  play($(".nav"), [
    { opacity: 0, filter: "blur(12px)", transform: "translateX(-50%) translateY(26px) scale(.86)" },
    { opacity: 1, filter: "blur(0px)", transform: "translateX(-50%) translateY(0px) scale(1)" },
  ], { duration: 750, delay: 1350 });
  // the films rise out of depth
  play($("#work"), [
    { opacity: 0, filter: "blur(14px)", transform: "translateY(90px) scale(.94)" },
    { opacity: 1, filter: "blur(0px)", transform: "translateY(0px) scale(1)" },
  ], { duration: 950, delay: 1150 });
  // side chrome last, so it never competes with the reveal
  ["#chrome", "#hud", "#goMore", "#skipStills"].forEach((sel, i) => {
    play($(sel), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 1600 + i * 60, easing: "ease-out" });
  });

  // the animations now hold the start state, so the CSS hiding can go
  html.classList.remove("opening");

  // interruptible: input fast-forwards whatever is still playing
  let ff = false;
  function fastForward() {
    if (ff) return; ff = true;
    anims.forEach((a) => { try { a.updatePlaybackRate(7); } catch (_) { a.playbackRate = 7; } });
    off();
  }
  const evs = ["wheel", "pointerdown", "keydown", "touchstart"];
  function off() { evs.forEach((e) => window.removeEventListener(e, fastForward, true)); }
  evs.forEach((e) => window.addEventListener(e, fastForward, { capture: true, passive: true }));
  Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(off);
})();
