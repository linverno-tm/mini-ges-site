/* Runs in <head>, before the first paint (tiny and blocking on purpose).
   1) Baliqchi GES launch state is decided here, so "under construction" text never flashes and swaps (no CLS).
   2) After a language switch the reader returns to the same section (main.js reads the note). */
(function () {
  var d = document.documentElement;
  if (Date.now() > Date.parse('2026-10-31T23:59:59+05:00')) d.classList.add('launched');
  try {
    var s = JSON.parse(sessionStorage.getItem('ges:lang-switch') || 'null');
    if (s && Date.now() - s.t < 15000) d.classList.add('lang-switch');
  } catch (e) { /* storage blocked */ }
})();
