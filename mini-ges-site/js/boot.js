/* Runs in <head>, before the first paint (tiny and blocking on purpose).
   After a UZ/RU switch the reader stays in place: no loader, the page fades in where they were.
   The rest happens in main.js (search "language switch"). */
try {
  var s = JSON.parse(sessionStorage.getItem('ges:lang-switch') || 'null');
  if (s && Date.now() - s.t < 15000) document.documentElement.classList.add('lang-switch');
} catch (e) { /* storage blocked: normal load with the loader */ }

// The brand loader plays once per session, on desktops only. Phones, reduced motion and repeat
// visits get .intro-css: no loader, the hero rises in with CSS (style.css, "loader").
(function () {
  var root = document.documentElement, seen = false;
  try { seen = !!sessionStorage.getItem('ges:intro'); sessionStorage.setItem('ges:intro', '1'); } catch (e) { /* no storage: treat as first visit */ }
  if (root.classList.contains('lang-switch')) return;
  if (seen || window.matchMedia('(max-width: 768px), (prefers-reduced-motion: reduce)').matches) root.classList.add('intro-css');
})();
