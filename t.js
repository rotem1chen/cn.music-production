/* CN PROD — treatment viewer.  t.html?f=<Drive file id or link>

   Reads one exported treatment (.html) out of Google Drive and shows it.
   Made for sending: Instagram, WhatsApp and every other app take a link but
   refuse a file attachment, so this turns the export into something sendable.

   The file is dropped into a sandboxed iframe WITHOUT allow-scripts — this URL
   is public by design, so anyone could point ?f= at a file we did not make.
   Sandboxing gives it an opaque origin and no script execution, so a hostile
   document cannot reach this page or the rest of the site. */
(function () {
  "use strict";

  var KEY = (typeof MEDIA !== "undefined" && MEDIA.apiKey) ? MEDIA.apiKey : "";
  var frame = document.getElementById("doc");
  var state = document.getElementById("state");
  var title = document.getElementById("stateTitle");
  var note = document.getElementById("stateNote");
  var bar = document.getElementById("stateBar");
  var act = document.getElementById("stateAct");

  function say(head, text, driveId) {
    bar.hidden = true;
    title.textContent = head;
    note.innerHTML = text;
    if (driveId) { act.href = "https://drive.google.com/file/d/" + driveId + "/view"; act.hidden = false; }
    state.hidden = false;
    frame.hidden = true;
  }

  /* accepts a full Drive link in any of its shapes, or a bare id */
  function fileId(raw) {
    if (!raw) return "";
    var m = raw.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})/)
         || raw.match(/[?&]id=([\w-]{20,})/)
         || raw.match(/^([\w-]{20,})$/);
    return m ? m[1] : "";
  }

  var id = fileId((new URLSearchParams(location.search).get("f") || "").trim());

  if (!id) {
    say("No treatment", "Add a Drive file id to the link — <b>t.html?f=&lt;id&gt;</b>. Build one from the link maker.");
    return;
  }
  if (!KEY) {
    say("Not configured", "No Drive API key on this site yet. See CLAUDE.md → Media pool.", id);
    return;
  }

  var base = "https://www.googleapis.com/drive/v3/files/" + id;
  var auth = "supportsAllDrives=true&key=" + KEY;

  fetch(base + "?fields=name,mimeType,size&" + auth)
    .then(function (r) {
      if (!r.ok) throw r.status;
      return r.json();
    })
    .then(function (meta) {
      var name = (meta.name || "Treatment").replace(/\.html?$/i, "");
      document.title = name + " — CN PROD";
      title.textContent = name;
      note.textContent = "Loading…";
      // Drive reports Google-native docs with their own types; only a real file can be shown
      if (meta.mimeType && meta.mimeType.indexOf("application/vnd.google-apps") === 0) {
        throw "notfile";
      }
      return fetch(base + "?alt=media&" + auth).then(function (r) {
        if (!r.ok) throw r.status;
        return r.text();
      });
    })
    .then(function (html) {
      if (!/<html[\s>]/i.test(html) && !/<!doctype html/i.test(html)) throw "notfile";
      frame.srcdoc = html;
      frame.hidden = false;
      state.hidden = true;
    })
    .catch(function (err) {
      if (err === "notfile") {
        say("Not a treatment", "That Drive file isn’t an exported treatment. Export one from the editor, upload the <b>.html</b> to Drive, then use that link.", id);
      } else if (err === 404 || err === 403) {
        say("Not shared", "In Drive: right-click the file → <b>Share</b> → “Anyone with the link” → Viewer. Then reload this page.", id);
      } else if (err === 429) {
        // documented in CLAUDE.md: Google throttles repeated hits per IP
        say("Google is throttling", "Too many requests from this network. Wait a few minutes and reload.", id);
      } else {
        say("Couldn’t open it", "Something went wrong fetching the file. Check the link, or open it in Drive.", id);
      }
    });
})();
