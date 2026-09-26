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
  /* Drive reports the real pixel size in videoMediaMetadata — use it so vertical and
     square cuts are not crushed into a 16:9 box. 0 = unknown, caller falls back to 16:9. */
  const aspectOf = (f) => {
    const m = f.videoMediaMetadata;
    return (m && m.width > 0 && m.height > 0) ? m.width / m.height : 0;
  };
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
      const a = aspectOf(f);
      if (a) t.style.setProperty("--va", a.toFixed(4));
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
      document.title = folder.name + " — CN PROD";
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
  const vstage = document.getElementById("vplayStage");
  const vframe = document.getElementById("vplayFrame");
  const vvideo = document.getElementById("vplayVideo");
  /* Drive API media endpoint: the only Drive URL that streams to a <video> on another
     site (download/preview hosts answer 403 to cross-site requests). Supports Range. */
  const streamUrl = (id) => `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true&key=${KEY}`;
  let vTimer = null;

  /* Drive's own player: last resort. Its controls are fixed-size and live in a
     cross-origin iframe, so they cannot be restyled — hence trying native first. */
  function useDriveFrame(f) {
    clearTimeout(vTimer);
    vvideo.hidden = true; vvideo.removeAttribute("src"); vvideo.load();
    vframe.hidden = false; vframe.src = playUrl(f.id);
  }

  /* ---- loader UI (inside the video box) ---- */
  const vload = document.getElementById("vLoad"), vPct = document.getElementById("vLoadPct"),
        vFill = document.getElementById("vLoadFill"), vMeta = document.getElementById("vLoadMeta"),
        vPoster = document.getElementById("vLoadPoster");
  function showLoader(posterUrl) {
    vload.hidden = false; vload.classList.remove("done");
    vPct.textContent = "0%"; vFill.style.width = "0%"; vMeta.textContent = "";
    if (posterUrl) { vPoster.src = posterUrl; vPoster.onload = () => { vPoster.hidden = false; }; }
  }
  function loaderProgress(got, total, t0) {
    const pct = total ? Math.min(100, got / total * 100) : 0;
    vPct.textContent = total ? Math.floor(pct) + "%" : Math.round(got / 1e6) + " MB";
    vFill.style.width = pct + "%";
    const secs = (performance.now() - t0) / 1000, rate = secs > 0.3 ? got / secs / 1e6 : 0;
    vMeta.textContent = (total ? Math.round(got / 1e6) + " / " + Math.round(total / 1e6) + " MB" : "")
                      + (rate ? " · " + rate.toFixed(1) + " MB/s" : "");
  }
  function hideLoader() {
    vload.classList.add("done");
    setTimeout(() => { vload.hidden = true; vload.classList.remove("done"); vPoster.hidden = true; }, 500);
  }

  /* ---- Drive download: whole file into memory, in parallel ranges ----
     Same approach review.js uses. Streaming the API endpoint straight into a <video>
     stutters (~2s per seek, no CDN) and invites Google's per-IP rate limiting, so the
     file is pulled once, cached, and played from a blob. */
  const CHUNK = 4 * 1024 * 1024, CONC = 6;
  async function readAll(r, onBytes) {
    const reader = r.body.getReader(), parts = []; let n = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; onBytes(value.length); }
    const out = new Uint8Array(n); let o = 0; parts.forEach((c) => { out.set(c, o); o += c.length; });
    return out;
  }
  async function driveBlob(url, size) {
    let cache = null;
    try { cache = await caches.open("cn-media-video"); } catch (_) {}
    const hit = cache && await cache.match(url);
    if (hit) { loaderProgress(1, 1, performance.now()); return URL.createObjectURL(await hit.blob()); }

    const t0 = performance.now(); let got = 0, total = Number(size) || 0, type = "video/mp4";
    const tick = (n) => { got += n; loaderProgress(got, total, t0); };
    const get = (a, b) => fetch(url, { mode: "cors", credentials: "omit", headers: { Range: `bytes=${a}-${b}` } });

    const r0 = await get(0, CHUNK - 1);
    type = r0.headers.get("content-type") || type;
    if (!r0.ok || !/^(video|audio)\//.test(type)) throw new Error("not video");   // HTML error page → fall back
    if (r0.status === 200 || !total) {                       // server ignored the range → single stream
      if (!total) total = Number(r0.headers.get("content-length")) || 0;
      return finish(new Blob([await readAll(r0, tick)], { type }));
    }
    const parts = [await readAll(r0, tick)];
    const ranges = []; for (let a = CHUNK; a < total; a += CHUNK) ranges.push([a, Math.min(a + CHUNK, total) - 1]);
    let next = 0;
    async function worker() {
      while (next < ranges.length) {
        const i = next++, [a, b] = ranges[i];
        let r = await get(a, b);
        if (r.status !== 206) { r = await get(a, b); if (r.status !== 206) throw new Error("range " + r.status); }
        parts[i + 1] = await readAll(r, tick);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, ranges.length) }, worker));
    return finish(new Blob(parts, { type }));

    function finish(blob) {
      loaderProgress(blob.size, blob.size, t0);
      if (cache) cache.put(url, new Response(blob, { headers: { "Content-Type": type, "Content-Length": String(blob.size) } })).catch(() => {});
      return URL.createObjectURL(blob);
    }
  }

  let blobUrl = null;
  function dropBlob() { if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; } }

  async function useNative(f) {
    vframe.hidden = true; vframe.src = "about:blank";
    vvideo.hidden = false;
    showLoader(f.thumb || f.v && f.v.thumb || thumb(f.id, 800));
    let settled = false;
    const giveUp = () => { if (!settled) { settled = true; hideLoader(); useDriveFrame(f); } };
    vvideo.onerror = giveUp;
    vvideo.onloadedmetadata = () => { settled = true; hideLoader(); };
    try {
      dropBlob();
      blobUrl = await driveBlob(streamUrl(f.id), f.size);
      if (settled) return;                        // closed or already fell back while downloading
      vvideo.src = blobUrl;
      vvideo.play && vvideo.play().catch(() => {});   // autoplay refusal is fine, controls are there
    } catch (_) {
      giveUp();
    }
  }

  function openVideo(f) {
    const a = aspectOf(f);
    vstage.style.setProperty("--va", (a || 1.7778).toFixed(4));
    document.getElementById("vplayCaption").textContent = f.name;
    document.getElementById("vplayDl").href = dlUrl(f);
    vplay.hidden = false; document.body.style.overflow = "hidden";
    useNative(f);
  }
  function closeVideo() {
    clearTimeout(vTimer); hideLoader(); dropBlob();
    vplay.hidden = true;
    vframe.src = "about:blank"; vframe.hidden = true;
    vvideo.pause && vvideo.pause(); vvideo.removeAttribute("src"); vvideo.load(); vvideo.hidden = true;
    document.body.style.overflow = "";
  }
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
