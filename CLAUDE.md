# CN Production — project brief (read me first)

Music-video + concert-photography portfolio for **CN PROD**.
Live at **https://music.cn-production.com** (GitHub Pages, this repo's `main` branch, custom domain via `CNAME`).

## Deploy
Every change is pushed to `main`; GitHub Pages rebuilds in ~1–2 min. No build step — plain static HTML/CSS/JS.
After editing CSS/JS, **bump the `?v=NN` version** on the `<link>`/`<script>` tags in `index.html` (and `show.html`) so browsers refetch. Current version: **v138** (style.css, app.js, fx.js, plight-fx.js, show.js, media.js — referenced from index, show, media, link, review, social, restaurant; opening.js is still v136).
Every page's viewport meta has `viewport-fit=cover` — keep it on new pages, and place new fixed controls with the `--sat/--sab/--sal/--sar` safe-area tokens (end of style.css).

## Files
- `index.html` — main page: films reel, STILLS as one cover card per concert (opens `show.html`; the cover flies into the gallery via a view transition). Opens straight onto the films — there is no intro
- `show.html` — per-concert full gallery, opened as `show.html?c=<concert index>`
- `style.css` — all styling. Theme: pure black + brand **yellow `#ffd400`**, mono font (Space Mono), "camera viewfinder" look (corner target-brackets)
- `app.js` — main-page logic (reel, video viewer, stills grid + lightbox)
- `show.js` — gallery-subpage logic
- **`clips.js`** — CONFIG for films: `SITE` (name/tagline/contact/socials) + `CLIPS` array
- **`photos.js`** — CONFIG for stills: `CONCERTS` array
- **`social.js`** — CONFIG for vertical work (Reels/TikTok/Shorts): `SOCIAL` array → shown on `social.html`
- **`restaurant.js`** — CONFIG for restaurant/venue films: `RESTAURANT` array → shown on `restaurant.html`
- `fx.js` — the "liquid" layer (home + gallery pages): ambient light from the active film/concert, the glass nav droplet, reel depth/tilt, scroll reveals. Glass refraction is an SVG lens it injects; Chromium only, others get frosted blur
- **Tool pages are liquid too** (link, media, review, t, and both editors): ambient light (brand light, or the client's own photos / the review video's poster), glass cards, wells and pills, liquid-yellow primaries. Editor styles live at the end of `treatment.css`; exported treatments/quotations carry their own inline styles and are NOT affected
- **Safari on phones: no big live blurs.** The ambient light and the viewer/lightbox glows are pre-blurred once in fx.js (`tiny()` / `window.cnSoftBg`: the image shrunk to a 64px canvas, tinted, stretched back up). A live 80–90px `filter: blur()` on a full-screen layer froze iPhone Safari for seconds after every load; Chrome didn't mind. Computers keep the live blur.
- `opening.js` — the home page's opening (plays on a refresh or a first arrival; skipped when you come from any other page of the site, by Back or by a link): the metal CN mark materialises in the centre, the light blooms, the mark settles into place, the glass nav forms, the films rise. Any scroll/click/tap/key fast-forwards it. A tiny script in `index.html`'s `<head>` decides before first paint (skipped for reduced motion, a `#hash` link, or a page reopened mid-scroll)
- `plight-fx.js` — the fluid photo lightbox (open from thumbnail, swipe/flick, drag down to close, rubber band at the first/last photo, pinch / double-tap zoom), used by index, show and media. Pages pass `index: () => i` to stop at the ends (without it the set wraps). It also exports the shared physics (`PlightFX.Spring / project / rubberband / velocity`, used by the film viewer in app.js) and `window.cnHaptic(ms, minGap)` — Android-only `navigator.vibrate`, 8–15ms, only after the first touch
- `vgrid.js` — the grid+player logic BOTH subpages share; each page sets `window.VGRID = { items, ratio, min, unit }` before loading it
- `logo.svg` (the CN mark, shown everywhere — filled with a metal gradient in CSS, so no background box), `logo.png` (only for the search-engine logo), `intro-poster.jpg` (the link-preview image — keep it), `photos/<concert>/` (full-res + `thumb/` thumbnails)

## How to add a FILM
Add an object to `CLIPS` in `clips.js`:
`{ url: "<youtube/vimeo/mp4 link>", title: "...", artist: "...", format: "DIGITAL" }`
Optional `ratio:` sets a non-16:9 shape — `"1/1"` for a square social post, `"9/16"` for a
vertical one. The tile keeps the same height as the rest of the reel and just gets narrower,
so nothing is letterboxed. Omit it for normal films. Works in the reel and the opened player.
Then bump `?v` in `index.html` and push. (YouTube video must be Public + embeddable.)

## Sub-page tiles (SOCIAL / RESTAURANT)
`CLIPS` is **films only** — the reel shows the first 5, then a pull zone: keep scrolling into it and a yellow ring fills ("Keep pulling · N more films"); when full, the next films rise in right there and you scroll on into them (no button, no jump to the top). Keyboard users get a focusable "Show N more films" button in the same place. The other kinds of work are
**`SUBPAGES`** in `clips.js`: clip-sized yellow tiles rendered *below* the reel, under a `[ MORE ]` label.
`{ link: "restaurant.html", title: "RESTAURANT", sub: "Commercial" }` — add a line to add a tile.
Long titles shrink to fit automatically (the size is `150cqw / <title length>`, so it scales off the tile, not the viewport).

## How to add a SOCIAL / RESTAURANT video
Add a line to `SOCIAL` in `social.js` or `RESTAURANT` in `restaurant.js`:
`{ url: "<YouTube / Shorts / youtu.be / .mp4 link>", title: "...", artist: "..." }`.
Covers come from YouTube automatically (`oar2.jpg` = original aspect, no black bars); `.mp4` needs a `thumb:`.
Tile shape is per page — social is `9 / 16`, restaurant is `16 / 9` (set in the `window.VGRID` line in each HTML);
a single video can override with its own `ratio: "9 / 16"`. Bump `?v` in that page, push.

## How to add a CONCERT (stills)
1. Put shots in `photos/<name>/` (compress to ~2000px: `sips -Z 2000 -s formatOptions 80`).
2. Make thumbnails in `photos/<name>/thumb/` (same filenames, `sips -Z 760 -s formatOptions 66`) — grids use thumbnails, lightbox uses full-res.
3. Add a block to `CONCERTS` in `photos.js`:
   `{ artist:"...", venue:"...", date:"...", dir:"photos/<name>/", shots:["01.jpg", ...] }`
   (optional `cover:"10.jpg"` picks the home-page card photo; default is the first shot)
4. Bump `?v` in `index.html` + `show.html`, push. The concert auto-gets a gallery at `show.html?c=<index>`.

## Interaction notes
- Films reel: **wheel scrolls**; **mouse only moves the yellow target-corners** onto the pointed film (no auto-centering).
- Phones, home page only: no top menu and no "Other work" pill (`body.home` in style.css) — the films are the whole screen. Sub-pages keep their menu.
- Film viewer gestures (app.js, "Viewer physics"): **drag down** on the glass grab handle above the film or anywhere on the backdrop (mouse too) — 1:1 with the grab offset, momentum decides close vs snap back; closing lands in the film's own tile (the reel turns to that page / scrolls behind the glass). **Swipe left/right**, **←/→**, or the glass ‹ › buttons (computers only) go through ALL films without closing; the ends rubber-band. Gestures on the YouTube iframe itself stay YouTube's.
  The opening is still the CSS sequence (1450ms grid hold + 1.1s grow — keep that timing). Any interruption (close/Esc/backdrop/drag during the grid or grow) switches the viewer to springs (`.vfx`): stage = laid-out box + transform, beams written per frame, backdrop/glow/controls follow `--va`; at rest it hands back to the CSS. `window.cnViewer.state()` exposes the phase for tests.
- Photo lightbox: pinch (two fingers, about the midpoint) / double-tap / double-click / trackpad pinch to zoom up to 4x; one finger pans while zoomed (swipe doesn't change photo, drag-down doesn't close).
- "Next 5 films" paging is directional (old set lifts away, new set rises in; back to the first five runs downward) — Web Animations, reduced motion = crossfade.
- Contact email: one tap copies it ("Copied ✓" glass pill at the tap) and opens a Copy / Email glass popover anchored at the tap.
- Haptics (Android only): target lock on a new film (max one per 150ms), photo flick commit, film swipe commit, email copied.
- Glass controls in the viewer and lightbox materialise (blur + scale on computers, opacity + scale on phones). `prefers-contrast: more` turns all glass near-solid with a light border (fx.js skips the lens).
- Mobile: films autoplay **muted** (phones only allow muted autoplay) and a yellow "Tap for sound" pill under the video turns the sound on. Films load on click (hidden) so they are buffered by the time the open animation ends; if not, the poster shows a liquid loading state.

## Smoothness rules (scroll + motion) — keep these when touching app.js / fx.js / opening.js
- **One frame, one read, then writes.** Everything that follows the scroll on the home page runs in a single
  `requestAnimationFrame` in app.js: it reads `scrollY` and the reel rects once, moves the brackets, then calls
  fx.js's work (`window.cnScrollFrame`) with the same `scrollY`. Nothing reads layout inside a `scroll` event.
- **Cached layout.** fx.js's depth/tilt, the scrollspy and the scroll-cue buttons use section/tile offsets measured
  once and re-measured only when the page's size changes (`ResizeObserver` on `body`, resize, reel paging) —
  so a scroll frame reads `scrollY` and nothing else. `innerHeight` is cached too (reading it mid-scroll can force a style pass).
- **Scroll-linked properties never have a CSS transition.** The reel tilt (`transform`) and desktop blur (`filter`) are
  written straight onto each frame; a transition restarted per frame trails the scroll in steps (the old "boxy" feel).
  The hover lean eases in JS instead.
- **Compositor only for motion:** the yellow brackets are four corners placed by `transform` (not top/left/width/height);
  the viewer's beams likewise; the left film bars grow by `scale`, not `width`. The lock-on snap and the HUD text
  re-forming are Web Animations, so nothing restarts a CSS animation with a forced reflow.
- **The opening measures nothing per frame.** The brackets ride the films' rise as their own animation on `#chrome`
  (same keyframes, same origin = centre of the screen); app.js's `refresh()` waits for `html.opening-run` to go.
  Phones get the opening without the blur-in (transform + opacity only); a tap/scroll fast-forwards at 10× (7× on computers).
  The YouTube API loads on idle after the opening (or immediately when a film is opened).
- **Phones (`hover:none`/`pointer:coarse`)**: reveals rise and fade without de-blurring; the film viewer and the photo
  lightbox frost the page with a fixed-radius blur layer whose opacity fades (`.viewer::before` / `.plight::before`),
  instead of animating the blur radius over the whole screen. Computers keep the radius animation.
- The retired cursor ring has no animation loop any more (it is `display:none` in CSS).
- The viewer's gesture springs and the lightbox zoom write transform/opacity only, from cached boxes (`stageBox`, `base`); the only layout reads are once at the moment a gesture takes over (the presentation values) and once at close (the tile's rect).
- Testing touch gestures in puppeteer: take screenshots with CDP `Page.captureScreenshot`, not `page.screenshot()` — the latter re-applies device metrics and injects a stray pointer move mid-gesture.

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

`link.html` is a **tool grid**: MAKE A DOCUMENT (the two editors, kept at the top because they are opened
daily) then SEND A LINK (01 Delivery, 02 Cut review). Card descriptions are Heebo prose, not the
site's uppercase micro-labels — this page is used, not admired.

**Per client:** upload to a Drive folder → Share → Anyone with the link → open **`link.html`** (hidden helper page, 4-digit code gate — hash in the page, remembered 30 days per device),
paste the Drive folder link → it builds the client link, checks the folder is shared, copy / WhatsApp / preview.
(Manual: `media.html?f=<folder id from drive.google.com/drive/folders/<id>>`.) No site edit needed.

## Proposals & quotations — `quote.html`
Second tool inside the locked Link Maker (`link.html` → "Open quotation editor"; direct links redirect to
`link.html?tool=quote`). Files: `quote.html`, `quote.js`, `quote.css`, `quote-gate.js`. Shares
`treatment.css` for chrome, `treatment-files.js` for saving, `treatment-fonts.js` for the embedded export
fonts and `treatment-share.js` for **Export as link** — so a quotation sends exactly like a treatment, and
`t.html` renders it with no extra work.

- Line items (description, optional detail, qty, unit price) → subtotal, flat discount, VAT %, total.
  Currency and VAT are per quotation; VAT defaults to **18%** (Israel) and currency to **₪**.
- `Valid until` is computed from the date plus the days you enter — it is not a second field to keep in sync.
- **Included / Not included / Payment terms / Conditions** are free text; the first two split on newlines
  into bullets, so one item per line.
- The export ends in an **Agreement** block: ruled lines for client and CN PROD, each with a date.
  This is a *printed* agreement — a place to sign, not a digital signature. Nothing here verifies a
  signer, and doing so properly would need a backend. Don't describe the PDF as binding proof of signing.
- Drafts live in IndexedDB **`cn-quotations`** (store `quotes`) — separate from the treatments database.
  JSON backup/import is shared in shape; import always makes new copies.
- **The PDF keeps the dark design** — it is meant to be read on a screen, not run off on paper.
  `@page{margin:0}` plus an explicit `background` on `html,body` is what takes the black to the page
  edge (page margins are outside the body box, so they stay white otherwise), and
  `print-color-adjust:exact` is what stops the browser dropping the background. Verified with headless
  `--print-to-pdf`, which has background printing **off** by default — the page still came out black,
  so it does not depend on the "Background graphics" checkbox in anyone's print dialog.

## Export as link (one click) — `treatment-share.js`
The editor's **Export as link ↗** uploads the treatment to Drive and hands back a `t.html` link, so
nothing has to be uploaded or shared by hand. Files land in a Drive folder called **CN PROD — Treatments**.

**Only you ever sign in.** The client opens the link and reads it with the public `apiKey`; there is no
login, no Google account and no permission prompt on their side.

Scope is **`drive.file`** — the narrowest that works. This page can create files and manage the ones it
created; it cannot see anything else in the Drive. It is also a *non-sensitive* scope, so Google does
**not** require app verification.

**One-time setup (OAuth client id)**
1. https://console.cloud.google.com → the same project as the API key.
2. APIs & Services → **OAuth consent screen** → External → app name `CN PROD`, your email twice → Save.
   Add the scope `.../auth/drive.file`. Then **Publish app** — in *Testing* mode sign-ins expire after 7 days.
3. Credentials → Create credentials → **OAuth client ID** → *Web application*.
   Authorized **JavaScript origins**: `https://music.cn-production.com` (add `http://127.0.0.1:8765` to test locally).
   No redirect URI is needed — this uses the GIS token flow, not a redirect.
4. Copy the **Client ID** into `media-config.js` (`clientId: "..."`), bump `?v`, push.

Until a client id is set the button says so rather than failing silently.

## Sending a treatment — `t.html`
**`t.html?f=<Drive file id / link>`** — hidden, `noindex`. Files: `t.html`, `t.js`.
Produced by **Export as link ↗** in the treatment and quotation editors; there is no longer a manual
"paste a Drive link" card in `link.html`, because Export as link does the upload, the sharing and the
link in one press. For a file already sitting in Drive, `t.html?f=<id>` still works typed by hand.

**Why it exists:** Instagram, WhatsApp and the rest accept a *link* but refuse a file attachment, and an
exported `.html` opened from Files on a phone is just a file. This turns an export into a sendable URL.

Flow: editor → **Export as link ↗** → the link is on the clipboard. The viewer fetches the file through
the Drive media endpoint (same one `review.html` uses) and drops it into an iframe.

- **The iframe is sandboxed without `allow-scripts`.** `t.html?f=` is a public URL, so anyone can point it
  at a file we did not write; an opaque origin with scripts disabled stops a hostile document reaching
  this origin. Don't add `allow-scripts` — the exported treatment has no scripts and doesn't need it.
- Exported treatments **embed their fonts** as woff2 data URIs (`treatment-fonts.js`), so they render the
  same over `file://`, from an email attachment and offline. A Google Fonts `<link>` cannot load over
  `file://` — that was the original "the fonts are gone on my phone" bug.
- Errors are named rather than generic: not shared, throttled (429), not an exported treatment, no id.

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

## Director's treatments — `treatment.html`
Embedded inside the locked Link Maker (`link.html`). Direct `treatment.html` links redirect to `link.html?tool=treatment`. The editor script loads only after the unlocked parent confirms access through a same-origin message; this reuses the existing browser-only PIN gate, not server authentication. Uses `treatment.css` and
`treatment.js` with independent `?v=1` assets; no build or backend. The public
portfolio navigation is unchanged, and the editor is `noindex, nofollow`.

- Project details, editable/reorderable treatment sections, a cover, and captioned
  reference images. Images are resized to 1800 px and embedded in client exports.
- Drafts use this browser's IndexedDB (`cn-director-treatments`), not cloud sync.
  JSON backup/import moves drafts between devices; import makes new copies.
- Client preview omits empty sections. Export downloads a standalone HTML
  presentation; Preview → Print / Save PDF uses the browser print dialog.
- English and Hebrew/RTL text are supported. No client content is committed or
  uploaded by the editor. The page itself is public; it does not provide server
  authentication, client accounts, or hosted treatment share links.

### Treatment file destinations
`treatment-files.js` lets the user explicitly choose a local Treatment directory
using the File System Access API. The handle is remembered in the separate
`cn-treatment-folders` IndexedDB database. Finished HTML saves at its root;
editable JSON backups save under `backup/`, matching the user's existing folder.
Each file has a timestamp and random suffix to preserve earlier versions.
Permission denial/write failure is reported without claiming success. Browsers
without directory-picker support retain ordinary downloads. Browser Print / Save
PDF still requires choosing the destination in the OS print/save dialog.
The supplied simple CN mark is embedded on the export cover and closing footer,
and shown on the editor cover; it remains present alongside cover photography.
