/* CN Production — stills subpage. Shows all photos of one concert (?c=<index>). */
(function () {
  "use strict";
  document.addEventListener("touchstart", () => {}, { passive: true });   // lets iOS Safari show :active press states
  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  const ci = parseInt(new URLSearchParams(location.search).get("c"), 10);
  const CON = (typeof CONCERTS !== "undefined" && Array.isArray(CONCERTS) && CONCERTS[ci]) ? CONCERTS[ci] : null;
  const grid = document.getElementById("showGrid");
  const titleEl = document.getElementById("showTitle");

  if (!CON) { titleEl.textContent = "Show not found"; return; }

  const meta = [CON.venue, CON.date].filter(Boolean).map(esc).join(" · ");
  titleEl.innerHTML = `<span class="concert-artist">${esc(CON.artist || "")}</span>` + (meta ? ` <span class="concert-meta">${meta}</span>` : "");
  document.title = (CON.artist || "Show") + " — CN PROD";

  const shots = CON.shots || [];
  const shotEls = [];
  shots.forEach((file, si) => {
    const shot = document.createElement("div"); shot.className = "shot";
    const img = document.createElement("img"); img.loading = "lazy"; img.alt = CON.artist || "still";
    img.src = (CON.dir || "") + "thumb/" + file;                        // light thumbnail for the grid
    img.onerror = () => { img.onerror = null; img.src = (CON.dir || "") + file; };  // fallback to full if no thumb
    if (file === (CON.cover || shots[0])) img.style.viewTransitionName = "still-cover";   // where the home-page cover lands
    shot.append(img);
    shot.addEventListener("click", () => openPhoto(si, shot));
    shotEls.push(shot);
    grid.appendChild(shot);
  });

  /* ---- lightbox ---- */
  const plight = document.getElementById("plight");
  const plightImg = document.getElementById("plightImg");
  const plightCaption = document.getElementById("plightCaption");
  const plightCount = document.getElementById("plightCount");
  let pShot = 0;

  function full(i) { return (CON.dir || "") + shots[((i % shots.length) + shots.length) % shots.length]; }
  function showPhoto() {
    if (!shots.length) return;
    pShot = ((pShot % shots.length) + shots.length) % shots.length;
    plightImg.src = full(pShot);
    plightCaption.textContent = [CON.artist, CON.venue, CON.date].filter(Boolean).join(" · ");
    plightCount.textContent = String(pShot + 1).padStart(2, "0") + " / " + String(shots.length).padStart(2, "0");
    [pShot + 1, pShot - 1].forEach((i) => { new Image().src = full(i); });   // neighbours ready before the swipe
  }
  const fx = PlightFX({
    root: plight, stage: document.getElementById("plightStage"), img: plightImg,
    step: (dir) => { pShot += dir; showPhoto(); },
    count: () => shots.length,
    index: () => pShot,                                 // stops at the first / last photo (rubber band), no wrap
    rawFor: () => (CON.raw ? (CON.dir || "") + "raw/" + shots[pShot] : null),   // before / after (photos.js `raw: true`)
    sourceEl: () => shotEls[pShot],
    onClosed: () => { plightImg.src = ""; document.body.style.overflow = ""; },
  });
  function openPhoto(si, el) { pShot = si; showPhoto(); document.body.style.overflow = "hidden"; fx.open(el); }

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
})();
