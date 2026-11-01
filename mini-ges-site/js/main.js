/* MINI GES — interaction layer. No animation library: motion is CSS (transitions, keyframes,
   scroll-driven where supported); this file only switches states, plays media near the viewport,
   runs the calculator and the enquiry form. Every text is visible without it. */
document.documentElement.classList.add('js-on');

// Site root, derived from this script's URL: works for /, /ru/, /en/ and sub-path hosting.
const SITE_BASE = (() => {
  const src = document.currentScript && document.currentScript.src;
  return src ? new URL('../', src).href : new URL('./', location.href).href;
})();

// UI strings created by script (static text is localised at build time, see tools/i18n.py)
const LANG = ['ru', 'en'].includes(document.documentElement.lang) ? document.documentElement.lang : 'uz';
const L = {
  uz: {
    offline: "Internet yo'q — saqlangan versiya ko'rsatilmoqda", online: 'Internet tiklandi',
    calcAdded: "Hisob-kitob arizaga qo'shildi", leadCopied: "Ariza matni nusxalandi: messenjerga qo'ying", copyFail: "Nusxalab bo'lmadi — matnni belgilab oling",
    errWrap: list => `Iltimos, ${list} kiriting.`, errName: 'ismingizni', errPhone: 'telefon raqamingizni (kamida 9 raqam)', errRegion: 'hududni',
    leadHello: "Assalomu alaykum! Mini-GES loyihasi bo'yicha ariza.", fName: 'Ism', fPhone: 'Telefon', fRegion: 'Hudud', fSource: "Yo'nalish", fMsg: 'Izoh',
    calcMsg: (q, h, p, e) => `Kalkulyator: Q = ${q} m³/s, H = ${h} m → taxminan ${p} kVt, ${e} kVt·soat/yil.`,
    uQ: ' m³/s', uH: ' m', usdM: ' mln $', usdK: ' ming $', yr: ' yil',
  },
  ru: {
    offline: 'Нет интернета — показана сохранённая версия', online: 'Интернет восстановлен',
    calcAdded: 'Расчёт добавлен в заявку', leadCopied: 'Текст заявки скопирован — вставьте в мессенджер', copyFail: 'Не удалось скопировать — выделите текст вручную',
    errWrap: list => `Пожалуйста, укажите ${list}.`, errName: 'имя', errPhone: 'номер телефона (не меньше 9 цифр)', errRegion: 'регион',
    leadHello: 'Здравствуйте! Заявка по проекту мини-ГЭС.', fName: 'Имя', fPhone: 'Телефон', fRegion: 'Регион', fSource: 'Направление', fMsg: 'Комментарий',
    calcMsg: (q, h, p, e) => `Калькулятор: Q = ${q} м³/с, H = ${h} м → примерно ${p} кВт, ${e} кВт·ч/год.`,
    uQ: ' м³/с', uH: ' м', usdM: ' млн $', usdK: ' тыс. $', yr: ' г.',
  },
  en: {
    offline: 'No internet — showing the saved version', online: 'Back online',
    calcAdded: 'Estimate added to your enquiry', leadCopied: 'Enquiry text copied — paste it into a messenger', copyFail: 'Could not copy — please select the text',
    errWrap: list => `Please enter ${list}.`, errName: 'your name', errPhone: 'your phone number (at least 9 digits)', errRegion: 'your region',
    leadHello: 'Hello! An enquiry about a small hydropower project.', fName: 'Name', fPhone: 'Phone', fRegion: 'Region', fSource: 'Type', fMsg: 'Comment',
    calcMsg: (q, h, p, e) => `Calculator: Q = ${q} m³/s, H = ${h} m → about ${p} kW, ${e} kWh/year.`,
    uQ: ' m³/s', uH: ' m', usdM: ' mln $', usdK: 'k $', yr: ' yrs',
  },
}[LANG];

(function mainGES() {
  'use strict';

  // ------------------------------------------------------------------ config
  const LAUNCH = Date.parse('2026-10-31T23:59:59+05:00');   // Baliqchi GES (boot.js uses the same date)
  const CALC = { eff: 0.8, load: 0.9, household: 2200, co2: 0.77, coal: 0.4, capex: [1700, 2500], usd: 12700 };   // capex: $ per kW on our own plants; kg per kWh
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wide = () => matchMedia('(min-width: 900px)').matches;
  const conn = navigator.connection || {};
  // data saver / 2G / weak device: photos instead of clips, no 3D unless asked
  const lite = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '') || (navigator.deviceMemory || 8) <= 2;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n, d = 0) => Number(n).toLocaleString(LANG === 'en' ? 'en-US' : 'ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, ' ');
  const io = (cb, opts) => new IntersectionObserver(cb, opts);
  if (reduced) root.classList.add('reduced');

  // ------------------------------------------------------------------ the stream: water until the turbine, current after it
  const PHASE = { hero: 'suv', how: 'suv', turbina: 'tok', projects: 'beton', yilnoma: 'beton', calc: 'tok', contact: 'tok', faq: 'tok', news: 'tok' };
  const phaseObs = io((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) root.dataset.phase = PHASE[e.target.id] || 'suv'; });
  }, { rootMargin: '-50% 0px -50% 0px' });
  Object.keys(PHASE).forEach((id) => { const el = document.getElementById(id); if (el) phaseObs.observe(el); });

  // ------------------------------------------------------------------ media: clips play only on screen, never on data saver
  // A clip is fetched the first time it is needed (phone-size file under 900 px) and paused off screen.
  function clip(video) {
    if (!video || lite || reduced) return { play() {}, pause() {} };
    let loaded = false;
    return {
      play() {
        if (!loaded) {
          loaded = true;
          video.src = SITE_BASE + (wide() ? video.dataset.src : video.dataset.srcSm || video.dataset.src);
          video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
        }
        const p = video.play();
        if (p && p.catch) p.catch(() => { /* autoplay refused: the still stays */ });
      },
      pause() { if (loaded) video.pause(); },
    };
  }
  function playWhileVisible(video, margin = '0px') {
    const c = clip(video);
    if (!video) return;
    io(([e]) => (e.isIntersecting && !document.hidden ? c.play() : c.pause()), { rootMargin: margin }).observe(video.parentElement);
  }
  // the hero clip waits for the page to finish loading: the still (LCP) gets the bandwidth first
  const startHero = () => playWhileVisible($('.hero__film'));
  if (document.readyState === 'complete') setTimeout(startHero, 300);
  else addEventListener('load', () => setTimeout(startHero, 300), { once: true });
  playWhileVisible($('.plant__film'), '100px');

  // ------------------------------------------------------------------ how it works: the step in the middle of the screen drives the stage
  const stage = $('#howStage');
  if (stage) {
    const shots = $$('.shot', stage), nodes = $$('.scheme__node', stage), steps = $$('.hstep');
    const clips = shots.map(s => clip($('video', s)));
    let current = 0, stageVisible = false;
    const setStep = (n) => {
      if (n === current) return;
      current = n;
      stage.dataset.step = n;
      steps.forEach(s => s.classList.toggle('is-on', +s.dataset.step === n));
      shots.forEach((s, i) => {
        const on = i === n - 1;
        s.classList.toggle('is-on', on);
        if (on && stageVisible) clips[i].play(); else clips[i].pause();
      });
      nodes.forEach(nd => nd.classList.toggle('is-lit', +nd.dataset.n <= n));
    };
    // active step = the one whose text is closest to the reading line (screen middle; on phones the
    // middle of the area left under the sticky stage). Measured on scroll, only while the section is near.
    let near = false, ticking = false;
    const pick = () => {
      ticking = false;
      const line = wide() ? innerHeight * 0.5 : (stage.getBoundingClientRect().bottom + innerHeight) / 2;
      let best = 1, dist = Infinity;
      steps.forEach((s) => {
        const h = $('h3', s).getBoundingClientRect(), d = Math.abs(h.top + h.height / 2 - line);
        if (d < dist) { dist = d; best = +s.dataset.step; }
      });
      setStep(best);
    };
    addEventListener('scroll', () => { if (near && !ticking) { ticking = true; requestAnimationFrame(pick); } }, { passive: true });
    io(([e]) => { near = e.isIntersecting; if (near) pick(); }).observe($('.how__grid'));
    io(([e]) => {
      stageVisible = e.isIntersecting;
      clips.forEach((c, i) => (stageVisible && i === current - 1 ? c.play() : c.pause()));
    }).observe($('.how__frame', stage));
    // the next still is fetched ahead so a step never shows an empty frame
    io(([e], obs) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      $$('img', stage).forEach(img => { img.loading = 'eager'; });
    }, { rootMargin: '600px 0px' }).observe(stage);
    setStep(1);
  }

  // ------------------------------------------------------------------ 3D turbine (Sketchfab CC BY model, ~0.3 MB + three.js)
  // Desktop: fetched when the block is near. Phone / data saver: only after the button is pressed.
  const turb = $('#turb3d');
  if (turb) {
    const cvs = $('.turb3d__cvs', turb), pct = $('.turb3d__pct', turb), go = $('.turb3d__go', turb);
    let view = null, visible = false, started = false;
    const loadScript = () => new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = SITE_BASE + 'js/vendor/turbine3d.min.js?v=2'; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    const start = () => {
      if (started) return;
      started = true;
      turb.classList.add('is-loading');
      loadScript()
        .then(() => window.GESTurbine.mount(cvs, SITE_BASE + 'assets/3d/kaplan.glb?v=1', (f) => { pct.textContent = Math.round(f * 100) + '%'; }))
        .then((v) => { view = v; turb.classList.add('is-3d'); view.setRunning(visible && !document.hidden); })
        .catch(() => { started = false; /* WebGL or network failed: the poster stays */ })
        .finally(() => turb.classList.remove('is-loading'));
    };
    go.addEventListener('click', start);
    if (finePointer && !reduced && !lite && wide()) {
      io(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); start(); } }, { rootMargin: '600px 0px' }).observe(turb);
    }
    io(([e]) => { visible = e.isIntersecting; if (view) view.setRunning(visible && !document.hidden); }).observe(turb);
    document.addEventListener('visibilitychange', () => { if (view) view.setRunning(visible && !document.hidden); });
  }

  // ------------------------------------------------------------------ live energy counter (Ulug'nor GES)
  // Estimate from the station's real annual output (5.2 GWh) since launch in September 2024.
  const LIVE = { start: Date.parse('2024-09-01T00:00:00+05:00'), perSec: 5.2e6 / (365.25 * 86400), co2: CALC.co2 / 1000, coal: CALC.coal / 1000 };
  const liveKwh = $$('[data-live-kwh]'), liveCo2 = $$('[data-live-co2]'), liveCoal = $$('[data-live-coal]');
  const tickLive = () => {
    if (document.hidden) return;
    const kwh = (Date.now() - LIVE.start) / 1000 * LIVE.perSec;
    const whole = fmt(Math.floor(kwh)), frac = Math.floor((kwh % 1) * 10);
    liveKwh.forEach((el) => { el.innerHTML = `${whole}<small>${LANG === 'en' ? '.' : ','}${frac}</small>`; });
    liveCo2.forEach((el) => { el.textContent = fmt(kwh * LIVE.co2); });
    liveCoal.forEach((el) => { el.textContent = fmt(kwh * LIVE.coal); });
  };
  if (liveKwh.length) { tickLive(); setInterval(tickLive, reduced ? 5000 : 250); }

  // ------------------------------------------------------------------ countdown (only before the launch)
  const countdowns = $$('[data-countdown]');
  if (countdowns.length && Date.now() < LAUNCH) {
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      const diff = LAUNCH - Date.now();
      if (diff <= 0) { root.classList.add('launched'); clearInterval(t); return; }
      const s = Math.floor(diff / 1000);
      const parts = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
      countdowns.forEach(c => $$('[data-cd]', c).forEach((b) => { b.textContent = pad(parts[b.dataset.cd]); }));
    };
    const t = setInterval(tick, 1000);
    tick();
  }

  // ------------------------------------------------------------------ chronicle: the canal under the photos fills as you swipe
  const strip = $('#chronTrack');
  if (strip) {
    const fill = $('#chronFill'), prev = $('.chron__nav [data-dir="-1"]'), next = $('.chron__nav [data-dir="1"]');
    const sync = () => {
      const max = strip.scrollWidth - strip.clientWidth;
      const p = max > 0 ? strip.scrollLeft / max : 1;
      fill.style.setProperty('--p', (0.08 + p * 0.92).toFixed(3));
      if (prev) prev.disabled = strip.scrollLeft < 4;
      if (next) next.disabled = strip.scrollLeft > max - 4;
    };
    strip.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    addEventListener('resize', sync, { passive: true });
    sync();
    $$('.chron__nav [data-dir]').forEach((b) => b.addEventListener('click', () => {
      const item = $('.ci', strip);
      strip.scrollBy({ left: +b.dataset.dir * (item.offsetWidth + 16) * (wide() ? 2 : 1), behavior: reduced ? 'auto' : 'smooth' });
    }));
  }

  // ------------------------------------------------------------------ calculator
  const inQ = $('#inQ'), inH = $('#inH'), inT = $('#inT');
  let lastCalc = null;
  if (inQ) {
    const out = { P: $('#rP'), E: $('#rE'), R: $('#rR'), Hh: $('#rHh'), C: $('#rC'), Cap: $('#rCap'), Pay: $('#rPay') };
    const rig = $('#rig'), water = $('#rigWater'), PMAX = 9.81 * 10 * 30 * CALC.eff;
    const shown = { P: 0, E: 0, R: 0, Hh: 0, C: 0 };
    let from = null, target = null, t0 = 0, raf = 0;
    const fillRange = (el) => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
    const render = () => {
      out.P.textContent = fmt(shown.P, shown.P < 100 ? 1 : 0);
      out.E.textContent = fmt(shown.E);
      out.R.textContent = fmt(shown.R, shown.R < 100 ? 1 : 0);
      out.Hh.textContent = fmt(shown.Hh);
      out.C.textContent = fmt(shown.C, shown.C < 100 ? 1 : 0);
      // project cost and payback from our own plants' price per kW (a range, not a quote)
      const [lo, hi] = CALC.capex.map(c => shown.P * c);
      out.Cap.textContent = shown.P > 0 ? (hi >= 1e6 ? fmt(lo / 1e6, 1) + '–' + fmt(hi / 1e6, 1) + L.usdM : fmt(lo / 1000) + '–' + fmt(hi / 1000) + L.usdK) : '—';
      out.Pay.textContent = shown.R > 0 ? fmt(lo * CALC.usd / (shown.R * 1e6), 1) + '–' + fmt(hi * CALC.usd / (shown.R * 1e6), 1) + L.yr : '—';
    };
    const step = (now) => {
      const k = clamp((now - t0) / 700, 0, 1), e = 1 - Math.pow(1 - k, 3);
      Object.keys(shown).forEach((key) => { shown[key] = from[key] + (target[key] - from[key]) * e; });
      render();
      raf = k < 1 ? requestAnimationFrame(step) : 0;
    };
    const calc = (animate) => {
      const Q = +inQ.value, H = +inH.value, T = Math.max(0, +inT.value || 0);
      const P = 9.81 * Q * H * CALC.eff, E = P * 8760 * CALC.load;
      target = { P, E, R: (E * T) / 1e6, Hh: E / CALC.household, C: (E * CALC.co2) / 1000 };
      lastCalc = { Q, H, ...target };
      $('#outQ').textContent = fmt(Q, 1) + L.uQ;
      $('#outH').textContent = fmt(H, H % 1 ? 1 : 0) + L.uH;
      fillRange(inQ); fillRange(inH);
      // the rig: water depth follows Q, the fall follows H, rotor speed and the bolt follow P
      const depth = 14 + (Q / 10) * 96;
      water.setAttribute('y', String(160 - depth)); water.setAttribute('height', String(depth));
      rig.style.setProperty('--fw', (3 + (Q / 10) * 12).toFixed(1));
      const share = Math.sqrt(clamp(P / PMAX, 0, 1));
      rig.style.setProperty('--spin', (2.6 - share * 2.35).toFixed(2) + 's');
      rig.style.setProperty('--glow', (0.25 + share * 0.75).toFixed(2));
      $('#rigH').textContent = 'H = ' + fmt(H, H % 1 ? 1 : 0) + L.uH;
      if (!animate || reduced) { Object.assign(shown, target); render(); return; }
      from = { ...shown }; t0 = performance.now();
      if (!raf) raf = requestAnimationFrame(step);
    };
    [inQ, inH, inT].forEach(el => el.addEventListener('input', () => calc(true)));
    const tariffs = $$('.tariff');
    const syncTariff = () => tariffs.forEach(b => b.classList.toggle('is-on', +b.dataset.t === +inT.value));
    tariffs.forEach(b => b.addEventListener('click', () => { inT.value = b.dataset.t; syncTariff(); calc(true); }));
    inT.addEventListener('input', syncTariff);
    calc(false);
    $('#calcSend').addEventListener('click', () => {
      const c = lastCalc;
      $('#fMsg').value = L.calcMsg(fmt(c.Q, 1), fmt(c.H, 1), fmt(c.P), fmt(c.E));
      $('#contact').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      setTimeout(() => $('#fName').focus({ preventScroll: true }), 700);
      toast(L.calcAdded);
      track('calc');
    });
  }

  // ------------------------------------------------------------------ industry news: topic filter + "show more"
  const news = $('#news'), newsList = $('#newsList');
  if (news && newsList) {
    const cards = $$('.ncard', newsList), chips = $$('.nchip', news), moreBtn = $('#newsMore');
    let expanded = false, topic = 'all';
    const apply = () => {
      cards.forEach(c => c.classList.toggle('is-out', topic !== 'all' && c.dataset.tag !== topic));
      news.classList.toggle('is-all', topic !== 'all' || expanded);
      if (moreBtn) moreBtn.hidden = topic !== 'all';
    };
    chips.forEach(chip => chip.addEventListener('click', () => {
      topic = chip.dataset.tag;
      chips.forEach((c) => { c.classList.toggle('is-on', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
      apply();
    }));
    if (moreBtn) {
      const label = $('span', moreBtn), moreText = label.textContent;
      moreBtn.addEventListener('click', () => {
        expanded = !expanded;
        moreBtn.setAttribute('aria-expanded', String(expanded));
        label.textContent = expanded ? moreBtn.dataset.less : moreText;
        apply();
      });
    }
  }

  // ------------------------------------------------------------------ analytics (Yandex Metrika)
  // Off until YM_ID is set: then the counter loads after the page and key actions count as goals.
  const YM_ID = 0;
  function track(goal) { if (YM_ID && window.ym) window.ym(YM_ID, 'reachGoal', goal); }
  if (YM_ID) {
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    window.ym(YM_ID, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
    const tag = document.createElement('script'); tag.async = true; tag.src = 'https://mc.yandex.ru/metrika/tag.js';
    addEventListener('load', () => document.head.appendChild(tag), { once: true });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]'); if (!a) return;
      if (a.href.startsWith('tel:')) track('call'); else if (a.hostname === 't.me') track('telegram');
    });
  }

  // ------------------------------------------------------------------ toast + copy
  const toastEl = $('#toast');
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }
  const copyText = text => (navigator.clipboard && navigator.clipboard.writeText
    ? navigator.clipboard.writeText(text).then(() => true, () => false) : Promise.resolve(false));
  addEventListener('offline', () => toast(L.offline));
  addEventListener('online', () => toast(L.online));

  // ------------------------------------------------------------------ enquiry form → Telegram chat with the text ready
  const form = $('#leadForm');
  if (form) {
    const err = $('#leadErr'), ok = $('#leadOk'), txt = $('#leadText');
    const fields = { name: $('#fName'), phone: $('#fPhone'), region: $('#fRegion') };
    Object.values(fields).forEach(f => f.addEventListener('input', () => { f.parentElement.classList.remove('is-bad'); f.removeAttribute('aria-invalid'); }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = fields.name.value.trim(), phone = fields.phone.value.trim(), region = fields.region.value;
      const source = (form.querySelector('input[name="source"]:checked') || {}).value || '';
      const msg = $('#fMsg').value.trim();
      const bad = [];
      if (name.length < 2) bad.push([fields.name, L.errName]);
      if (phone.replace(/\D/g, '').length < 9) bad.push([fields.phone, L.errPhone]);
      if (!region) bad.push([fields.region, L.errRegion]);
      Object.values(fields).forEach((f) => { f.parentElement.classList.remove('is-bad'); f.removeAttribute('aria-invalid'); });
      if (bad.length) {
        bad.forEach(([f]) => { f.parentElement.classList.add('is-bad'); f.setAttribute('aria-invalid', 'true'); f.setAttribute('aria-describedby', 'leadErr'); });
        err.textContent = L.errWrap(bad.map(b => b[1]).join(', '));
        err.hidden = false;
        bad[0][0].focus();
        return;
      }
      err.hidden = true;
      const text = [L.leadHello, `${L.fName}: ${name}`, `${L.fPhone}: ${phone}`, `${L.fRegion}: ${region}`, `${L.fSource}: ${source}`, msg ? `${L.fMsg}: ${msg}` : null]
        .filter(Boolean).join('\n');
      txt.textContent = text;
      const tg = 'https://t.me/ozodbekov?text=' + encodeURIComponent(text);
      $('#leadTg').href = tg;
      window.open(tg, '_blank', 'noopener');
      track('lead');
      ok.hidden = false;
      $('h3', ok).setAttribute('tabindex', '-1');
      $('h3', ok).focus();
    });
    $('#leadCopy').addEventListener('click', () => copyText(txt.textContent).then(r => toast(r ? L.leadCopied : L.copyFail)));
    $('#leadBack').addEventListener('click', () => { ok.hidden = true; fields.name.focus(); });
  }

  // ------------------------------------------------------------------ nav, mobile menu, thumb CTA
  const nav = $('#nav'), dock = $('.dock'), heroEl = $('#hero'), contact = $('#contact');
  // the bar stays put: the sticky stage in "How it works" sits right under it
  let menuOpen = false, pastHero = false, atContact = false;
  const onScroll = () => nav.classList.toggle('is-solid', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // hidden over the interactive stages (step frames, 3D button) and at the form itself
  let overStage = 0;
  const syncDock = () => dock && dock.classList.toggle('is-on', pastHero && !atContact && !menuOpen && !overStage);
  ['#how', '#turbina'].forEach((sel) => {
    const el = $(sel);
    if (el) io(([e]) => { overStage += e.isIntersecting ? 1 : -1; overStage = Math.max(0, overStage); syncDock(); }).observe(el);
  });
  if (heroEl) io(([e]) => { pastHero = !e.isIntersecting; syncDock(); }).observe(heroEl);
  if (contact) io(([e]) => { atContact = e.isIntersecting; syncDock(); }, { rootMargin: '0px 0px -20% 0px' }).observe(contact);

  const navLinks = $$('.nav__links a');
  const linkObs = io((entries) => entries.forEach((e) => {
    const a = navLinks.find(l => l.getAttribute('href') === '#' + e.target.id);
    if (a) a.classList.toggle('is-active', e.isIntersecting);
  }), { rootMargin: '-50% 0px -50% 0px' });
  navLinks.forEach((a) => { const s = document.getElementById(a.getAttribute('href').slice(1)); if (s) linkObs.observe(s); });

  const burger = $('#burger'), menu = $('#mobileMenu');
  const setMenu = (open) => {
    menuOpen = open;
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    syncDock();
    if (open) $('a', menu).focus();
  };
  burger.addEventListener('click', () => setMenu(!menuOpen));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });

  // ------------------------------------------------------------------ language switch: same section on the other language
  const SWITCH_KEY = 'ges:lang-switch';
  $$('.lang a:not([aria-current])').forEach((a) => a.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    let cur = null;
    $$('main section[id], footer section[id]').forEach((s) => { if (s.getBoundingClientRect().top <= innerHeight * 0.3) cur = s; });
    const r = cur && cur.getBoundingClientRect();
    try { sessionStorage.setItem(SWITCH_KEY, JSON.stringify({ id: cur ? cur.id : '', f: r ? clamp(-r.top / r.height, 0, 1) : 0, t: Date.now() })); } catch (err) { /* storage blocked: plain navigation */ }
  }));
  if (root.classList.contains('lang-switch')) {
    let note = null;
    try { note = JSON.parse(sessionStorage.getItem(SWITCH_KEY) || 'null'); sessionStorage.removeItem(SWITCH_KEY); } catch (err) { /* ignore */ }
    const sec = note && note.id && document.getElementById(note.id);
    if (sec) scrollTo(0, sec.getBoundingClientRect().top + scrollY + note.f * sec.offsetHeight);
    root.classList.add('switch-done');
  }
})();

// Offline copy: registered only on built pages (versioned main.js), never during local editing.
if ('serviceWorker' in navigator && document.querySelector('script[src*="main.js?v="]')) {
  addEventListener('load', () => {
    navigator.serviceWorker.register(SITE_BASE + 'sw.js', { scope: SITE_BASE }).catch(() => {});
  });
}
