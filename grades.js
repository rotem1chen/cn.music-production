/* ============================================================
   GRADE — before / after your colour grade, on the home page right after the films.
   Each { ... } is one frame: the same frame exported twice, raw and graded.
   3–5 frames is the sweet spot; the first one is shown big when the page opens.

   before — the raw / ungraded still   (e.g. "photos/grade/drek-1-raw.jpg")
   after  — the graded still            (e.g. "photos/grade/drek-1-graded.jpg")
   thumb  — optional small copy for the thumbnail row (~420px; falls back to `after`)
   film   — the film's name, shown under the frame ("" to leave it out)
   artist — optional

   Export from DaVinci: Gallery → Grab Still (graded), then bypass the grade and grab again →
   right-click → Export, JPG, ~1920px wide. Put both in photos/grade/.
   No frames → the section hides itself.
   ============================================================ */

const GRADES = [
  { before: "photos/grade/01-raw.jpg", after: "photos/grade/01-graded.jpg", thumb: "photos/grade/thumb/01.jpg", film: "דרעק",       artist: "ayubii" },
  { before: "photos/grade/02-raw.jpg", after: "photos/grade/02-graded.jpg", thumb: "photos/grade/thumb/02.jpg", film: "גברת קארמה", artist: "סיד" },
  { before: "photos/grade/03-raw.jpg", after: "photos/grade/03-graded.jpg", thumb: "photos/grade/thumb/03.jpg", film: "",           artist: "" },
  { before: "photos/grade/04-raw.jpg", after: "photos/grade/04-graded.jpg", thumb: "photos/grade/thumb/04.jpg", film: "דרעק",       artist: "ayubii" },
  { before: "photos/grade/05-raw.jpg", after: "photos/grade/05-graded.jpg", thumb: "photos/grade/thumb/05.jpg", film: "פוקוס",      artist: "עדן מניוב, ירין" },
  { before: "photos/grade/06-raw.jpg", after: "photos/grade/06-graded.jpg", thumb: "photos/grade/thumb/06.jpg", film: "אני ואור",   artist: "רון עשהל" },
  { before: "photos/grade/07-raw.jpg", after: "photos/grade/07-graded.jpg", thumb: "photos/grade/thumb/07.jpg", film: "",           artist: "" },
];
