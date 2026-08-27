/* ============================================================
   CN PRODUCTION — site config. Edit everything here.
   Just change the text inside the quotes. No coding needed.
   ============================================================ */

const SITE = {
  name: "CN PRODUCTION",
  mark: "CN—PRD",                 // small wordmark, top-left (viewfinder style)
  tagline: "Directing · Production · Post-production",
  about:
    "CN Production is a music video and clip production studio — producing, " +
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
   ============================================================ */

const CLIPS = [
  { url: "https://youtu.be/gItPFC-qhic",                 title: "דרעק",        artist: "ayubii",        format: "DIGITAL" },
  { url: "https://www.youtube.com/watch?v=p14Mww6wgkk",  title: "גברת קארמה",  artist: "סיד",           format: "DIGITAL" },
  { url: "https://youtu.be/-pC_MCcH4c8",                 title: "שקוף",        artist: "סיד",           format: "DIGITAL" },
  { url: "https://youtu.be/8JPeYDKJP4g",                 title: "DIN WARP",    artist: "",              format: "DIGITAL" },
  { url: "https://youtu.be/t32fPgJ2FIs",                 title: "יהלומים",     artist: "הילל",          format: "DIGITAL" },
  { url: "https://youtu.be/qu7cYF-YV8M",                 title: "אני ואור",    artist: "רון עשהל",      format: "DIGITAL" },
  { url: "https://youtu.be/RKI861xIfTA",                 title: "genesis",     artist: "בלולו",         format: "DIGITAL" },
  { url: "https://youtu.be/D7eYTmT5DbY",                 title: "גנסיס",       artist: "אביהו פנחסוב",  format: "DIGITAL" },
];
