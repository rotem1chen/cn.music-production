/* Reuse Link Maker's browser-only PIN gate; this is not server authentication. */
(() => {
  'use strict';
  let opened = false;
  function openEditor() {
    if (opened) return;
    opened = true;
    function load() {
      document.documentElement.style.visibility = 'visible';
      if (window.parent !== window) {
        document.querySelector('.tool-link').hidden = true;
      }
      const files = document.createElement('script');
      files.src = 'treatment-files.js?v=1';
      files.onload = () => {
        // fonts first: exported treatments inline them, so they must be here before export
        const fonts = document.createElement('script');
        fonts.src = 'treatment-fonts.js?v=1';
        fonts.onload = fonts.onerror = () => {
          const script = document.createElement('script');
          script.src = 'treatment.js?v=8';
          document.body.appendChild(script);
        };
        document.body.appendChild(fonts);
      };
      files.onerror = () => { document.querySelector('#save-state').textContent = 'Could not load editor. Please refresh.'; };
      document.body.appendChild(files);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, {once:true});
    else load();
  }
  if (window.parent !== window) {
    window.addEventListener('message', event => {
      if (event.origin === location.origin && event.source === window.parent && event.data === 'cn-treatment-unlocked') openEditor();
    });
    window.parent.postMessage('cn-treatment-check', location.origin);
  } else {
    // Enter through the locked workspace, even when following an old direct link.
    location.replace('link.html?tool=treatment');
  }
})();
