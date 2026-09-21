/* CN Production — cut review. review.html?v=<Drive video link / YouTube link>[&n=<notes>]
   Client watches, pins timestamped notes, then SENDS: a link that carries all the notes inside it.
   No server — notes live in the browser (localStorage) and travel in the link. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const KEY = (typeof MEDIA !== "undefined" && MEDIA.apiKey) ? MEDIA.apiKey : "";
  const CONTACT = (typeof SITE !== "undefined" && SITE.email) ? SITE.email : "";
  const params = new URLSearchParams(location.search);

  /* ---- what are we reviewing? ---- */
  function parseSource(raw) {
    raw = (raw || "").trim();
    if (!raw) return null;
    let m;
    if ((m = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/))) return { kind: "yt", id: m[1] };
    if ((m = raw.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=|download\?.*id=)([\w-]{20,})/))) return { kind: "drive", id: m[1] };
    if (/^https?:\/\//i.test(raw)) return { kind: "url", id: raw };
    if (/^[\w-]{11}$/.test(raw)) return { kind: "yt", id: raw };
    if (/^[\w-]{20,}$/.test(raw)) return { kind: "drive", id: raw };
    return null;
  }
  const SRC = parseSource(params.get("v"));
  const titleEl = $("rvTitle"), statusEl = $("rvStatus");
  if (!SRC) { titleEl.textContent = "Review"; statusEl.textContent = "No video in the link. Use review.html?v=<Drive video link or YouTube link>"; return; }
  const STORE = "cn-review:" + SRC.kind + ":" + SRC.id;

  /* ---- time helpers ---- */
  const pad = (n) => String(n).padStart(2, "0");
  function fmt(t) {
    t = Math.max(0, t || 0);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
    return (h ? h + ":" : "") + pad(m) + ":" + pad(s);
  }
  function fmtFrames(t, fps) {
    const f = Math.round((t - Math.floor(t)) * fps);
    return fmt(t) + ":" + pad(Math.min(f, Math.ceil(fps) - 1));
  }

  /* ---- notes: encode / decode for the link ---- */
  const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  async function encodeNotes(notes) {
    const raw = new TextEncoder().encode(JSON.stringify(notes));
    if (typeof CompressionStream === "function") {
      const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
      return "z" + b64u(new Uint8Array(buf));
    }
    return "p" + b64u(raw);
  }
  async function decodeNotes(s) {
    if (!s) return [];
    try {
      const bytes = unb64u(s.slice(1));
      let raw = bytes;
      if (s[0] === "z") raw = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
      const arr = JSON.parse(new TextDecoder().decode(raw));
      return Array.isArray(arr) ? arr.filter((n) => n && typeof n.t === "number" && typeof n.x === "string") : [];
    } catch { return []; }
  }

  /* ---- state ---- */
  let notes = [];                 // {i:id, t:sec, a:author, x:text, d:fixed?1:0, c:created}
  let name = "";
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE) || "{}"); notes = s.notes || []; name = s.name || ""; } catch {}
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify({ notes, name })); } catch {} }
  function merge(incoming) {
    const seen = new Map(notes.map((n) => [n.i, n]));
    incoming.forEach((n) => {
      const mine = seen.get(n.i);
      if (!mine) notes.push(n);
      else if ((n.d || 0) !== (mine.d || 0) && (n.c || 0) >= (mine.c || 0)) mine.d = n.d;   // newest "fixed" state wins
    });
  }

  /* ---- player adapter: native <video> or YouTube ---- */
  const video = $("rvVideo"), ytBox = $("rvYt"), stage = $("rvStage");
  let P = null;   // { play, pause, seek, time, dur, playing }
  let ready = false;

  function nativePlayer(src) {
    video.hidden = false; video.src = src;
    let failed = false;
    video.addEventListener("loadedmetadata", () => { ready = true; setAspect(video.videoWidth / video.videoHeight); onReady(); });
    video.addEventListener("error", () => { if (!failed) { failed = true; statusEl.textContent = SRC.kind === "drive" ? "Can't play this Drive file. Check it's shared “Anyone with the link”, and that it's an .mp4 (H.264) — a ProRes/.mov export won't play in a browser." : "This video can't be played."; } });
    video.addEventListener("timeupdate", tick);
    video.addEventListener("progress", () => { try { const b = video.buffered; if (b.length && video.duration) $("rvBuffer").style.width = (b.end(b.length - 1) / video.duration * 100) + "%"; } catch {} });
    video.addEventListener("play", syncPlay); video.addEventListener("pause", syncPlay); video.addEventListener("ended", syncPlay);
    P = {
      play: () => video.play().catch(() => {}), pause: () => video.pause(),
      seek: (t) => { video.currentTime = Math.max(0, Math.min(t, video.duration || t)); tick(); },
      time: () => video.currentTime || 0, dur: () => video.duration || 0, playing: () => !video.paused && !video.ended,
    };
  }

  function ytPlayer(id) {
    ytBox.hidden = false;
    const tag = document.createElement("script"); tag.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(tag);
    let yt = null, poll = 0;
    window.onYouTubeIframeAPIReady = () => {
      yt = new YT.Player("rvYt", {
        videoId: id, playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, iv_load_policy: 3, origin: location.origin },
        events: {
          onReady: () => {
            ready = true;
            const d = yt.getVideoData && yt.getVideoData();
            if (d && d.title && !params.get("t")) titleEl.textContent = d.title, document.title = d.title + " — Review";
            onReady();
            poll = setInterval(tick, 200);
          },
          onStateChange: syncPlay,
        },
      });
    };
    P = {
      play: () => yt && yt.playVideo(), pause: () => yt && yt.pauseVideo(),
      seek: (t) => { if (yt) { yt.seekTo(Math.max(0, t), true); tick(); } },
      time: () => (yt && yt.getCurrentTime) ? yt.getCurrentTime() : 0,
      dur: () => (yt && yt.getDuration) ? yt.getDuration() : 0,
      playing: () => !!yt && yt.getPlayerState && yt.getPlayerState() === 1,
    };
  }

  function setAspect(a) { if (a > 0) stage.style.setProperty("--va", a.toFixed(4)); }

  /* ---- controls ---- */
  const cur = $("rvCur"), dur = $("rvDur"), track = $("rvTrack"), progress = $("rvProgress"), headPin = $("rvHeadPin");
  const playBtn = $("rvPlay"), bigPlay = $("rvBigPlay"), addAt = $("rvAddAt");
  const fpsSel = $("rvFps");
  const fps = () => parseFloat(fpsSel.value) || 25;
  fpsSel.addEventListener("change", () => { render(); tick(); });

  function tick() {
    if (!P) return;
    const t = P.time(), d = P.dur();
    cur.textContent = fmt(t); dur.textContent = fmt(d);
    const pct = d ? (t / d * 100) : 0;
    progress.style.width = pct + "%"; headPin.style.left = pct + "%";
    if (!composing) addAt.textContent = fmtFrames(t, fps());
  }
  function syncPlay() {
    const on = P && P.playing();
    playBtn.textContent = on ? "❚❚" : "▶";
    bigPlay.hidden = !!on;
    stage.classList.toggle("playing", !!on);
  }
  function toggle() { if (!P || !ready) return; P.playing() ? P.pause() : P.play(); }
  playBtn.addEventListener("click", toggle);
  bigPlay.addEventListener("click", toggle);
  $("rvMedia").addEventListener("click", () => { if (SRC.kind !== "yt") toggle(); });
  $("rvBack").addEventListener("click", () => { P && P.pause(); P && P.seek(P.time() - 1 / fps()); });
  $("rvFwd").addEventListener("click", () => { P && P.pause(); P && P.seek(P.time() + 1 / fps()); });
  $("rvFull").addEventListener("click", () => {
    const el = stage;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen();
    else if (video.webkitEnterFullscreen && SRC.kind !== "yt") video.webkitEnterFullscreen();
  });

  /* scrub */
  let scrubbing = false;
  function seekFromEvent(e) {
    const r = track.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const p = Math.max(0, Math.min(1, x / r.width));
    P && P.seek(p * P.dur());
  }
  track.addEventListener("pointerdown", (e) => { if (e.target.closest(".rv-mark")) return; scrubbing = true; track.setPointerCapture(e.pointerId); seekFromEvent(e); });
  track.addEventListener("pointermove", (e) => { if (scrubbing) seekFromEvent(e); });
  track.addEventListener("pointerup", () => { scrubbing = false; });
  track.addEventListener("pointercancel", () => { scrubbing = false; });

  /* keys: space play/pause · ←/→ 5s · shift+←/→ 1 frame · N new note · Esc cancel */
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === "Escape" && composing) { cancelCompose(); return; }
    if (typing) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); P && P.seek(P.time() - (e.shiftKey ? 1 / fps() : 5)); if (e.shiftKey) P && P.pause(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); P && P.seek(P.time() + (e.shiftKey ? 1 / fps() : 5)); if (e.shiftKey) P && P.pause(); }
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); startCompose(); }
    else if (e.key === "f") { $("rvFull").click(); }
  });

  /* ---- compose a note ---- */
  const form = $("rvForm"), addBtn = $("rvAdd"), nameIn = $("rvName"), textIn = $("rvText"), formAt = $("rvFormAt");
  let composing = false, composeT = 0;
  function startCompose() {
    if (!ready) return;
    P.pause();
    composeT = P.time(); composing = true;
    formAt.textContent = fmtFrames(composeT, fps());
    nameIn.value = name;
    form.hidden = false; addBtn.hidden = true;
    (name ? textIn : nameIn).focus();
  }
  function cancelCompose() { composing = false; form.hidden = true; addBtn.hidden = false; textIn.value = ""; tick(); }
  addBtn.addEventListener("click", startCompose);
  $("rvCancel").addEventListener("click", cancelCompose);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const x = textIn.value.trim();
    if (!x) { textIn.focus(); return; }
    name = nameIn.value.trim();
    notes.push({ i: Math.random().toString(36).slice(2, 9), t: Math.round(composeT * 100) / 100, a: name, x, d: 0, c: Date.now() });
    save(); render(); cancelCompose();
  });
  textIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

  /* ---- render notes + markers ---- */
  const list = $("rvNotes"), marks = $("rvMarks"), count = $("rvCount"), empty = $("rvEmpty");
  function render() {
    notes.sort((a, b) => a.t - b.t);
    list.innerHTML = ""; marks.innerHTML = "";
    const d = P ? P.dur() : 0;
    notes.forEach((n) => {
      const row = document.createElement("div"); row.className = "rv-note" + (n.d ? " fixed" : "");
      row.innerHTML = `<button class="rv-tc" type="button"></button><div class="rv-body"><span class="rv-author"></span><span class="rv-x"></span></div><label class="rv-fix"><input type="checkbox" /> <span>Fixed</span></label><button class="rv-del" type="button" title="Delete">✕</button>`;
      row.querySelector(".rv-tc").textContent = fmtFrames(n.t, fps());
      row.querySelector(".rv-author").textContent = n.a || "";
      row.querySelector(".rv-x").textContent = n.x; row.querySelector(".rv-x").dir = "auto";
      const cb = row.querySelector("input"); cb.checked = !!n.d;
      cb.addEventListener("change", () => { n.d = cb.checked ? 1 : 0; n.c = Date.now(); save(); render(); });
      row.querySelector(".rv-tc").addEventListener("click", () => { P && P.pause(); P && P.seek(n.t); stage.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
      row.querySelector(".rv-del").addEventListener("click", () => { if (confirm("Delete this note?")) { notes = notes.filter((m) => m !== n); save(); render(); } });
      list.appendChild(row);

      const mk = document.createElement("button"); mk.className = "rv-mark" + (n.d ? " fixed" : ""); mk.type = "button";
      mk.style.left = d ? (n.t / d * 100) + "%" : "0"; mk.title = fmtFrames(n.t, fps()) + " — " + n.x;
      mk.addEventListener("click", (e) => { e.stopPropagation(); P && P.pause(); P && P.seek(n.t); row.scrollIntoView({ behavior: "smooth", block: "center" }); row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 900); });
      marks.appendChild(mk);
    });
    count.textContent = pad(notes.length);
    empty.hidden = notes.length > 0;
    updateSend();
  }

  /* ---- send: link that carries the notes ---- */
  const wa = $("rvWa"), mail = $("rvMail"), copyBtn = $("rvCopy"), copyLabel = $("rvCopyLabel");
  let shareLink = location.href;
  async function updateSend() {
    const u = new URL(location.href);
    u.searchParams.delete("n");
    if (notes.length) u.searchParams.set("n", await encodeNotes(notes));
    shareLink = u.toString();
    const title = titleEl.textContent;
    const msg = `Notes on "${title}" (${notes.length}):\n${shareLink}`;
    wa.href = "https://wa.me/?text=" + encodeURIComponent(msg);
    mail.href = (CONTACT ? "mailto:" + CONTACT : "mailto:") + "?subject=" + encodeURIComponent("Notes: " + title) + "&body=" + encodeURIComponent(msg);
  }
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareLink); copyLabel.textContent = "Copied ✓"; }
    catch { prompt("Copy this link:", shareLink); }
    setTimeout(() => { copyLabel.textContent = "Copy link"; }, 1800);
  });

  /* ---- export for the edit ---- */
  function download(name, text, type) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const safeName = () => (titleEl.textContent || "review").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60);
  /* CMX3600 EDL with Resolve marker lines. Record timecode starts at 01:00:00:00 (Resolve's default). */
  function tcAt(t, f) {
    const total = Math.round(t * f) + Math.round(3600 * f);
    const fr = Math.round(f) || 25;
    const frames = total % fr, s = Math.floor(total / fr);
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}:${pad(frames)}`;
  }
  $("rvEdl").addEventListener("click", () => {
    const f = fps();
    let out = `TITLE: ${safeName()}\nFCM: NON-DROP FRAME\n\n`;
    notes.forEach((n, i) => {
      const inT = tcAt(n.t, f), outT = tcAt(n.t + 1 / f, f);
      const text = ((n.a ? n.a + ": " : "") + n.x).replace(/\s+/g, " ");
      out += `${pad(i + 1).padStart(3, "0")}  001      V     C        ${inT} ${outT} ${inT} ${outT}  \n |C:${n.d ? "ResolveColorGreen" : "ResolveColorYellow"} |M:${text} |D:1\n\n`;
    });
    download(safeName() + " — markers.edl", out, "text/plain");
  });
  $("rvTxt").addEventListener("click", () => {
    const f = fps();
    const out = `${titleEl.textContent}\n${notes.length} notes\n\n` + notes.map((n) => `${fmtFrames(n.t, f)}  ${n.d ? "[FIXED] " : ""}${n.a ? n.a + ": " : ""}${n.x}`).join("\n") + "\n";
    download(safeName() + " — notes.txt", out, "text/plain");
  });

  /* ---- boot ---- */
  function onReady() { render(); tick(); syncPlay(); statusEl.textContent = ""; }

  (async () => {
    load();
    merge(await decodeNotes(params.get("n")));
    save();
    if (params.get("n")) { const u = new URL(location.href); u.searchParams.delete("n"); history.replaceState(null, "", u); }   // notes are safe in storage; keep the bar clean

    const t = params.get("t");
    if (t) { titleEl.textContent = t; document.title = t + " — Review"; }
    else titleEl.textContent = "Review";

    if (SRC.kind === "drive") {
      /* Drive's download/preview hosts refuse cross-site playback (403), but the Drive API's
         media endpoint streams the file with Range support when called with the site's API key. */
      if (!KEY) { statusEl.textContent = "Setup needed: the Drive API key is missing (media-config.js)."; return; }
      if (!t) {
        try {
          const r = await fetch(`https://www.googleapis.com/drive/v3/files/${SRC.id}?fields=name&supportsAllDrives=true&key=${KEY}`);
          if (r.ok) { const f = await r.json(); titleEl.textContent = f.name.replace(/\.\w{2,4}$/, ""); document.title = titleEl.textContent + " — Review"; }
        } catch {}
      }
      nativePlayer(`https://www.googleapis.com/drive/v3/files/${SRC.id}?alt=media&supportsAllDrives=true&key=${KEY}`);
    } else if (SRC.kind === "url") {
      nativePlayer(SRC.id);
    } else {
      ytPlayer(SRC.id);
    }
    statusEl.textContent = "Loading video…";
    render();
  })();
})();
