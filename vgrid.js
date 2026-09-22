/* CN PROD — shared grid subpage (social.html, restaurant.html).
   The page sets window.VGRID = { items, ratio, min } before loading this. */
(function () {
  "use strict";
  var CFG = (typeof window.VGRID === "object" && window.VGRID) ? window.VGRID : {};
  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  // Same link → embed rules as app.js, trimmed to what vertical posts use.
  // Covers: oar2 is the ORIGINAL-aspect thumbnail (no black bars); the others are 16:9 pillarboxed.
  function parseVideo(url) {
    if (!url) return null;
    let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) {
      const id = m[1];
      return {
        type: "youtube", id,
        player: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=${id}`,
        thumbs: [`https://i.ytimg.com/vi/${id}/oar2.jpg`, `https://i.ytimg.com/vi/${id}/oardefault.jpg`,
                 `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
      };
    }
    if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url)) return { type: "file", id: url, player: url, thumbs: [] };
    return null;
  }

  const items = (typeof SOCIAL !== "undefined" && Array.isArray(SOCIAL) ? SOCIAL : [])
    .map((c) => ({ ...c, v: parseVideo(c.url) }))
    .filter((c) => c.v);

  const grid = document.getElementById("socialGrid");
  const countEl = document.getElementById("socialCount");
  grid.style.setProperty("--tile-ratio", CFG.ratio || "9 / 16");
  grid.style.setProperty("--tile-min", CFG.min || "180px");
  countEl.textContent = items.length ? String(items.length).padStart(2, "0") + (CFG.unit ? " · " + CFG.unit : "") : "";

  if (!items.length) {
    const p = document.createElement("p"); p.className = "social-empty"; p.textContent = "Nothing here yet — coming soon.";
    grid.replaceWith(p);
    return;
  }

  items.forEach((c, i) => {
    const tile = document.createElement("div"); tile.className = "svid";
    tile.setAttribute("role", "button"); tile.tabIndex = 0;
    tile.setAttribute("aria-label", "Play " + (c.title || "clip"));

    const img = document.createElement("img"); img.loading = "lazy"; img.alt = c.title || "still";
    const srcs = (c.thumb ? [c.thumb] : []).concat(c.v.thumbs);
    let k = 0;
    // YouTube answers a 120x90 placeholder (not a 404) for sizes it hasn't made — skip those too
    img.onload = () => { if (img.naturalWidth <= 120 && k < srcs.length) img.src = srcs[k++]; };
    img.onerror = () => { if (k < srcs.length) img.src = srcs[k++]; else { img.remove(); tile.classList.add("no-thumb"); tile.insertAdjacentHTML("afterbegin", '<span class="shot-name">' + esc(c.title || "") + '</span>'); } };
    if (srcs.length) img.src = srcs[k++]; else img.onerror();
    tile.appendChild(img);

    const cap = document.createElement("div"); cap.className = "svid-cap";
    cap.innerHTML = '<b>' + esc(c.title || "") + '</b>' + (c.artist ? ' <span>· ' + esc(c.artist) + '</span>' : '');
    tile.appendChild(cap);

    tile.addEventListener("click", () => openVideo(i));
    tile.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openVideo(i); } });
    grid.appendChild(tile);
  });

  /* ---- player ---- */
  const plight = document.getElementById("plight");
  const stage = document.getElementById("plightVideo");
  const plightCaption = document.getElementById("plightCaption");
  const plightCount = document.getElementById("plightCount");
  let cur = 0;

  function mount() {
    cur = ((cur % items.length) + items.length) % items.length;
    const c = items[cur];
    stage.innerHTML = "";
    if (c.v.type === "file") {
      const v = document.createElement("video");
      v.src = c.v.player; v.controls = true; v.autoplay = true; v.playsInline = true; v.loop = true;
      stage.appendChild(v);
    } else {
      const f = document.createElement("iframe");
      f.src = c.v.player; f.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture"; f.allowFullscreen = true;
      stage.appendChild(f);
    }
    plightCaption.textContent = [c.title, c.artist].filter(Boolean).join(" · ");
    plightCount.textContent = String(cur + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
  }
  function openVideo(i) { cur = i; mount(); plight.hidden = false; document.body.style.overflow = "hidden"; }
  function closeVideo() { plight.hidden = true; stage.innerHTML = ""; document.body.style.overflow = ""; }

  document.getElementById("plightPrev").addEventListener("click", () => { cur--; mount(); });
  document.getElementById("plightNext").addEventListener("click", () => { cur++; mount(); });
  document.getElementById("plightClose").addEventListener("click", closeVideo);
  plight.addEventListener("click", (e) => { if (e.target === plight) closeVideo(); });
  document.addEventListener("keydown", (e) => {
    if (plight.hidden) return;
    if (e.key === "Escape") closeVideo();
    else if (e.key === "ArrowLeft") { cur--; mount(); }
    else if (e.key === "ArrowRight") { cur++; mount(); }
  });
})();
