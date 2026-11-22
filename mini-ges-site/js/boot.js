/* Runs in <head>, before the first paint (tiny and blocking on purpose):
   after a language switch the reader returns to the same section (main.js reads the note). */
(function () {
  var d = document.documentElement;
  try {
    var s = JSON.parse(sessionStorage.getItem('ges:lang-switch') || 'null');
    if (s && Date.now() - s.t < 15000) d.classList.add('lang-switch');
  } catch (e) { /* storage blocked */ }
})();
