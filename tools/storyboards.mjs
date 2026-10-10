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
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from "node:fs";
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
// the grid frames: eight stills for the boxes around the opening film, in story order clockwise —
// one from each eighth of the film, the best of ~12 candidates there that has a SUBJECT in it (a face or a
// person, found by Apple's Vision via tools/frame-score.swift), is well exposed and sharp. Never a black
// frame, a blank sky or a blur.
const CELLS = 8, CANDIDATES = 96, CELL_H = 540;
const force = process.argv.includes("--force"), reCells = process.argv.includes("--cells");

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

// the scorer is compiled once (swiftc), then reused for every film
const SCORER = join(CACHE, "frame-score");
function scorer() {
  const sw = join(ROOT, "tools", "frame-score.swift");
  if (!existsSync(SCORER) || statSync(sw).mtimeMs > statSync(SCORER).mtimeMs) {
    const c = run("swiftc", ["-O", sw, "-o", SCORER]);
    if (c.status !== 0) throw new Error("couldn't build tools/frame-score.swift: " + c.stderr);
  }
  return SCORER;
}
function pickCells(id, src, dur, dir) {
  const tmp = join(CACHE, id + "-cand");
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  // candidates evenly over 3%–97% of the film (skips the fade-in and the end card)
  const a = dur * 0.03, span = dur * 0.94, step = span / CANDIDATES;
  run("ffmpeg", ["-loglevel", "error", "-y", "-ss", a.toFixed(2), "-t", span.toFixed(2), "-i", src, "-an",
    "-vf", `fps=1/${step.toFixed(4)},scale=-2:${CELL_H}:flags=lanczos`, "-q:v", "3", join(tmp, "c%03d.jpg")]);
  const files = readdirSync(tmp).filter((f) => f.endsWith(".jpg")).sort().map((f) => join(tmp, f));
  const res = run(scorer(), files).stdout.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const scored = res.map((r, i) => {
    const subj = r.faceArea > 0.003 ? 1.4 + Math.min(r.faceArea * 25, 1) : r.personArea > 0.04 ? 1 + Math.min(r.personArea, 0.6) : 0;
    const exposed = r.lum > 0.12 && r.lum < 0.86 && r.std > 0.1;
    const sharp = Math.min(r.detail / 0.06, 1);
    return { ...r, i, subj, good: subj > 0 && exposed && r.detail > 0.025, score: subj * 3 + sharp * 1.5 + Math.min(r.std * 4, 1) - Math.abs(r.lum - 0.42) };
  });
  const per = scored.length / CELLS, picks = [];
  // the same shot twice (a repeated set-up, or one long take) looks the same in the 16x9 fingerprint
  const sameShot = (x, y) => x.sig.reduce((t, v, k) => t + Math.abs(v - y.sig[k]), 0) / x.sig.length < 9;
  const free = (c) => picks.every((p) => Math.abs(p.i - c.i) >= 3);
  const fresh = (c) => free(c) && !picks.some((p) => sameShot(p, c));
  const near = (n) => (x, y) => Math.abs(x.i - (n + 0.5) * per) - Math.abs(y.i - (n + 0.5) * per);
  const byScore = (x, y) => y.score - x.score;
  for (let n = 0; n < CELLS; n++) {
    const seg = scored.slice(Math.floor(n * per), Math.floor((n + 1) * per));
    // best: a good, new-looking shot from this eighth; else one from nearby in the film; only then
    // settle for a repeat of a shot already used, and last of all anything in this eighth
    const best = seg.filter((c) => c.good && fresh(c)).sort(byScore)[0] ||
      scored.filter((c) => c.good && fresh(c)).sort(near(n))[0] ||
      seg.filter((c) => c.good && free(c)).sort(byScore)[0] ||
      scored.filter((c) => c.good && free(c)).sort(near(n))[0] ||
      seg.filter(free).sort(byScore)[0] || seg[0];
    picks.push(best);
  }
  picks.sort((x, y) => x.i - y.i);                       // keep story order around the grid
  const cells = [], focus = [];
  readdirSync(dir).filter((f) => /^G\d+\./.test(f)).forEach((f) => rmSync(join(dir, f)));
  picks.forEach((c, n) => {
    const wp = join(dir, `G${n + 1}.webp`);
    if (run("cwebp", ["-quiet", "-q", "74", "-m", "6", c.path, "-o", wp]).status !== 0) copyFileSync(c.path, wp.replace(/webp$/, "jpg"));
    cells.push(`${OUT_DIR}/${id}/${existsSync(wp) ? `G${n + 1}.webp` : `G${n + 1}.jpg`}`);
    focus.push([+(c.fx ?? 0.5).toFixed(3), +(c.fy ?? 0.4).toFixed(3)]);
  });
  rmSync(tmp, { recursive: true, force: true });
  const weak = picks.filter((c) => !c.good).length;
  const repeats = picks.filter((c, k) => picks.some((p, j) => j < k && sameShot(p, c))).length;
  console.log(`  ${id}: grid stills ${picks.map((c) => (c.faceArea > 0.003 ? "F" : c.personArea > 0.04 ? "P" : "·")).join("")}${weak ? ` (${weak} without a clear subject)` : ""}${repeats ? ` (${repeats} similar — the film has few set-ups)` : ""}`);
  return { cells, focus };
}

for (const id of ids) {
  const dir = join(ROOT, OUT_DIR, id);
  const have = prev[id] && prev[id].sheets && prev[id].sheets[0] && prev[id].sheets[0].startsWith(OUT_DIR) &&
    prev[id].sheets.every((s) => existsSync(join(ROOT, s)));
  const haveKeys = have && !reCells && prev[id].cells && prev[id].cells.length === CELLS && prev[id].focus &&
    prev[id].cells.every((s) => existsSync(join(ROOT, s)));
  if (have && haveKeys && !force) { out[id] = prev[id]; console.log(`  ${id}: kept`); continue; }

  let src = join(CACHE, id + ".mp4");
  if (!existsSync(src)) {
    console.log(`  ${id}: downloading the film once (video only, ≤720p)…`);
    const d = run("yt-dlp", ["-q", "--no-warnings", "-f", "bv*[height<=720][ext=mp4]/bv*[height<=720]", "-o", src, "--", id]);
    if (d.status !== 0 || !existsSync(src)) { console.log(`  ${id}: not available (${(d.stderr || "").trim().split("\n").pop()}) — skipped`); continue; }
  }
  const dur = parseFloat(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).stdout);
  if (!(dur > 0)) { console.log(`  ${id}: can't read the video — skipped`); continue; }

  const keysOnly = have && !force;                    // sheets are fine, only the grid stills are new
  if (!keysOnly) { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); }
  const { cells, focus } = pickCells(id, src, dur, dir);
  if (keysOnly) { const { keys, ...rest } = prev[id]; out[id] = { ...rest, cells, focus }; continue; }
  // 48 frames at the middle of 48 equal slices of the film, 360px tall, packed 4x3 per sheet
  const step = dur / COUNT;
  const vf = `fps=1/${step.toFixed(4)}:start_time=${(step / 2).toFixed(4)},scale=-2:${H}:flags=lanczos,tile=${COLS}x${ROWS}`;
  const r = run("ffmpeg", ["-loglevel", "error", "-y", "-ss", "0", "-i", src, "-an", "-vf", vf,
    "-frames:v", String(Math.ceil(COUNT / (COLS * ROWS))), "-c:v", "mjpeg", "-q:v", String(QUALITY), join(dir, "M%d.jpg")]);
  if (r.status !== 0) { console.log(`  ${id}: ffmpeg failed — ${r.stderr.trim().split("\n").pop()}`); continue; }
  // smaller to send: WebP via cwebp when it's installed (Homebrew `webp`), else the JPEGs stay
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".jpg"))) {
    if (f.startsWith("G")) continue;
    const j = join(dir, f), wp = j.replace(/\.jpg$/, ".webp");
    if (run("cwebp", ["-quiet", "-q", "74", "-m", "6", j, "-o", wp]).status === 0 && existsSync(wp)) rmSync(j);
  }
  const files = readdirSync(dir).filter((f) => /^M\d+\.(webp|jpg)$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  // ffmpeg numbers from 1; keep it, the order is what matters
  const probe = run("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", join(dir, files[0])]).stdout.trim().split(",");
  const w = Math.round(+probe[0] / COLS), h = Math.round(+probe[1] / ROWS);
  out[id] = { sheets: files.map((f) => `${OUT_DIR}/${id}/${f}`), cols: COLS, rows: ROWS, w, h, count: COUNT, interval: +step.toFixed(4), duration: Math.round(dur), cells, focus };
  console.log(`  ${id}: ${files.length} sheets, ${w}x${h} frames, ${Math.round(dur)}s`);
}

const body = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
writeFileSync(OUT_JS, `/* GENERATED by \`node tools/storyboards.mjs\` — do not edit by hand.
   Film scrub frames: 48 frames per film made from the film itself (360px tall), in photos/scrub/<id>/.
   sheets: cols x rows frames of w x h each, left→right, top→bottom; \`count\` frames over \`duration\` s.
   cells: eight 540p stills for the grid boxes around an opening film (app.js); focus: where the subject
   sits in each, [x, y] as fractions, so a tall phone box crops toward the person, not the middle. */
window.STORYBOARDS = {
${body}
};
`);
console.log(`wrote storyboards.js (${Object.keys(out).length} films)`);
