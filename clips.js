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
  email: "hello@cnproduction.com",
  socials: {
    instagram: "https://instagram.com/",
    youtube: "https://youtube.com/",
    vimeo: "",
    email: "hello@cnproduction.com",
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
  { url: "https://www.youtube.com/watch?v=BPPiZgkobEg", title: "Untitled Film", artist: "Artist Name", format: "DIGITAL" },
  { url: "https://www.youtube.com/watch?v=9bZkp7q19f0", title: "Second Film",  artist: "Artist Name", format: "DIGITAL" },
  { url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk", title: "Third Film",   artist: "Artist Name", format: "16MM" },
  { url: "https://www.youtube.com/watch?v=RgKAFK5djSk", title: "Fourth Film",  artist: "Artist Name", format: "4K" },
];
