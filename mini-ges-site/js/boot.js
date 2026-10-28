/* Runs in <head>, before the first paint (tiny and blocking on purpose).
   After a UZ/RU switch the reader stays in place: no loader, the page fades in where they were.
   The rest happens in main.js (search "language switch"). */
try {
  var s = JSON.parse(sessionStorage.getItem('ges:lang-switch') || 'null');
  if (s && Date.now() - s.t < 15000) document.documentElement.classList.add('lang-switch');
} catch (e) { /* storage blocked: normal load with the loader */ }

// Web fonts without blocking the first paint: a script-added stylesheet does not hold rendering,
// and the loader covers the short fallback-font moment. <noscript> in index.html keeps the plain link.
(function () {
  var fonts = document.getElementById('fonts');
  if (!fonts) return;
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fonts.href;
  document.head.appendChild(link);
})();
