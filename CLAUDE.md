# CN Production — project brief (read me first)

Music-video + concert-photography portfolio for **CN Production**.
Live at **https://music.cn-production.com** (GitHub Pages, this repo's `main` branch, custom domain via `CNAME`).

## Deploy
Every change is pushed to `main`; GitHub Pages rebuilds in ~1–2 min. No build step — plain static HTML/CSS/JS.
After editing CSS/JS, **bump the `?v=NN` version** on the `<link>`/`<script>` tags in `index.html` (and `show.html`) so browsers refetch. Current version: **v95**.

## Files
- `index.html` — main page: intro gate, films reel, STILLS preview (3 shots/concert)
- `show.html` — per-concert full gallery, opened as `show.html?c=<concert index>`
- `style.css` — all styling. Theme: pure black + brand **yellow `#ffd400`**, mono font (Space Mono), "camera viewfinder" look (corner target-brackets)
- `app.js` — main-page logic (intro w/ music, reel, video viewer, stills grid + lightbox)
- `show.js` — gallery-subpage logic
- **`clips.js`** — CONFIG for films: `SITE` (name/tagline/contact/socials) + `CLIPS` array
- **`photos.js`** — CONFIG for stills: `CONCERTS` array
- **`social.js`** — CONFIG for vertical work (Reels/TikTok/Shorts): `SOCIAL` array → shown on `social.html`
- `logo.png` (metal CN mark), `intro.mp4` (intro video w/ audio), `photos/<concert>/` (full-res + `thumb/` thumbnails)

## How to add a FILM
Add an object to `CLIPS` in `clips.js`:
`{ url: "<youtube/vimeo/mp4 link>", title: "...", artist: "...", format: "DIGITAL" }`
Optional `ratio:` sets a non-16:9 shape — `"1/1"` for a square social post, `"9/16"` for a
vertical one. The tile keeps the same height as the rest of the reel and just gets narrower,
so nothing is letterboxed. Omit it for normal films. Works in the reel and the opened player.
Then bump `?v` in `index.html` and push. (YouTube video must be Public + embeddable.)

A `{ link: "social.html", title: "SOCIAL", format: "VERTICAL" }` entry (no `url`) is a **link tile**: a solid
yellow block the size of a film that opens that page instead of a video. That's how the SOCIAL tile at the top works.

## How to add a SOCIAL video (vertical)
Add a line to `SOCIAL` in `social.js`: `{ url: "<YouTube Shorts / youtu.be / .mp4 link>", title: "...", artist: "..." }`.
Covers come from YouTube automatically (`oar2.jpg` = original aspect, no black bars); `.mp4` needs a `thumb:`.
`social.html` shows them as a 9:16 grid, tap → vertical player, ←/→ to move between them. Bump `?v` in `social.html`, push.

## How to add a CONCERT (stills)
1. Put shots in `photos/<name>/` (compress to ~2000px: `sips -Z 2000 -s formatOptions 80`).
2. Make thumbnails in `photos/<name>/thumb/` (same filenames, `sips -Z 760 -s formatOptions 66`) — grids use thumbnails, lightbox uses full-res.
3. Add a block to `CONCERTS` in `photos.js`:
   `{ artist:"...", venue:"...", date:"...", dir:"photos/<name>/", shots:["01.jpg", ...] }`
4. Bump `?v` in `index.html` + `show.html`, push. The concert auto-gets a gallery at `show.html?c=<index>`.

## Interaction notes
- Films reel: **wheel scrolls**; **mouse only moves the yellow target-corners** onto the pointed film (no auto-centering).
- Intro: black screen → logo + ENTER → plays intro with music (click anywhere to skip) → fades in. Once per session.
- Mobile: custom cursor is hidden; videos need a **tap to play** (mobile blocks autoplay).

## YouTube notes
- All films currently embed and play correctly (the old **שקוף** embedding issue is resolved).
- **Unlisted is fine** — unlisted videos embed normally. Only *Private* breaks embeds.
- The setting that matters is separate from visibility: Studio → Content → video → Details →
  Show more → *License and distribution* → **Allow embedding**. If a film shows as a dead tile, check that first.

## Media pool (client delivery) — `media.html`
Hidden page (not linked from the site, `noindex`) that shows one Google Drive folder in the site's look:
**`https://music.cn-production.com/media.html?f=<drive folder id>`** — `f` also accepts a pasted Drive folder link.
Files: `media.html`, `media.js`, `media-config.js` (holds the Drive API key), styles under "Media pool" in `style.css`.

- Videos → 16:9 tiles, click plays inside the page (Drive player). Photos → grid + lightbox (full-res via Drive).
  Other files → list. Subfolders (e.g. `EDITED / RAW / SOCIAL`) become their own blocks, one level deep.
- Every tile has a ↓ download; "Download all" zips the whole folder via Drive; "Open in Drive" is the fallback.
- The folder (and everything in it) must be shared **Anyone with the link → Viewer**. The link is the only "password".

**One-time setup (API key)** — needed once, then never again:
1. https://console.cloud.google.com → create project (e.g. "CN media pool").
2. APIs & Services → Library → **Google Drive API** → Enable.
3. APIs & Services → Credentials → Create credentials → **API key**.
4. Edit the key: Application restrictions → **Websites** → add `music.cn-production.com/*`
   (add `localhost/*` too if testing locally); API restrictions → restrict to **Google Drive API**. Save.
5. Paste the key into `media-config.js` (`apiKey: "..."`), bump `?v`, push.

**Per client:** upload to a Drive folder → Share → Anyone with the link → open **`link.html`** (hidden helper page, 4-digit code gate — hash in the page, remembered 30 days per device),
paste the Drive folder link → it builds the client link, checks the folder is shared, copy / WhatsApp / preview.
(Manual: `media.html?f=<folder id from drive.google.com/drive/folders/<id>>`.) No site edit needed.

## Cut review (client notes on a timeline) — `review.html`
**`review.html?v=<Drive video link / id, or YouTube link>`** — hidden, `noindex`. Made from `link.html` → "02 — Cut review".
Files: `review.html`, `review.js`, styles under "Cut review" in `style.css`. **Zero backend**: notes live in the viewer's
browser (`localStorage`, keyed by video) and travel inside the link (`&n=` = deflate + base64url JSON). No accounts.

- **Drive videos stream through the Drive API media endpoint**:
  `https://www.googleapis.com/drive/v3/files/<id>?alt=media&supportsAllDrives=true&key=<API key>` — the only Drive URL
  that plays in a `<video>` on another site. Drive's download/preview hosts (`drive.google.com/uc`,
  `drive.usercontent.google.com/download`) answer **403 to every cross-site browser request** (`Sec-Fetch-Site`),
  and Drive's iframe player hides the playhead — verified 2026-09-21, don't retry those. Range/seeking works.
  File must be "Anyone with the link" and browser-decodable (H.264 .mp4; ProRes/.mov won't). media.js uses the same
  URL for its native player, with Drive's iframe as fallback. Unlisted YouTube links also work (IFrame API).
- Player: Drive files are **fetched whole the moment the page opens — 6 parallel 4 MB Range requests — with a big
  in-box loader (%, MB, speed, scan line, dimmed Drive thumbnail as poster) and played from a blob**, stored in Cache Storage
  (`cn-review-video`) so re-opening is instant; streaming the API endpoint directly stutters (~2 s per seek, no CDN)
  and Google rate-limits repeated hits per IP ("automated queries" 403 for hours — **never test it in a loop from
  curl/puppeteer; it blocked the home network on 2026-09-21**). If metadata works but media fails, the page says
  Google is throttling, offers נסו שוב, and embeds Drive's iframe player view-only (no timeline). Direct .mp4 URLs stream natively; YouTube uses the IFrame API, timeline polled every 200 ms.
- Ask for review exports at **1080p H.264 ~8–10 Mbps** — the 2160×2160 / 25 Mbps master was too heavy to stream.
- Client UI is **Hebrew** (RTL text blocks, LTR player row; no name field). Pause → big **תגובה** button (or `N`) → text → marker on the timeline. Keys: space, ←/→ 5s, shift+←/→ 1 frame, F.
- **SEND**: WhatsApp / Email (`SITE.email` from clips.js) / Copy — the link carries all notes. Opening it merges them
  into the recipient's storage and cleans `n` from the URL. Same note id → newest "fixed" state wins.
- CN side: click a marker/timecode to jump; ✓ **Fixed** per note; **export** → Resolve markers `.edl` (CMX3600 with
  `|M:` marker lines, record TC from 01:00:00:00, FPS selector) or a `.txt` list. Timecodes shown as mm:ss:ff.
- Limitation of zero-backend: two reviewers = two links; the client must press SEND. Upgrade path: Firebase (free) if needed.
