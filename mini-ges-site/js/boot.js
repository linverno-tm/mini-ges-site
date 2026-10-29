/* Runs in <head>, before the first paint (tiny and blocking on purpose).
   After a UZ/RU switch the reader stays in place: no loader, the page fades in where they were.
   The rest happens in main.js (search "language switch"). */
try {
  var s = JSON.parse(sessionStorage.getItem('ges:lang-switch') || 'null');
  if (s && Date.now() - s.t < 15000) document.documentElement.classList.add('lang-switch');
} catch (e) { /* storage blocked: normal load with the loader */ }
