/* CN Production — client media pool. Shows one Google Drive folder (?f=<folder id or Drive link>)
   as videos / photos / files in the site's look. The folder must be shared "Anyone with the link". */
(function () {
  "use strict";
  const API = "https://www.googleapis.com/drive/v3/files";
  const KEY = (typeof MEDIA !== "undefined" && MEDIA.apiKey) ? MEDIA.apiKey : "";
  const FIELDS = "id,name,mimeType,size,webContentLink,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis)";

  const titleEl = document.getElementById("poolTitle");
  const statusEl = document.getElementById("poolStatus");
  const body = document.getElementById("poolBody");
  const actions = document.getElementById("poolActions");

  /* accept a bare id or any pasted Drive folder link */
  function folderId() {
    const raw = new URLSearchParams(location.search).get("f") || "";
    const m = raw.match(/folders\/([\w-]+)/) || raw.match(/[?&]id=([\w-]+)/);
    return (m ? m[1] : raw).trim();
  }
  const FID = folderId();

  function fail(msg) { titleEl.textContent = "Media"; statusEl.textContent = msg; actions.hidden = true; }
  if (!FID) { fail("No folder in the link. Use media.html?f=<drive folder id>"); return; }
  if (!KEY) { fail("Setup needed: paste the Drive API key into media-config.js"); return; }

  /* ---- Drive helpers ---- */
  const thumb = (id, w) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
  const dlUrl = (f) => f.webContentLink || `https://drive.google.com/uc?export=download&id=${f.id}`;
  const playUrl = (id) => `https://drive.google.com/file/d/${id}/preview`;
  const isFolder = (f) => f.mimeType === "application/vnd.google-apps.folder";
  const isVideo = (f) => f.mimeType.startsWith("video/");
  const isImage = (f) => f.mimeType.startsWith("image/") || /\.(heic|dng|cr2|cr3|arw|nef|raf)$/i.test(f.name);
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

  async function api(url) {
    const r = await fetch(url);
    if (!r.ok) {
      const e = new Error("drive " + r.status);
      e.status = r.status; throw e;
    }
    return r.json();
  }
  async function listFolder(id) {
    let files = [], token = "";
    do {
      const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
      const d = await api(`${API}?q=${q}&fields=nextPageToken,files(${FIELDS})&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${KEY}` + (token ? `&pageToken=${token}` : ""));
      files = files.concat(d.files || []);
      token = d.nextPageToken || "";
    } while (token);
    return files.sort(byName);
  }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1) + " GB";
    if (n >= 1e6) return Math.round(n / 1e6) + " MB";
    if (n >= 1e3) return Math.round(n / 1e3) + " KB";
    return n ? n + " B" : "";
  }
  function fmtDur(ms) {
    const s = Math.round((Number(ms) || 0) / 1000);
    if (!s) return "";
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  /* ---- render ---- */
  const photos = [];   // flat list for the lightbox, in page order

  function dlButton(f) {
    const a = document.createElement("a");
    a.className = "dl"; a.href = dlUrl(f); a.target = "_blank"; a.rel = "noopener";
    a.title = "Download"; a.textContent = "↓";
    a.addEventListener("click", (e) => e.stopPropagation());
    return a;
  }

  function section(label, count) {
    const s = document.createElement("div"); s.className = "pool-section";
    const h = document.createElement("div"); h.className = "concert-head";
    h.innerHTML = `<span class="concert-artist"></span><span class="concert-meta"></span>`;
    h.firstChild.textContent = label;
    h.lastChild.textContent = String(count).padStart(2, "0");
    s.appendChild(h);
    return s;
  }

  function renderVideos(files, parent) {
    const s = section("Videos", files.length);
    const grid = document.createElement("div"); grid.className = "vid-grid";
    files.forEach((f) => {
      const t = document.createElement("div"); t.className = "vid";
      const img = document.createElement("img"); img.loading = "lazy"; img.alt = f.name; img.src = thumb(f.id, 800);
      img.onerror = () => { img.remove(); t.classList.add("no-thumb"); };
      const play = document.createElement("span"); play.className = "vid-play"; play.textContent = "▶";
      const meta = document.createElement("div"); meta.className = "vid-meta";
      const dur = f.videoMediaMetadata ? fmtDur(f.videoMediaMetadata.durationMillis) : "";
      meta.innerHTML = `<span class="vid-name"></span><span class="vid-info"></span>`;
      meta.firstChild.textContent = f.name;
      meta.lastChild.textContent = [dur, fmtSize(f.size)].filter(Boolean).join(" · ");
      t.append(img, play, meta, dlButton(f));
      t.addEventListener("click", () => openVideo(f));
      grid.appendChild(t);
    });
    s.appendChild(grid); parent.appendChild(s);
  }

  function renderPhotos(files, parent) {
    const s = section("Photos", files.length);
    const grid = document.createElement("div"); grid.className = "concert-grid pool-grid";
    files.forEach((f) => {
      const idx = photos.push(f) - 1;
      const shot = document.createElement("div"); shot.className = "shot";
      const img = document.createElement("img"); img.loading = "lazy"; img.alt = f.name; img.src = thumb(f.id, 800);
      img.onerror = () => { img.remove(); shot.classList.add("no-thumb"); shot.insertAdjacentHTML("afterbegin", `<span class="shot-name"></span>`); shot.firstChild.textContent = f.name; };
      const n = document.createElement("span"); n.className = "sidx"; n.textContent = String(idx + 1).padStart(2, "0");
      shot.append(img, n, dlButton(f));
      shot.addEventListener("click", () => openPhoto(idx));
      grid.appendChild(shot);
    });
    s.appendChild(grid); parent.appendChild(s);
  }

  function renderFiles(files, parent) {
    const s = section("Files", files.length);
    const list = document.createElement("div"); list.className = "file-list";
    files.forEach((f) => {
      const a = document.createElement("a"); a.className = "file"; a.href = dlUrl(f); a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = `<span class="file-name"></span><span class="file-size"></span><span class="ar">↓</span>`;
      a.firstChild.textContent = f.name;
      a.children[1].textContent = fmtSize(f.size);
      list.appendChild(a);
    });
    s.appendChild(list); parent.appendChild(s);
  }

  function renderGroup(files, parent) {
    const vids = files.filter(isVideo), imgs = files.filter((f) => !isVideo(f) && isImage(f));
    const rest = files.filter((f) => !isFolder(f) && !isVideo(f) && !isImage(f));
    if (vids.length) renderVideos(vids, parent);
    if (imgs.length) renderPhotos(imgs, parent);
    if (rest.length) renderFiles(rest, parent);
  }

  /* subfolders (e.g. EDITED / RAW / SOCIAL) become their own blocks, one level deep */
  async function renderFolder(id, parent, depth) {
    const files = await listFolder(id);
    renderGroup(files, parent);
    const subs = files.filter(isFolder);
    for (const sub of subs) {
      const block = document.createElement("div"); block.className = "pool-folder";
      const h = document.createElement("h2"); h.className = "pool-folder-title";
      h.innerHTML = `<span class="ec tl"></span><span class="ec bl"></span><span></span>`;
      h.lastChild.textContent = sub.name;
      block.appendChild(h); parent.appendChild(block);
      if (depth < 2) await renderFolder(sub.id, block, depth + 1);
      else renderFiles([sub], block);
    }
    return files.length;
  }

  /* ---- load ---- */
  (async () => {
    try {
      const folder = await api(`${API}/${FID}?fields=id,name,mimeType&supportsAllDrives=true&key=${KEY}`);
      titleEl.textContent = folder.name;
      document.title = folder.name + " — CN Production";
      document.getElementById("poolZip").href = `https://drive.google.com/uc?export=download&id=${FID}`;
      document.getElementById("poolDrive").href = `https://drive.google.com/drive/folders/${FID}`;
      actions.hidden = false;
      statusEl.textContent = "Loading files…";
      const n = await renderFolder(FID, body, 0);
      statusEl.textContent = n ? "" : "This folder is empty.";
    } catch (e) {
      if (e.status === 404) fail("Folder not found — check the link, and that the folder is shared “Anyone with the link”.");
      else if (e.status === 403 || e.status === 400) fail("Can't read this folder. Check the API key (media-config.js) and that the folder is shared “Anyone with the link”.");
      else fail("Something went wrong loading the folder. Try again in a moment.");
    }
  })();

  /* ---- video player ---- */
  const vplay = document.getElementById("vplay");
  const vframe = document.getElementById("vplayFrame");
  function openVideo(f) {
    vframe.src = playUrl(f.id);
    document.getElementById("vplayCaption").textContent = f.name;
    document.getElementById("vplayDl").href = dlUrl(f);
    vplay.hidden = false; document.body.style.overflow = "hidden";
  }
  function closeVideo() { vplay.hidden = true; vframe.src = "about:blank"; document.body.style.overflow = ""; }
  document.getElementById("vplayClose").addEventListener("click", closeVideo);
  vplay.addEventListener("click", (e) => { if (e.target === vplay) closeVideo(); });

  /* ---- photo lightbox (same as show.js, full-res from Drive) ---- */
  const plight = document.getElementById("plight");
  const plightImg = document.getElementById("plightImg");
  const plightCaption = document.getElementById("plightCaption");
  const plightCount = document.getElementById("plightCount");
  const plightDl = document.getElementById("plightDl");
  let pShot = 0;

  function showPhoto() {
    if (!photos.length) return;
    pShot = ((pShot % photos.length) + photos.length) % photos.length;
    const f = photos[pShot];
    plightImg.src = thumb(f.id, 2400);
    plightCaption.textContent = f.name;
    plightDl.href = dlUrl(f);
    plightCount.textContent = String(pShot + 1).padStart(2, "0") + " / " + String(photos.length).padStart(2, "0");
    /* warm the neighbours so arrows feel instant */
    [pShot + 1, pShot - 1].forEach((i) => { const n = photos[((i % photos.length) + photos.length) % photos.length]; if (n) new Image().src = thumb(n.id, 2400); });
  }
  function openPhoto(i) { pShot = i; showPhoto(); plight.hidden = false; document.body.style.overflow = "hidden"; }
  function closePhoto() { plight.hidden = true; plightImg.src = ""; document.body.style.overflow = ""; }

  document.getElementById("plightPrev").addEventListener("click", () => { pShot--; showPhoto(); });
  document.getElementById("plightNext").addEventListener("click", () => { pShot++; showPhoto(); });
  document.getElementById("plightClose").addEventListener("click", closePhoto);
  plight.addEventListener("click", (e) => { if (e.target === plight) closePhoto(); });
  document.addEventListener("keydown", (e) => {
    if (!vplay.hidden && e.key === "Escape") { closeVideo(); return; }
    if (plight.hidden) return;
    if (e.key === "Escape") closePhoto();
    else if (e.key === "ArrowLeft") { pShot--; showPhoto(); }
    else if (e.key === "ArrowRight") { pShot++; showPhoto(); }
  });

  /* swipe between photos on touch */
  let tx = null;
  plight.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  plight.addEventListener("touchend", (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) { pShot += dx < 0 ? 1 : -1; showPhoto(); }
  });
})();
