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
      const script = document.createElement('script');
      script.src = 'treatment.js?v=2';
      document.body.appendChild(script);
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
