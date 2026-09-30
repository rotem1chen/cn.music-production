/* CN PROD — proposal / quotation editor.

   Same shape as the treatment editor: drafts in this browser's IndexedDB, a
   standalone HTML export that carries its own fonts, Save PDF through the print
   dialog, and Export as link via treatment-share.js.

   The export ends in a signature block. That block is a printed agreement — two
   ruled lines, names and dates — not a digital signature: nothing here can
   verify who signed, and it would need a backend to try. Say so plainly rather
   than implying the PDF is binding proof. */
'use strict';
const $ = s => document.querySelector(s);
const uid = () => crypto.randomUUID();
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LOGO = '<svg class="cn-logo" role="img" aria-label="CN PROD" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 123.21 129.73"><path d="M16.78,50.19c-5.21,18.47-1.57,34.74,11.18,48.88,1.12,1.24,2.26,3.05,4.34,2.17,2.18-.92,2.36-3.03,2.36-5.09,0-18.66,0-37.33,0-55.99,0-.58-.01-1.2-.01-1.75,0-2.02.59-2.79,2.69-2.79.9,0,1.77,0,2.74,0,5.48,0,8.56,1.69,11.81,5.47,9.01,10.49,18.33,20.71,27.53,31.03.2.22.45.4.96.85,0-11.1-.1-21.82.04-32.53.07-5.54-.82-11.14,1.14-16.59,3.99-11.12,17.84-13.69,25.07-5.56,7.13,8.03,12.9,16.73,16.09,27.04,1.01,3.28.59,3.75-2.87,3.42-6.94-.66-12.28-3.81-15.92-9.83-1.29-2.13-2.82-4.13-4.3-6.14-1.05-1.42-2.21-3.01-4.27-2.27-2.01.72-2.02,2.67-2.03,4.44-.03,4.83-.03,9.67-.03,14.5,0,13.75.01,27.5.02,41.25,0,3.17-.03,3.2-3.19,3.21-8.61.03-8.56-.02-14.26-6.5-8.3-9.45-16.69-18.82-25.04-28.23-.76-.86-1.48-1.76-2.35-2.79-1.09,1.39-.75,2.51-.75,3.52-.02,13,0,26,.01,39,0,5.61-1.36,10.67-5.44,14.82-4.3,4.38-13.58,6.66-19.91.9C9.17,102.57,1.13,87.93.14,69.99-1.33,43.42,9.05,22.35,31.99,8.73c20.23-12,41.25-11.24,61.91-.14.63.34,1.42.57,1.61,1.44-.46.8-1.28.68-1.99.75-4.62.52-8.38,2.68-11.31,6.2-1.06,1.28-1.92,1.65-3.58,1.06-26.44-9.36-53.95,5.76-61.85,32.13Z"/><path d="M110.81,106.76c-12.84,15.04-28.92,22.92-48.59,22.98-10.24.03-25.12-4.23-28.86-7.92-.14-.14-.26-.21-.21-.38.05-.15.17-.16.34-.21,2.05-.68,4.2-.93,6.12-1.93,2.63-1.37,4.87-3.2,6.67-5.53.74-.96,1.38-1.45,2.7-1.03,20.92,6.53,41.75-2.19,52.98-18.96,4.31-6.44,9.99-10.04,17.54-10.96.79-.1,1.59-.26,2.59-.03.34.08.71.08.89.47.16.33,0,.62-.09.97-2.32,8.32-6.53,15.68-12.07,22.55Z"/></svg>';

let db, drafts = [], current, timer, saveChain = Promise.resolve();

const today = () => new Date().toISOString().slice(0, 10);
const line = () => ({ id: uid(), desc: '', note: '', qty: 1, price: 0 });
const fresh = () => ({
  id: uid(), number: '', date: today(), valid: '14', currency: '₪', vat: 18,
  title: '', client: '', clientDetail: '', summary: '', direction: 'auto',
  items: [line()], discount: 0,
  includes: '', excludes: '', terms: '', notes: '', signName: '', signUs: '',
  updated: Date.now(),
});

/* ---------- money ---------- */
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
function sums(d) {
  const sub = (d.items || []).reduce((t, i) => t + num(i.qty) * num(i.price), 0);
  const disc = Math.min(num(d.discount), sub);
  const net = sub - disc;
  const vat = net * (num(d.vat) / 100);
  return { sub, disc, net, vat, total: net + vat };
}
const money = (n, cur) => (cur || '₪') + ' ' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- storage ---------- */
function persist() {
  current.updated = Date.now();
  $('#save-state').textContent = 'Saving…';
  const snapshot = structuredClone(current);
  saveChain = saveChain.catch(() => {}).then(() => new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Storage unavailable'));
    const tx = db.transaction('quotes', 'readwrite');
    tx.objectStore('quotes').put(snapshot);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  })).then(() => { $('#save-state').textContent = 'Saved in this browser'; })
    .catch(() => { $('#save-state').textContent = 'Not saved — download a backup';
      toast('Browser storage is unavailable or full. Download a backup to keep your work.'); });
  return saveChain;
}
function saveOther(d) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Storage unavailable'));
    const tx = db.transaction('quotes', 'readwrite');
    tx.objectStore('quotes').put(d);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
function forget(id) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const tx = db.transaction('quotes', 'readwrite');
    tx.objectStore('quotes').delete(id);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
function removeDraft(d) {
  const name = d.title || d.number || 'Untitled quotation';
  if (!confirm(`Delete “${name}”?\n\nThis removes it from this browser and cannot be undone. Save a backup first if you want to keep it.`)) return;
  const wasCurrent = d.id === current.id;
  let madeFresh = false;
  drafts = drafts.filter(x => x.id !== d.id);
  if (!drafts.length) { current = fresh(); drafts.unshift(current); madeFresh = true; }
  else if (wasCurrent) current = drafts[0];
  render(); toast(`Deleted “${name}”.`);          // never wait on IndexedDB to redraw
  saveChain = saveChain.catch(() => {}).then(() => forget(d.id))
    .then(() => madeFresh ? saveOther(current) : null)
    .catch(() => { $('#save-state').textContent = 'Not saved — download a backup'; });
  return saveChain;
}

/* ---------- render ---------- */
function renderDrafts() {
  const area = $('#drafts'); area.replaceChildren();
  drafts.forEach(d => {
    const row = document.createElement('div'); row.className = 'draft-row';
    const b = document.createElement('button');
    b.className = 'draft' + (d.id === current.id ? ' active' : '');
    const t = sums(d);
    b.innerHTML = `<strong>${escapeHTML(d.title || 'Untitled quotation')}</strong>` +
      `<small>${escapeHTML(d.client || d.number || 'New')} · ${escapeHTML(money(t.total, d.currency))}</small>`;
    b.onclick = () => { current = d; render(); };
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'draft-del'; x.textContent = '✕';
    x.title = 'Delete this quotation';
    x.setAttribute('aria-label', `Delete ${d.title || 'Untitled quotation'}`);
    x.onclick = e => { e.stopPropagation(); removeDraft(d); };
    row.append(b, x); area.append(row);
  });
}

function renderItems() {
  const area = $('#items'); area.replaceChildren();
  current.items.forEach((it, i) => {
    const row = document.createElement('div'); row.className = 'q-row';
    row.innerHTML =
      `<div class="q-desc">` +
        `<input class="q-d" placeholder="What it is" dir="auto" value="${escapeHTML(it.desc)}">` +
        `<textarea class="q-note" rows="1" placeholder="Detail (optional)" dir="auto">${escapeHTML(it.note)}</textarea>` +
      `</div>` +
      `<input class="q-num q-q" type="number" min="0" step="any" value="${escapeHTML(it.qty)}">` +
      `<input class="q-num q-p" type="number" min="0" step="any" value="${escapeHTML(it.price)}">` +
      `<span class="q-sum">${escapeHTML(money(num(it.qty) * num(it.price), current.currency))}</span>` +
      `<button class="q-del" type="button" aria-label="Remove line ${i + 1}">✕</button>`;
    const bind = (sel, key, isNum) => {
      const el = row.querySelector(sel);
      el.addEventListener('input', () => {
        it[key] = isNum ? el.value : el.value;
        row.querySelector('.q-sum').textContent = money(num(it.qty) * num(it.price), current.currency);
        renderTotals(); renderDrafts();
        clearTimeout(timer); timer = setTimeout(persist, 400);
      });
    };
    bind('.q-d', 'desc'); bind('.q-note', 'note'); bind('.q-q', 'qty', true); bind('.q-p', 'price', true);
    row.querySelector('.q-del').onclick = () => {
      current.items.splice(i, 1);
      if (!current.items.length) current.items.push(line());
      renderItems(); renderTotals(); renderDrafts(); persist();
    };
    area.append(row);
  });
}

function renderTotals() {
  const t = sums(current), c = current.currency;
  const rows = [['Subtotal', money(t.sub, c)]];
  if (t.disc > 0) rows.push(['Discount', '− ' + money(t.disc, c)]);
  if (num(current.vat) > 0) rows.push([`VAT ${num(current.vat)}%`, money(t.vat, c)]);
  $('#totals').innerHTML = rows.map(([k, v]) => `<dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd>`).join('') +
    `<dt class="q-grand-t">Total</dt><dd class="q-grand-d">${escapeHTML(money(t.total, c))}</dd>`;
}

const FIELDS = ['number', 'date', 'valid', 'currency', 'vat', 'title', 'client', 'clientDetail',
  'summary', 'direction', 'discount', 'includes', 'excludes', 'terms', 'notes', 'signName', 'signUs'];

function render() {
  FIELDS.forEach(k => { const el = $('#' + k); if (el) el.value = current[k] ?? ''; });
  renderItems(); renderTotals(); renderDrafts();
}

/* ---------- the exported document ---------- */
const bullets = s => String(s || '').split('\n').map(l => l.trim()).filter(Boolean);

function quoteHTML() {
  const d = current, e = escapeHTML, t = sums(d), c = d.currency;
  const rtl = d.direction === 'rtl';
  const items = d.items.filter(i => String(i.desc).trim() || num(i.qty) * num(i.price));
  const list = (label, arr) => arr.length
    ? `<section class="block"><h2>${e(label)}</h2><ul>${arr.map(l => `<li>${e(l)}</li>`).join('')}</ul></section>` : '';
  const para = (label, txt) => String(txt || '').trim()
    ? `<section class="block"><h2>${e(label)}</h2><p class="pre">${e(txt)}</p></section>` : '';
  const validTo = (() => {
    if (!d.date || !num(d.valid)) return '';
    const dt = new Date(d.date); dt.setDate(dt.getDate() + num(d.valid));
    return dt.toISOString().slice(0, 10);
  })();

  return `<!doctype html><html lang="${rtl ? 'he' : 'en'}"${rtl ? ' dir="rtl"' : ''}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(d.title || 'Quotation')} — CN PROD</title>
<style>${typeof TREATMENT_FONT_CSS === 'string' ? TREATMENT_FONT_CSS : ''}
*{box-sizing:border-box}
body{margin:0;background:#000;color:#f4f4f2;font:400 15px/1.7 Heebo,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.sheet{max-width:900px;margin:auto;padding:6vw 5vw 60px}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;border-bottom:1px solid rgba(244,244,242,.16);padding-bottom:26px}
.cn-logo{width:54px;height:57px;color:#fff;display:block;margin-bottom:12px}
.brand{font:600 17px Oswald,sans-serif;letter-spacing:.2em;color:#ffd400}
.kind{font:600 10px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;margin-top:6px}
.ref{text-align:${rtl ? 'left' : 'right'};font:600 10px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,244,242,.42);line-height:2.1}
.ref b{display:block;color:#f4f4f2;font-weight:600}
h1{font:700 clamp(32px,6vw,62px)/1.02 Karantina,Oswald,sans-serif;letter-spacing:.04em;text-transform:uppercase;margin:34px 0 10px;overflow-wrap:anywhere}
.who{display:flex;gap:40px;flex-wrap:wrap;margin:22px 0 6px}
.who div{min-width:180px}
.who b{display:block;font:600 10px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(244,244,242,.42);margin-bottom:4px}
.summary{font-size:17px;max-width:60ch;margin:14px 0 0}
h2{font:600 11px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#ffd400;margin:0 0 14px}
.block{padding:34px 0;border-bottom:1px solid rgba(244,244,242,.16);break-inside:avoid}
.block ul{margin:0;padding-${rtl ? 'right' : 'left'}:18px}
.block li{margin-bottom:7px}
.pre{white-space:pre-wrap;margin:0;max-width:70ch}
table{width:100%;border-collapse:collapse}
th{font:600 9.5px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,244,242,.42);text-align:${rtl ? 'right' : 'left'};padding:0 0 10px;border-bottom:1px solid rgba(244,244,242,.16)}
th.n,td.n{text-align:${rtl ? 'left' : 'right'};white-space:nowrap;font-variant-numeric:tabular-nums}
td{padding:14px 0;border-bottom:1px solid rgba(244,244,242,.08);vertical-align:top}
td .note{display:block;color:rgba(244,244,242,.42);font-size:13.5px;margin-top:4px;white-space:pre-wrap}
.tot{margin-${rtl ? 'right' : 'left'}:auto;width:min(340px,100%);margin-top:22px}
.tot div{display:flex;justify-content:space-between;gap:20px;padding:7px 0}
.tot span:first-child{font:600 10px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,244,242,.42)}
.tot .grand{border-top:1px solid rgba(244,244,242,.16);margin-top:8px;padding-top:14px}
.tot .grand span:first-child{color:#ffd400}
.tot .grand span:last-child{font:700 clamp(24px,4vw,34px)/1 Karantina,Oswald,sans-serif;letter-spacing:.03em;color:#ffd400}
.sign{padding-top:38px;break-inside:avoid}
.sign-grid{display:flex;gap:40px;flex-wrap:wrap;margin-top:26px}
.sign-grid div{flex:1 1 240px}
.rule{border-bottom:1px solid rgba(244,244,242,.42);height:52px}
.rule-l{font:600 9.5px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,244,242,.42);margin-top:8px;display:block}
.sign p{max-width:70ch;color:rgba(244,244,242,.42);font-size:13.5px}
footer{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding-top:26px;margin-top:34px;border-top:1px solid rgba(244,244,242,.16);font:600 10px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(244,244,242,.42)}
@media print{
 /* the PDF keeps the dark design — it is a document to read on a screen, not
    something to run off on paper. margin:0 + explicit background is what makes
    the black reach the page edge; print-color-adjust stops the browser
    helpfully dropping it. */
 @page{size:A4;margin:0}
 html,body{background:#000;color:#f4f4f2;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 body{font-size:10.5pt}
 .sheet{max-width:none;padding:16mm 14mm}
 h1{font-size:32pt;margin-top:10mm}
 .block{padding:9mm 0;break-inside:avoid}
 table,tr,.sign,.sign-grid,footer{break-inside:avoid}
 .tot{margin-top:8mm}
}
</style></head><body><div class="sheet">
<div class="head">
  <div><div class="brand">${LOGO}CN PROD</div><div class="kind">Proposal &amp; Quotation</div></div>
  <div class="ref">
    ${d.number ? `<span>Quotation</span><b>${e(d.number)}</b>` : ''}
    ${d.date ? `<span>Date</span><b>${e(d.date)}</b>` : ''}
    ${validTo ? `<span>Valid until</span><b>${e(validTo)}</b>` : ''}
  </div>
</div>
<h1>${e(d.title || 'Untitled project')}</h1>
<div class="who">
  <div><b>From</b>CN PROD${d.signUs ? `<br>${e(d.signUs)}` : ''}<br>rotem1chen@gmail.com</div>
  ${d.client ? `<div><b>For</b>${e(d.client)}${d.clientDetail ? `<br>${e(d.clientDetail)}` : ''}</div>` : ''}
</div>
${String(d.summary || '').trim() ? `<p class="summary">${e(d.summary)}</p>` : ''}

<section class="block"><h2>What it includes</h2>
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Amount</th></tr></thead><tbody>
${items.map(i => `<tr><td>${e(i.desc || '—')}${String(i.note || '').trim() ? `<span class="note">${e(i.note)}</span>` : ''}</td>` +
  `<td class="n">${e(num(i.qty))}</td><td class="n">${e(money(num(i.price), c))}</td>` +
  `<td class="n">${e(money(num(i.qty) * num(i.price), c))}</td></tr>`).join('')}
</tbody></table>
<div class="tot">
  <div><span>Subtotal</span><span>${e(money(t.sub, c))}</span></div>
  ${t.disc > 0 ? `<div><span>Discount</span><span>− ${e(money(t.disc, c))}</span></div>` : ''}
  ${num(d.vat) > 0 ? `<div><span>VAT ${e(num(d.vat))}%</span><span>${e(money(t.vat, c))}</span></div>` : ''}
  <div class="grand"><span>Total</span><span>${e(money(t.total, c))}</span></div>
</div></section>

${list('Included', bullets(d.includes))}
${list('Not included', bullets(d.excludes))}
${para('Payment terms', d.terms)}
${para('Conditions', d.notes)}

<section class="sign"><h2>Agreement</h2>
<p>Signing below confirms the scope, the price and the terms set out above${validTo ? `, and that this quotation is accepted on or before ${e(validTo)}` : ''}.</p>
<div class="sign-grid">
  <div><div class="rule"></div><span class="rule-l">Client signature${d.signName ? ` · ${e(d.signName)}` : ''}</span></div>
  <div><div class="rule"></div><span class="rule-l">Date</span></div>
</div>
<div class="sign-grid">
  <div><div class="rule"></div><span class="rule-l">For CN PROD${d.signUs ? ` · ${e(d.signUs)}` : ''}</span></div>
  <div><div class="rule"></div><span class="rule-l">Date</span></div>
</div>
</section>
<footer><span>CN PROD</span><span>Directing · Production · Post-production</span></footer>
</div></body></html>`;
}

/* ---------- chrome ---------- */
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 3200);
}
const filename = () => (current.title || current.number || 'cn-quotation')
  .replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 80) || 'cn-quotation';

FIELDS.forEach(k => {
  const el = $('#' + k); if (!el) return;
  el.addEventListener('input', () => {
    current[k] = el.value;
    if (['currency', 'vat', 'discount'].includes(k)) { renderItems(); renderTotals(); }
    if (['title', 'client', 'number'].includes(k)) renderDrafts();
    clearTimeout(timer); timer = setTimeout(persist, 400);
  });
  el.addEventListener('change', () => { current[k] = el.value; renderTotals(); renderDrafts(); persist(); });
});

$('#new').onclick = () => { current = fresh(); drafts.unshift(current); persist(); render(); $('#title').focus(); };
$('#add-item').onclick = () => { current.items.push(line()); renderItems(); persist(); };
$('#preview').onclick = () => { $('#preview-frame').srcdoc = quoteHTML(); $('#preview-dialog').showModal(); };
$('#close-preview').onclick = () => $('#preview-dialog').close();
$('#print').onclick = () => { toast('Set the destination to Save as PDF.'); $('#preview-frame').contentWindow.print(); };
$('#export').onclick = () => treatmentFiles.save(quoteHTML(), 'text/html', filename() + '.html');
$('#backup').onclick = () => treatmentFiles.save(JSON.stringify({ schema: 1, quotes: drafts }, null, 2), 'application/json', 'cn-quotations-backup.json', true);
treatmentFiles.init();

const shareRow = $('#share-row'), shareLink = $('#share-link'), shareBtn = $('#share');
function showShare(url) {
  shareLink.href = url; shareLink.textContent = url;
  $('#share-wa').href = 'https://wa.me/?text=' + encodeURIComponent(url);
  shareRow.hidden = false;
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied — paste it in Instagram.'), () => toast('Link ready — copy it below.'));
  else toast('Link ready — copy it below.');
}
$('#share-copy').onclick = () => {
  navigator.clipboard.writeText(shareLink.href).then(() => toast('Link copied.'), () => {
    const r = document.createRange(); r.selectNodeContents(shareLink);
    getSelection().removeAllRanges(); getSelection().addRange(r); toast('Select and copy the link.');
  });
};
shareBtn.onclick = () => {
  if (typeof treatmentShare === 'undefined' || !treatmentShare.configured()) { toast('Add an OAuth client id to media-config.js first — see CLAUDE.md.'); return; }
  if (!treatmentShare.ready()) { toast('Google sign-in did not load. Check your connection and retry.'); return; }
  const label = shareBtn.textContent; shareBtn.disabled = true;
  treatmentShare.publish(quoteHTML(), filename(), t => { shareBtn.textContent = t; })
    .then(showShare)
    .catch(err => {
      const m = String(err && err.message || err);
      toast(m.indexOf('denied') > -1 ? 'Sign-in cancelled — nothing was uploaded.'
        : m.indexOf('no-client-id') > -1 ? 'No OAuth client id set — see CLAUDE.md.'
        : 'Could not upload: ' + m);
    })
    .then(() => { shareBtn.disabled = false; shareBtn.textContent = label; });
};

$('#import').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const rows = data.quotes || data.treatments;
    if (!Array.isArray(rows)) throw new Error('That file is not a quotations backup.');
    for (const q of rows) {
      q.id = uid(); q.items = (q.items || [line()]).map(i => ({ ...i, id: uid() }));
      drafts.unshift(q); await saveOther(q);
    }
    current = drafts[0]; render(); toast('Backup imported as new quotations.');
  } catch (err) { toast(err.message); }
  e.target.value = '';
};

(async () => {
  try {
    db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('cn-quotations', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('quotes', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    drafts = await new Promise((resolve, reject) => {
      const req = db.transaction('quotes').objectStore('quotes').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    drafts.sort((a, b) => b.updated - a.updated);
    $('#save-state').textContent = 'Saved in this browser';
  } catch { $('#save-state').textContent = 'Storage unavailable — use backups'; }
  if (!drafts.length) drafts = [fresh()];
  current = drafts[0];
  render();
})();
