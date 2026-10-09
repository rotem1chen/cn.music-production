#!/usr/bin/env node
/* CN PROD — fetch YouTube "storyboard" sprite sheets for the film scrub.
   Run from the repo root:   node tools/storyboards.mjs           (only films that are new)
                             node tools/storyboards.mjs --force   (re-fetch every film)

   For each YouTube film in clips.js (and social.js / restaurant.js) it asks yt-dlp for the video's
   metadata ONCE, picks the ~160px storyboard level (YouTube's L2, "sb1"), downloads that level's
   sprite sheets into photos/storyboards/<id>/ and writes storyboards.js:

     window.STORYBOARDS = { <id>: { sheets:[...], cols, rows, w, h, count, interval, duration } }

   The sheets are kept in the repo because their URLs carry a per-video signature (`sigh`) that
   YouTube can rotate; the local copies never expire. Films already in storyboards.js with their
   files on disk are skipped, so a re-run only talks to YouTube about new films.
   Be polite: one yt-dlp call per film, one request per sheet, no retries. Google rate-limits an IP
   that hammers it (see CLAUDE.md). */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JS = join(ROOT, "storyboards.js");
const OUT_DIR = "photos/storyboards";
const WANT_W = 160;                      // frame width to aim for: sharp enough for a tile, light to load
const force = process.argv.includes("--force");

// --- the films: evaluate the config files the same way the browser does
const ctx = vm.createContext({});
for (const f of ["clips.js", "social.js", "restaurant.js"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  vm.runInContext(readFileSync(p, "utf8").replace(/^\s*const\s+/gm, "var "), ctx, { filename: f });
}
const urls = [].concat(ctx.CLIPS || [], ctx.SOCIAL || [], ctx.RESTAURANT || []).map((c) => c && c.url).filter(Boolean);
const ids = [...new Set(urls.map((u) => {
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m && m[1];
}).filter(Boolean))];

// --- what we already have
let have = {};
if (existsSync(OUT_JS)) {
  const c = vm.createContext({ window: {} });
  try { vm.runInContext(readFileSync(OUT_JS, "utf8"), c); have = c.window.STORYBOARDS || {}; } catch (_) {}
}
const complete = (e) => e && Array.isArray(e.sheets) && e.sheets.length && e.sheets.every((s) => existsSync(join(ROOT, s)));

const out = {};
let total = 0;
for (const id of ids) {
  if (!force && complete(have[id])) { out[id] = have[id]; console.log(`= ${id}  (kept, ${have[id].sheets.length} sheets)`); continue; }
  const r = spawnSync("yt-dlp", ["-j", "--skip-download", "--no-warnings", "--no-playlist", `https://www.youtube.com/watch?v=${id}`],
    { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0 || !r.stdout) {
    console.warn(`! ${id}  yt-dlp failed: ${(r.stderr || "").trim().split("\n").pop()}`);
    if (complete(have[id])) out[id] = have[id];          // keep the old copy rather than losing it
    continue;
  }
  const info = JSON.parse(r.stdout);
  const boards = (info.formats || []).filter((f) => f.format_note === "storyboard" && Array.isArray(f.fragments) && f.fragments.length && f.width);
  if (!boards.length) { console.warn(`! ${id}  no storyboards`); continue; }
  // the level whose frames are closest to WANT_W wide (ties → the bigger one)
  boards.sort((a, b) => Math.abs(a.width - WANT_W) - Math.abs(b.width - WANT_W) || b.width - a.width);
  const sb = boards[0];
  const duration = info.duration || sb.fragments.reduce((s, f) => s + (f.duration || 0), 0);
  const per = sb.rows * sb.columns;
  const count = Math.max(1, Math.min(per * sb.fragments.length, Math.round(duration * sb.fps)));

  const dir = join(ROOT, OUT_DIR, id);
  if (existsSync(dir)) for (const f of readdirSync(dir)) rmSync(join(dir, f));
  mkdirSync(dir, { recursive: true });
  const sheets = [];
  let bytes = 0, ok = true;
  for (let k = 0; k < sb.fragments.length; k++) {
    const res = await fetch(sb.fragments[k].url);
    if (!res.ok) { console.warn(`! ${id}  sheet ${k}: HTTP ${res.status}`); ok = false; break; }
    const type = res.headers.get("content-type") || "";
    const ext = /webp/.test(type) ? "webp" : /png/.test(type) ? "png" : "jpg";
    const buf = Buffer.from(await res.arrayBuffer());
    const rel = `${OUT_DIR}/${id}/M${k}.${ext}`;
    writeFileSync(join(ROOT, rel), buf);
    sheets.push(rel); bytes += buf.length;
  }
  if (!ok) { if (complete(have[id])) out[id] = have[id]; continue; }
  total += bytes;
  out[id] = { sheets, cols: sb.columns, rows: sb.rows, w: sb.width, h: sb.height, count,
              interval: +(duration / count).toFixed(4), duration: +(+duration).toFixed(2) };
  console.log(`+ ${id}  ${sb.format_id} ${sb.width}x${sb.height}, ${sb.columns}x${sb.rows} grid, ${sheets.length} sheets, ${count} frames, ${(bytes / 1024).toFixed(0)} KB`);
}

// drop folders of films that are gone
const keep = new Set(Object.keys(out));
if (existsSync(join(ROOT, OUT_DIR))) for (const d of readdirSync(join(ROOT, OUT_DIR))) {
  if (!keep.has(d) && /^[A-Za-z0-9_-]{11}$/.test(d)) { rmSync(join(ROOT, OUT_DIR, d), { recursive: true }); console.log(`- ${d}  (removed, no longer a film)`); }
}

const body = Object.entries(out).map(([id, e]) => `  ${JSON.stringify(id)}: ${JSON.stringify(e)},`).join("\n");
writeFileSync(OUT_JS,
  "/* GENERATED by `node tools/storyboards.mjs` — do not edit by hand.\n" +
  "   Film scrub frames: YouTube storyboard sprite sheets, copied into photos/storyboards/<id>/.\n" +
  "   sheets: cols x rows frames of w x h each, left→right, top→bottom; `count` frames over `duration` s. */\n" +
  "window.STORYBOARDS = {\n" + body + "\n};\n");
console.log(`\nstoryboards.js: ${Object.keys(out).length}/${ids.length} films` + (total ? `, ${(total / 1024).toFixed(0)} KB downloaded` : ""));
