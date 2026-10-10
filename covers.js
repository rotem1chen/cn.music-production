/* ============================================================
   COVER ART — album / single artwork shot by CN PROD, after STILLS on the home page.
   Each { ... } is one cover. Add a line per release.

   img    — the cover, square (e.g. "photos/covers/<name>.jpg", ~640–1000px)
   title  — the release name
   artist — who it's for
   year   — optional
   type   — optional: "Album", "Single", "EP"…
   link   — optional: the release on Spotify / Apple Music

   COVERS_NOTE — the line above the covers ("" to hide), with an optional link (e.g. the artist on Spotify).
   No covers → the section hides itself.
   ============================================================ */

const COVERS_NOTE = {
  text: "Album artwork & music photography — every cover photo of סיד's music is shot by CN PROD.",
  link: "https://open.spotify.com/artist/7bwuDQSLIXMZLphWnvbhAf",
  linkLabel: "סיד on Spotify",
};

const COVERS = [
  { img: "photos/covers/sid-ad-shehakochavim-noflim.jpg", title: "עד שהכוכבים נופלים", artist: "סיד", year: "2026", type: "Album",
    link: "https://open.spotify.com/album/6j3wzFzMugtWHmmp4TY38m" },
  { img: "photos/covers/sid-september.jpg", title: "ספטמבר", artist: "סיד", year: "2025", type: "Single",
    link: "https://open.spotify.com/track/6oTEmSkhPT4D9Cy4JXI8fd" },
  { img: "photos/covers/sid-halev-beritza.jpg", title: "הלב בריצה", artist: "סיד", year: "2025", type: "Single",
    link: "https://open.spotify.com/track/25NJeHteIMJSUm0WtODW9v" },
];
