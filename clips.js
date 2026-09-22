/* ============================================================
   CN PRODUCTION — site config. Edit everything here.
   Just change the text inside the quotes. No coding needed.
   ============================================================ */

const SITE = {
  name: "CN PROD",
  mark: "CN—PRD",                 // small wordmark, top-left (viewfinder style)
  tagline: "Directing · Production · Post-production",
  about:
    "CN Prod is a music video and clip production studio — producing, " +
    "directing and post-producing cinematic work for artists and labels.",
  email: "rotem1chen@gmail.com",
  socials: {
    instagram: "https://instagram.com/chen1rotem",
    youtube: "",
    vimeo: "",
    email: "rotem1chen@gmail.com",
  },
};

/* ============================================================
   CLIPS  —  each { ... } is one shot in the viewfinder reel.
   url:      YouTube / Vimeo / .mp4 link (required)
   title:    shown centre-bottom of the HUD
   artist:   shown centre-right of the HUD
   format:   left of the HUD (e.g. DIGITAL, 16MM, 4K). Optional.
   thumb:    cover image URL — optional for YouTube (auto), needed for Vimeo/mp4.
   ratio:    OPTIONAL shape, e.g. "1/1" for a square social post, "9/16" for a
             vertical one. Leave it out for normal 16:9 films. The tile keeps the
             same height as the others and just gets narrower — no black bars.
   ============================================================ */

const CLIPS = [
  { url: "https://youtu.be/gItPFC-qhic",                 title: "דרעק",        artist: "ayubii",           format: "DIGITAL" },
  { url: "https://youtu.be/HeRs2D2EXSk",                 title: "פוקוס",       artist: "עדן מניוב, ירין",  format: "DIGITAL", thumb: "thumbs/fokus.jpg" },
  { url: "https://www.youtube.com/watch?v=p14Mww6wgkk",  title: "גברת קארמה",  artist: "סיד",              format: "DIGITAL", thumb: "thumbs/gveret-karma.jpg" },
  { url: "https://youtu.be/-pC_MCcH4c8",                 title: "שקוף",        artist: "סיד",              format: "DIGITAL" },
  { url: "https://youtu.be/8JPeYDKJP4g",                 title: "DIN WARP",    artist: "",                 format: "DIGITAL" },
  { url: "https://youtu.be/t32fPgJ2FIs",                 title: "יהלומים",     artist: "הילל",             format: "DIGITAL" },
  { url: "https://youtu.be/qu7cYF-YV8M",                 title: "אני ואור",    artist: "רון עשהל",         format: "DIGITAL" },
  { url: "https://youtu.be/RKI861xIfTA",                 title: "genesis",     artist: "בלולו",            format: "DIGITAL" },
  { url: "https://youtu.be/D7eYTmT5DbY",                 title: "גנסיס",       artist: "אביהו פנחסוב",     format: "DIGITAL" },
];

/* ============================================================
   SUB-PAGES — the tiles that sit UNDER the films, not among them.
   Each one is a clip-sized yellow block that opens its own page.

   link:   the page it opens
   title:  the big word on the tile
   sub:    the small line under it
   thumb:  optional cover image, sits dimmed behind the word
   ============================================================ */

const SUBPAGES = [
  { link: "social.html",     title: "SOCIAL",     sub: "Vertical" },
  { link: "restaurant.html", title: "RESTAURANT", sub: "Commercial" },
];
