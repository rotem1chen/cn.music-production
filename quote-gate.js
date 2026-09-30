/* Same browser-only PIN gate as the treatment editor: this page only opens once
   the unlocked Link Maker says so. Not server authentication. */
(() => {
  'use strict';
  let opened = false;
  function openEditor() {
    if (opened) return;
    opened = true;
    function load() {
      document.documentElement.style.visibility = 'visible';
      if (window.parent !== window) {
        const link = document.querySelector('.tool-link');
        if (link) link.hidden = true;
      }
      /* files → fonts → share → editor, so the export has everything it needs */
      const chain = ['treatment-files.js?v=1', 'treatment-fonts.js?v=1', 'treatment-share.js?v=1', 'quote.js?v=1'];
      (function next(i) {
        if (i >= chain.length) return;
        const s = document.createElement('script');
        s.src = chain[i];
        s.onload = s.onerror = () => next(i + 1);
        document.body.appendChild(s);
      })(0);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
    else load();
  }
  if (window.parent !== window) {
    window.addEventListener('message', event => {
      if (event.origin === location.origin && event.source === window.parent && event.data === 'cn-quote-unlocked') openEditor();
    });
    window.parent.postMessage('cn-quote-check', location.origin);
  } else {
    location.replace('link.html?tool=quote');
  }
})();
