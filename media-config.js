/* CN Production — media pool config.
   The page reads a Google Drive folder that is shared "Anyone with the link".
   Paste your Google Drive API key here (see CLAUDE.md → "Media pool" for the 5-minute setup).
   The key is public by design — restrict it to this domain in Google Cloud so nobody else can use it. */
const MEDIA = {
  apiKey: "AIzaSyBRZFGGh0ROIdgbKrqx1REIpu0A3T3q5ZA",

  /* OAuth client id — only for "Export as link" in the treatment editor, which
     uploads to YOUR Drive. Clients never sign in: they open t.html, which reads
     the shared file with the public apiKey above. See CLAUDE.md. */
  clientId: "",
};
