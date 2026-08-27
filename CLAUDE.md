# CN Production — project brief (read me first)

Music-video + concert-photography portfolio for **CN Production**.
Live at **https://music.cn-production.com** (GitHub Pages, this repo's `main` branch, custom domain via `CNAME`).

## Deploy
Every change is pushed to `main`; GitHub Pages rebuilds in ~1–2 min. No build step — plain static HTML/CSS/JS.
After editing CSS/JS, **bump the `?v=NN` version** on the `<link>`/`<script>` tags in `index.html` (and `show.html`) so browsers refetch. Current version: **v53**.

## Files
- `index.html` — main page: intro gate, films reel, STILLS preview (3 shots/concert)
- `show.html` — per-concert full gallery, opened as `show.html?c=<concert index>`
- `style.css` — all styling. Theme: pure black + brand **yellow `#ffd400`**, mono font (Space Mono), "camera viewfinder" look (corner target-brackets)
- `app.js` — main-page logic (intro w/ music, reel, video viewer, stills grid + lightbox)
- `show.js` — gallery-subpage logic
- **`clips.js`** — CONFIG for films: `SITE` (name/tagline/contact/socials) + `CLIPS` array
- **`photos.js`** — CONFIG for stills: `CONCERTS` array
- `logo.png` (metal CN mark), `intro.mp4` (intro video w/ audio), `photos/<concert>/` (full-res + `thumb/` thumbnails)

## How to add a FILM
Add an object to `CLIPS` in `clips.js`:
`{ url: "<youtube/vimeo/mp4 link>", title: "...", artist: "...", format: "DIGITAL" }`
Then bump `?v` in `index.html` and push. (YouTube video must be Public + embeddable.)

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
