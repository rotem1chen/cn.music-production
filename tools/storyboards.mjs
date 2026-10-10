#!/usr/bin/env node
/* CN PROD — make the film-scrub frames from the films themselves.
   Run from the repo root:   node tools/storyboards.mjs           (only films that are new)
                             node tools/storyboards.mjs --force   (re-make every film)

   For each YouTube film in clips.js (and social.js / restaurant.js) it takes 48 frames spread evenly
   across the film, 360px tall (640x360 for a 16:9 film), and packs them 4x3 into JPEG sheets in
   photos/scrub/<id>/, then writes storyboards.js:

     window.STORYBOARDS = { <id>: { sheets:[...], cols, rows, w, h, count, interval, duration } }

   (YouTube's own storyboards are only 160px wide — too soft to see anything in a tile.)

   The source video comes from ~/.cache/cn-scrub/<id>.mp4. If it isn't there, yt-dlp downloads it ONCE
   (video only, up to 720p) — be polite: one download per film, no retries. Google rate-limits an IP
   that hammers it (see CLAUDE.md). Needs ffmpeg + yt-dlp (Homebrew). */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JS = join(ROOT, "storyboards.js");
const OUT_DIR = "photos/scrub";
const CACHE = join(homedir(), ".cache", "cn-scrub");
const COUNT = 48, COLS = 4, ROWS = 3, H = 360, QUALITY = 4;   // JPEG q:v (2 best … 31 worst)
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

// --- what's already made
const prev = {};
if (existsSync(OUT_JS)) {
  const c2 = vm.createContext({ window: {} });
  try { vm.runInContext(readFileSync(OUT_JS, "utf8"), c2); Object.assign(prev, c2.window.STORYBOARDS || {}); } catch (_) {}
}
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const out = {};
mkdirSync(CACHE, { recursive: true });

for (const id of ids) {
  const dir = join(ROOT, OUT_DIR, id);
  const have = prev[id] && prev[id].sheets && prev[id].sheets[0] && prev[id].sheets[0].startsWith(OUT_DIR) &&
    prev[id].sheets.every((s) => existsSync(join(ROOT, s)));
  if (have && !force) { out[id] = prev[id]; console.log(`  ${id}: kept`); continue; }

  let src = join(CACHE, id + ".mp4");
  if (!existsSync(src)) {
    console.log(`  ${id}: downloading the film once (video only, ≤720p)…`);
    const d = run("yt-dlp", ["-q", "--no-warnings", "-f", "bv*[height<=720][ext=mp4]/bv*[height<=720]", "-o", src, "--", id]);
    if (d.status !== 0 || !existsSync(src)) { console.log(`  ${id}: not available (${(d.stderr || "").trim().split("\n").pop()}) — skipped`); continue; }
  }
  const dur = parseFloat(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).stdout);
  if (!(dur > 0)) { console.log(`  ${id}: can't read the video — skipped`); continue; }

  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  // 48 frames at the middle of 48 equal slices of the film, 360px tall, packed 4x3 per sheet
  const step = dur / COUNT;
  const vf = `fps=1/${step.toFixed(4)}:start_time=${(step / 2).toFixed(4)},scale=-2:${H}:flags=lanczos,tile=${COLS}x${ROWS}`;
  const r = run("ffmpeg", ["-loglevel", "error", "-y", "-ss", "0", "-i", src, "-an", "-vf", vf,
    "-frames:v", String(Math.ceil(COUNT / (COLS * ROWS))), "-c:v", "mjpeg", "-q:v", String(QUALITY), join(dir, "M%d.jpg")]);
  if (r.status !== 0) { console.log(`  ${id}: ffmpeg failed — ${r.stderr.trim().split("\n").pop()}`); continue; }
  // smaller to send: WebP via cwebp when it's installed (Homebrew `webp`), else the JPEGs stay
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".jpg"))) {
    const j = join(dir, f), wp = j.replace(/\.jpg$/, ".webp");
    if (run("cwebp", ["-quiet", "-q", "74", "-m", "6", j, "-o", wp]).status === 0 && existsSync(wp)) rmSync(j);
  }
  const files = readdirSync(dir).filter((f) => /^M\d+\.(webp|jpg)$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  // ffmpeg numbers from 1; keep it, the order is what matters
  const probe = run("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", join(dir, files[0])]).stdout.trim().split(",");
  const w = Math.round(+probe[0] / COLS), h = Math.round(+probe[1] / ROWS);
  out[id] = { sheets: files.map((f) => `${OUT_DIR}/${id}/${f}`), cols: COLS, rows: ROWS, w, h, count: COUNT, interval: +step.toFixed(4), duration: Math.round(dur) };
  console.log(`  ${id}: ${files.length} sheets, ${w}x${h} frames, ${Math.round(dur)}s`);
}

const body = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
writeFileSync(OUT_JS, `/* GENERATED by \`node tools/storyboards.mjs\` — do not edit by hand.
   Film scrub frames: 48 frames per film made from the film itself (360px tall), in photos/scrub/<id>/.
   sheets: cols x rows frames of w x h each, left→right, top→bottom; \`count\` frames over \`duration\` s. */
window.STORYBOARDS = {
${body}
};
`);
console.log(`wrote storyboards.js (${Object.keys(out).length} films)`);
