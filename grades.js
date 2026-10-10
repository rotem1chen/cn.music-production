/* ============================================================
   GRADE — before / after your colour grade, on the home page right after the films.
   Each { ... } is one frame: the same frame exported twice, raw and graded.
   3–5 frames is the sweet spot; the first one is shown big when the page opens.

   before — the raw / ungraded still   (e.g. "photos/grade/drek-1-raw.jpg")
   after  — the graded still            (e.g. "photos/grade/drek-1-graded.jpg")
   film   — the film's name, shown under the frame
   artist — optional

   Export from DaVinci: Gallery → Grab Still (graded), then bypass the grade and grab again →
   right-click → Export, JPG, ~1920px wide. Put both in photos/grade/.
   No frames → the section hides itself.
   ============================================================ */

const GRADES = [
  // { before: "photos/grade/drek-1-raw.jpg", after: "photos/grade/drek-1-graded.jpg", film: "דרעק", artist: "ayubii" },
];
