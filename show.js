/* CN Production — stills subpage. Shows all photos of one concert (?c=<index>). */
(function () {
  "use strict";
  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  const ci = parseInt(new URLSearchParams(location.search).get("c"), 10);
  const CON = (typeof CONCERTS !== "undefined" && Array.isArray(CONCERTS) && CONCERTS[ci]) ? CONCERTS[ci] : null;
  const grid = document.getElementById("showGrid");
  const titleEl = document.getElementById("showTitle");

  if (!CON) { titleEl.textContent = "Show not found"; return; }

  const meta = [CON.venue, CON.date].filter(Boolean).map(esc).join(" · ");
  titleEl.innerHTML = `<span class="concert-artist">${esc(CON.artist || "")}</span>` + (meta ? ` <span class="concert-meta">${meta}</span>` : "");
  document.title = (CON.artist || "Show") + " — CN Production";

  const shots = CON.shots || [];
  shots.forEach((file, si) => {
    const shot = document.createElement("div"); shot.className = "shot";
    const img = document.createElement("img"); img.loading = "lazy"; img.alt = CON.artist || "still";
    img.src = (CON.dir || "") + file;
    shot.append(img);
    shot.addEventListener("click", () => openPhoto(si));
    grid.appendChild(shot);
  });

  /* ---- lightbox ---- */
  const plight = document.getElementById("plight");
  const plightImg = document.getElementById("plightImg");
  const plightCaption = document.getElementById("plightCaption");
  const plightCount = document.getElementById("plightCount");
  let pShot = 0;

  function showPhoto() {
    if (!shots.length) return;
    pShot = ((pShot % shots.length) + shots.length) % shots.length;
    plightImg.src = (CON.dir || "") + shots[pShot];
    plightCaption.textContent = [CON.artist, CON.venue, CON.date].filter(Boolean).join(" · ");
    plightCount.textContent = String(pShot + 1).padStart(2, "0") + " / " + String(shots.length).padStart(2, "0");
  }
  function openPhoto(si) { pShot = si; showPhoto(); plight.hidden = false; document.body.style.overflow = "hidden"; }
  function closePhoto() { plight.hidden = true; plightImg.src = ""; document.body.style.overflow = ""; }

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
})();
