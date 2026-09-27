/* CN PROD — "Export as link".

   Uploads an exported treatment straight to Drive from the browser and returns a
   sendable t.html link. No backend: Google Identity Services hands us a token,
   the Drive REST API does the rest.

   Scope is drive.file — the narrowest one that works. It lets this page create
   files and manage the ones it created, and nothing else; it cannot read or
   even see the rest of the Drive. That is also why finding our own folder works:
   under drive.file a listing only ever returns files this app made.

   Setup (once) is in CLAUDE.md → "Sending a treatment". Without a client id the
   button explains itself rather than failing silently. */
const treatmentShare = (() => {
  "use strict";

  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FOLDER = "CN PROD — Treatments";
  const clientId = () => (typeof MEDIA !== "undefined" && MEDIA.clientId) ? MEDIA.clientId : "";

  let tokenClient = null, token = "", tokenUntil = 0, folderId = "";

  const configured = () => !!clientId();
  const ready = () => !!(window.google && google.accounts && google.accounts.oauth2);

  /* Ask Google for an access token. Must be called straight from a click —
     browsers block the popup otherwise. */
  function getToken() {
    if (token && Date.now() < tokenUntil - 60000) return Promise.resolve(token);
    if (!configured()) return Promise.reject(new Error("no-client-id"));
    if (!ready()) return Promise.reject(new Error("gsi-unavailable"));
    return new Promise((resolve, reject) => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId(),
        scope: SCOPE,
        callback: (res) => {
          if (res && res.access_token) {
            token = res.access_token;
            tokenUntil = Date.now() + (Number(res.expires_in || 3600) * 1000);
            resolve(token);
          } else {
            reject(new Error("denied"));
          }
        },
        error_callback: () => reject(new Error("denied")),
      });
      tokenClient.requestAccessToken({ prompt: "" });   // silent when already granted
    });
  }

  function api(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: "Bearer " + token }, opts.headers || {});
    return fetch(url, opts).then((r) => {
      if (!r.ok) return r.text().then((t) => { throw new Error("drive-" + r.status + ": " + t.slice(0, 160)); });
      return r.json();
    });
  }

  /* Keep uploads tidy in one folder. drive.file only lists our own files, so this
     finds the folder we made before, or makes it the first time. */
  function ensureFolder() {
    if (folderId) return Promise.resolve(folderId);
    const q = encodeURIComponent(
      `name='${FOLDER.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    return api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`)
      .then((r) => {
        if (r.files && r.files.length) return (folderId = r.files[0].id);
        return api("https://www.googleapis.com/drive/v3/files?fields=id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: FOLDER, mimeType: "application/vnd.google-apps.folder" }),
        }).then((f) => (folderId = f.id));
      })
      .catch(() => "");        // a folder is a nicety; upload to the root rather than fail
  }

  function upload(html, name) {
    const meta = { name: name + ".html", mimeType: "text/html" };
    if (folderId) meta.parents = [folderId];
    const boundary = "cnprod" + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
    return api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
  }

  const shareAnyone = (id) =>
    api(`https://www.googleapis.com/drive/v3/files/${id}/permissions?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }).then(() => id);

  /* The whole trip: token → folder → upload → share → link. `onStep` reports
     progress so the button can say what is happening. */
  function publish(html, name, onStep) {
    const step = onStep || function () {};
    step("Signing in…");
    return getToken()
      .then(() => { step("Preparing…"); return ensureFolder(); })
      .then(() => { step("Uploading…"); return upload(html, name); })
      .then((f) => { step("Sharing…"); return shareAnyone(f.id); })
      .then((id) => location.origin + location.pathname.replace(/[^/]*$/, "") + "t.html?f=" + id);
  }

  return { publish, configured, ready };
})();
