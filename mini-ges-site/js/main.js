/* MINI GES — interaction & motion layer.
   GSAP + ScrollTrigger for scroll choreography, Lenis for smooth scroll,
   two hand-rolled canvases (hero flow field, project ripples). */
// JS is running: the CSS failsafe that hides the loader is no longer needed
document.documentElement.classList.add('js-on');

// Site root, derived from this script's URL: works for /, /ru/ and sub-path hosting.
const SITE_BASE = (() => {
  const src = document.currentScript && document.currentScript.src;
  return src ? new URL('../', src).href : new URL('./', location.href).href;
})();

// UI strings created by script (static text is localised at build time, see tools/i18n.py)
const LANG = document.documentElement.lang === 'ru' ? 'ru' : 'uz';
const L = {
  uz: {
    tashkent: 'Toshkent', launched: 'Ishga tushirildi', running: 'Ishlab turibdi',
    offline: "Internet yo'q — saqlangan versiya ko'rsatilmoqda", online: 'Internet tiklandi',
    calcAdded: "Hisob-kitob arizaga qo'shildi", copied: 'Nusxalandi: ', copyFail: "Nusxalab bo'lmadi — matnni belgilab oling",
    errWrap: list => `Iltimos, ${list} kiriting.`, errName: 'ismingizni', errPhone: 'telefon raqamingizni (kamida 9 raqam)', errRegion: 'hududni',
    leadHello: "Assalomu alaykum! Mini-GES loyihasi bo'yicha ariza.", fName: 'Ism', fPhone: 'Telefon', fRegion: 'Hudud', fSource: "Yo'nalish", fMsg: 'Izoh',
    calcMsg: (q, h, p, e) => `Kalkulyator: Q = ${q} m³/s, H = ${h} m → taxminan ${p} kVt, ${e} kVt·soat/yil.`,
    uQ: ' m³/s', uH: ' m',
    photos: ["G'ildirakli po'lat zatvor", '400 metrlik beton kanal', 'Ikki gorizontal turbina montaji', "Stansiya binosi va ko'prik krani", 'Stansiya va elektr uzatish liniyasi'],
  },
  ru: {
    tashkent: 'Ташкент', launched: 'Запущена', running: 'Работает',
    offline: 'Нет интернета — показана сохранённая версия', online: 'Интернет восстановлен',
    calcAdded: 'Расчёт добавлен в заявку', copied: 'Скопировано: ', copyFail: 'Не удалось скопировать — выделите текст вручную',
    errWrap: list => `Пожалуйста, укажите ${list}.`, errName: 'имя', errPhone: 'номер телефона (не меньше 9 цифр)', errRegion: 'регион',
    leadHello: 'Здравствуйте! Заявка по проекту мини-ГЭС.', fName: 'Имя', fPhone: 'Телефон', fRegion: 'Регион', fSource: 'Направление', fMsg: 'Комментарий',
    calcMsg: (q, h, p, e) => `Калькулятор: Q = ${q} м³/с, H = ${h} м → примерно ${p} кВт, ${e} кВт·ч/год.`,
    uQ: ' м³/с', uH: ' м',
    photos: ['Стальной колёсный затвор', 'Бетонный канал длиной 400 м', 'Монтаж двух горизонтальных турбин', 'Здание станции и мостовой кран', 'Станция и линия электропередачи'],
  },
}[LANG];

function mainGES() {
  'use strict';

  // ------------------------------------------------------------------ config
  // Baliqchi GES ishga tushish sanasi (oy oxiri, Toshkent vaqti)
  const LAUNCH = new Date('2026-10-31T23:59:59+05:00');
  const CALC = { eff: 0.8, load: 0.9, household: 2200, co2: 0.77 };

  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // slow network / data saver / weak device → keep decorative motion minimal
  const conn = navigator.connection || {};
  const lite = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '') || (navigator.deviceMemory || 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 2;
  const hasGsap = typeof window.gsap !== 'undefined';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n, d = 0) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, ' ');

  let menuOpen = false;
  if (reduced) root.classList.add('reduced');
  if (!hasGsap) { $('#loader')?.remove(); return; }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'expo.out', duration: 1.1 });

  // ------------------------------------------------------------------ smooth scroll
  let lenis = null;
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToEl = (el) => {
    if (!el) return;
    const offset = el.id === 'top' ? 0 : -72;
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.4 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: reduced ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    if (menuOpen) closeMenu();
    scrollToEl(target);
    if (a.classList.contains('skip')) target.focus({ preventScroll: true });
  });

  // ------------------------------------------------------------------ split text
  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = part;
            w.appendChild(wi); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    return $$('.wi', el);
  }
  const splits = new Map();
  $$('[data-split]').forEach(el => splits.set(el, splitWords(el)));

  // ------------------------------------------------------------------ loader → hero intro
  const heroTitle = $('.hero__title');
  const heroFades = $$('[data-hero-fade]');
  const heroIntro = () => {
    const tl = gsap.timeline();
    tl.from(splits.get(heroTitle), { yPercent: 115, rotate: 4, duration: 1.4, stagger: 0.06 }, 0)
      .from(heroFades, { y: 36, autoAlpha: 0, duration: 1.2, stagger: 0.12 }, 0.35)
      .from('.nav__bar > *', { y: -24, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.2)
      .from('.scrollcue', { autoAlpha: 0, duration: 1 }, 0.9);
    return tl;
  };

  const loader = $('#loader');
  if (reduced || !loader) {
    loader?.remove();
  } else {
    document.body.classList.add('is-loading');
    lenis?.stop();
    gsap.set(splits.get(heroTitle), { yPercent: 115 });
    gsap.set(heroFades, { autoAlpha: 0 });
    const fill = $('#loaderFill'), count = $('#loaderCount');
    const prog = { v: 0 };
    const paint = () => { fill.style.clipPath = `inset(${100 - prog.v}% 0 0 0)`; count.textContent = Math.round(prog.v); };
    const climb = gsap.to(prog, { v: 86, duration: 1.3, ease: 'power2.out', onUpdate: paint });
    const ready = Promise.race([
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        new Promise(r => setTimeout(r, 900)),
      ]),
      new Promise(r => setTimeout(r, 2200)),
    ]);
    ready.then(() => {
      climb.kill();
      gsap.timeline()
        .to(prog, { v: 100, duration: 0.45, ease: 'power2.inOut', onUpdate: paint })
        .to('.loader__inner', { y: -30, autoAlpha: 0, duration: 0.6, ease: 'power3.in' }, '+=0.1')
        .to('.loader__curtain', { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '-=0.25')
        .to(loader, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '-=0.55')
        .add(() => {
          document.body.classList.remove('is-loading');
          lenis?.start();
          gsap.set(splits.get(heroTitle), { clearProps: 'all' });
          gsap.set(heroFades, { clearProps: 'all' });
          heroIntro();
        }, '-=0.7')
        .add(() => { loader.remove(); ScrollTrigger.refresh(); });
    });
  }

  // ------------------------------------------------------------------ hero flow field
  (function flowField() {
    const cvs = $('#flow');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    let w = 0, h = 0, dpr = 1, parts = [], running = true, t = 0;
    const mouse = { x: -9999, y: -9999 };
    const COLORS = ['70,198,247', '0,160,227', '160,220,255'];

    const make = (anyX) => ({
      x: anyX ? Math.random() * w : -20 - Math.random() * 80,
      y: Math.random() * h,
      s: 0.6 + Math.random() * 1.6,
      life: 200 + Math.random() * 400,
      c: Math.random() < 0.07 ? 'volt' : COLORS[(Math.random() * COLORS.length) | 0],
    });
    const resize = () => {
      dpr = lite ? 1 : Math.min(window.devicePixelRatio || 1, 1.6);
      w = cvs.clientWidth; h = cvs.clientHeight;
      cvs.width = w * dpr; cvs.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(lite ? 300 : 900, Math.round((w * h) / (lite ? 3000 : 1500)));
      parts = Array.from({ length: n }, () => make(true));
    };
    const field = (x, y) => 0.55 * Math.sin(y * 0.0042 + x * 0.0016 + t * 0.0006) + 0.35 * Math.cos(x * 0.0031 - t * 0.0004) + 0.18 * Math.sin((x + y) * 0.009);

    const step = () => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.075)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        const a = field(p.x, p.y);
        let vx = Math.cos(a) * p.s * 1.5, vy = Math.sin(a) * p.s * 1.1;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 22000) { const f = (1 - d2 / 22000) * 3.2; const d = Math.sqrt(d2) || 1; vx += (dx / d) * f; vy += (dy / d) * f; }
        const nx = p.x + vx, ny = p.y + vy;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny);
        if (p.c === 'volt') { ctx.strokeStyle = 'rgba(74,247,69,0.9)'; ctx.lineWidth = 1.8; }
        else { ctx.strokeStyle = `rgba(${p.c},${0.18 + p.s * 0.16})`; ctx.lineWidth = 1; }
        ctx.stroke();
        p.x = nx; p.y = ny; p.life--;
        if (p.x > w + 20 || p.y < -20 || p.y > h + 20 || p.life < 0) Object.assign(p, make(p.life < 0));
      }
      t += 16;
    };
    const loop = () => { if (running) step(); requestAnimationFrame(loop); };

    resize();
    window.addEventListener('resize', () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 150); });
    if (reduced) { for (let i = 0; i < 160; i++) step(); return; }
    const hero = $('#hero');
    hero.addEventListener('pointermove', (e) => { const r = cvs.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    new IntersectionObserver(([en]) => { running = en.isIntersecting && !document.hidden; }).observe(cvs);
    document.addEventListener('visibilitychange', () => { running = !document.hidden; });
    loop();
  })();

  // hero parallax out
  gsap.to('.hero__grid', { yPercent: -18, autoAlpha: 0.25, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });

  // ------------------------------------------------------------------ clock, live wave, countdown
  const clock = $('#clock');
  const tashkent = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const pad = n => String(n).padStart(2, '0');
  const countdowns = $$('[data-countdown]');
  const tick = () => {
    if (clock) clock.textContent = L.tashkent + ' ' + tashkent.format(new Date());
    const diff = LAUNCH - Date.now();
    if (diff <= 0) {
      countdowns.forEach(c => { c.innerHTML = `<span class="mono">${L.launched}</span>`; });
      $$('.pill--build').forEach(p => { p.className = p.className.replace('pill--build', 'pill--live'); p.lastChild.textContent = L.running; });
      return false;
    }
    const s = Math.floor(diff / 1000);
    const parts = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
    countdowns.forEach(c => $$('[data-cd]', c).forEach(b => { b.textContent = pad(parts[b.dataset.cd]); }));
    return true;
  };
  tick();
  setInterval(tick, 1000);

  const wave = $('#liveWave');
  if (wave) {
    let ph = 0;
    const drawWave = () => {
      let d = '';
      for (let x = 0; x <= 120; x += 4) {
        const y = 16 + Math.sin(x * 0.12 + ph) * 6 + Math.sin(x * 0.31 + ph * 1.7) * 2.5;
        d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
      }
      wave.setAttribute('d', d);
      ph += 0.06;
    };
    drawWave();
    if (!reduced) {
      let on = false;
      new IntersectionObserver(([e]) => { if (e.isIntersecting !== on) { on = e.isIntersecting; on ? gsap.ticker.add(drawWave) : gsap.ticker.remove(drawWave); } }).observe(wave);
    }
  }

  // ------------------------------------------------------------------ live energy counter (Ulug'nor GES)
  // Estimate from the station's real annual output (5.2 GWh) since launch in September 2024.
  const LIVE = { start: Date.parse('2024-09-01T00:00:00+05:00'), perSec: 5.2e6 / (365.25 * 86400), co2: 4700 / 5.2e6, coal: 2000 / 5.2e6 };
  const liveKwh = $$('[data-live-kwh]'), liveCo2 = $$('[data-live-co2]'), liveCoal = $$('[data-live-coal]');
  const tickLive = (force) => {
    if (document.hidden && force !== true) return;   // no work in background tabs
    const kwh = (Date.now() - LIVE.start) / 1000 * LIVE.perSec;
    const whole = fmt(Math.floor(kwh)), frac = Math.floor((kwh % 1) * 10);
    liveKwh.forEach(el => { el.innerHTML = `${whole}<small>,${frac}</small>`; });
    liveCo2.forEach(el => { el.textContent = fmt(kwh * LIVE.co2); });
    liveCoal.forEach(el => { el.textContent = fmt(kwh * LIVE.coal); });
  };
  if (liveKwh.length) { tickLive(true); setInterval(tickLive, reduced ? 5000 : 200); }

  // ------------------------------------------------------------------ marquee: scroll velocity
  const marquee = $('#marquee');
  if (marquee && !reduced && marquee.getAnimations) {
    const anim = marquee.getAnimations()[0];
    const skew = gsap.quickTo(marquee, 'skewX', { duration: 0.5, ease: 'power3' });
    ScrollTrigger.create({
      onUpdate: (self) => {
        const v = self.getVelocity();
        skew(clamp(v / -260, -8, 8));
        if (anim) anim.playbackRate = (self.direction < 0 ? -1 : 1) * (1 + Math.min(Math.abs(v) / 500, 5));
        clearTimeout(marquee._t);
        marquee._t = setTimeout(() => { skew(0); if (anim) gsap.to(anim, { playbackRate: self.direction < 0 ? -1 : 1, duration: 0.8 }); }, 120);
      },
    });
  }

  // ------------------------------------------------------------------ generic reveals
  const mm = gsap.matchMedia();
  if (!reduced) {
    splits.forEach((words, el) => {
      if (el === heroTitle) return;
      gsap.from(words, { yPercent: 115, rotate: 3, duration: 1.3, stagger: 0.045, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%', once: true,
      onEnter: els => gsap.fromTo(els, { y: 48, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, stagger: 0.09, overwrite: true }),
    });
    // hide before they enter — only for elements still below the fold
    $$('[data-reveal]').forEach(el => { if (el.getBoundingClientRect().top > window.innerHeight) gsap.set(el, { autoAlpha: 0 }); });
  }

  // manifesto: words light up as you read
  const manifesto = $('#manifesto');
  if (manifesto) {
    const words = splitWords(manifesto);
    words.forEach(w => w.classList.add('mw'));
    if (!reduced) {
      gsap.fromTo(words, { color: '#C2CEDF' }, {
        color: '#0B1B33', ease: 'none', stagger: 0.12,
        scrollTrigger: { trigger: manifesto, start: 'top 78%', end: 'bottom 45%', scrub: 0.6 },
      });
      // accent words
      words.filter(w => /^(elektr|yoqilg'i|kalit)/i.test(w.textContent)).forEach(w => {
        gsap.to(w, { color: '#004AAD', ease: 'none', scrollTrigger: { trigger: w, start: 'top 60%', end: 'top 55%', scrub: true } });
      });
    }
  }

  // counters
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count, dec = +(el.dataset.dec || 0);
    const o = { v: 0 };
    if (reduced) return;
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.fromTo(o, { v: 0 }, { v: end, duration: end > 5 ? 2 : 1.2, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v, dec); } }),
    });
  });
  // eco bars grow in
  if (!reduced) $$('.eco__bar').forEach(bar => gsap.from($$('i', bar), { scaleX: 0, duration: 1.4, stagger: 0.15, ease: 'power3.out', scrollTrigger: { trigger: bar, start: 'top 90%', once: true } }));

  // ------------------------------------------------------------------ how it works (isometric model)
  const dia = $('#dia');
  const diaStep = $('#diaStep');
  const hsteps = $$('.hstep');
  const PHOTOS = ['assets/gallery/ges-05-sm.webp', 'assets/timeline/tl-10-sm.webp', 'assets/gallery/ges-07-sm.webp',
    'assets/gallery/ges-10-sm.webp', 'assets/how/how-5.webp'].map((src, i) => [SITE_BASE + src, L.photos[i]]);
  let currentStep = 0, camKey = '0';
  if (dia) {
    const cams = JSON.parse(dia.dataset.cams);
    // label scale: keep annotation text ~12px on screen whatever the camera zoom
    const kFor = vb => (+vb.split(' ')[2] / Math.max(dia.clientWidth, 1)).toFixed(3);
    const fill = $('#dvClipRect');
    const photo = $('#diaPhoto'), pimgs = $$('img', photo), pcap = $('#diaPhotoCap');
    let front = 0;
    // Cameras are authored for a 1000x640 frame. On a taller frame (phones) close-ups are
    // cropped at the sides so the subject gets bigger; the overview is expanded instead.
    const fit = (key) => {
      const [x, y, w, h] = cams[key].split(' ').map(Number);
      const a = dia.clientWidth / Math.max(dia.clientHeight, 1);
      if (!a || Math.abs(a - w / h) < 0.01) return cams[key];
      if (a < w / h && key !== '0') { const w2 = h * a; return `${x + (w - w2) / 2} ${y} ${w2} ${h}`; }
      if (a < w / h) { const h2 = w / a; return `${x} ${y - (h2 - h) / 2} ${w} ${h2}`; }
      const h2 = w / a; return `${x} ${y + (h - h2) / 2} ${w} ${h2}`;
    };
    const applyCam = (key, d) => {
      const vb = fit(key);
      gsap.to(dia, { attr: { viewBox: vb }, '--k': kFor(vb), duration: d, ease: 'power3.inOut', overwrite: 'auto' });
    };
    applyCam('0', 0);
    let rz;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => applyCam(camKey, 0), 150); });

    const camTo = (key) => {
      if (key === camKey || !cams[key]) return;
      camKey = key;
      applyCam(key, reduced ? 0 : 1.7);
    };
    const diaName = $('#diaName');
    const showPhoto = (n) => {
      const [src, cap] = PHOTOS[n - 1] || [];
      if (!src || new URL(pimgs[front].dataset.src || '', location.href).href === src) return;
      const back = pimgs[1 - front];
      const swap = () => { back.classList.remove('is-out'); pimgs[front].classList.add('is-out'); front = 1 - front; };
      back.alt = cap; back.dataset.src = src; pcap.textContent = cap;
      if (back.getAttribute('src') === src && back.complete) swap();
      else { back.onload = swap; back.src = src; }
      if (PHOTOS[n]) new Image().src = PHOTOS[n][0];
    };
    const setStep = (n) => {
      if (n === currentStep) return;
      const prev = currentStep;
      currentStep = n;
      for (let i = 1; i <= 5; i++) dia.classList.toggle('on-' + i, i <= n);
      dia.dataset.step = n;
      hsteps.forEach(s => s.classList.toggle('is-active', +s.dataset.step === n));
      diaStep.textContent = pad(n) + ' / 05';
      const h = $('h3', hsteps[n - 1]);
      if (diaName && h) diaName.textContent = h.textContent;
      gsap.fromTo(diaStep, { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5 });
      gsap.to(fill, { attr: { width: n >= 2 ? 600 : 0 }, duration: reduced ? 0 : (n >= 2 && prev < 2 ? 2.6 : 0.9), ease: 'power2.inOut', overwrite: true });
      showPhoto(n);
    };
    const go = (n) => { setStep(n); camTo(String(n)); };

    setStep(1);                       // at rest: model readable, camera on the whole scene
    hsteps.forEach((s) => {
      ScrollTrigger.create({
        trigger: s, start: 'top 62%', end: 'bottom 62%',
        onEnter: () => go(+s.dataset.step),
        onEnterBack: () => go(+s.dataset.step),
      });
    });
    ScrollTrigger.create({ trigger: '#howSteps', start: 'top 62%', onLeaveBack: () => camTo('0') });
    gsap.to('#diaBar', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '#howSteps', start: 'top 62%', end: 'bottom 62%', scrub: true } });
    if (reduced) { for (let i = 1; i <= 5; i++) dia.classList.add('on-' + i); fill.setAttribute('width', 600); }
  }

  // ------------------------------------------------------------------ project ripples
  $$('canvas.ripple').forEach((cvs) => {
    const ctx = cvs.getContext('2d');
    const [c1, c2] = cvs.dataset.ripple.split(',');
    let w, h, rings = [], bubbles = [], last = 0, on = false;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      w = cvs.clientWidth; h = cvs.clientHeight;
      cvs.width = w * dpr; cvs.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
    const frame = (ts) => {
      if (on) {
        if (ts - last > 1300) { rings.push({ r: 20, c: rings.length % 2 ? c2 : c1 }); last = ts; }
        if (Math.random() < 0.25) bubbles.push({ x: Math.random() * w, y: h + 6, r: 1 + Math.random() * 2.4, v: 0.3 + Math.random() * 0.9 });
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2 + 10, max = Math.hypot(w, h) * 0.6;
        rings = rings.filter(rg => rg.r < max);
        for (const rg of rings) {
          rg.r += 0.9;
          ctx.beginPath(); ctx.ellipse(cx, cy, rg.r, rg.r * 0.42, 0, 0, Math.PI * 2);
          ctx.strokeStyle = hexA(rg.c, 0.55 * (1 - rg.r / max)); ctx.lineWidth = 1.6; ctx.stroke();
        }
        bubbles = bubbles.filter(b => b.y > -10);
        for (const b of bubbles) {
          b.y -= b.v; b.x += Math.sin(b.y * 0.03) * 0.3;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
        }
      }
      requestAnimationFrame(frame);
    };
    resize();
    window.addEventListener('resize', resize);
    new IntersectionObserver(([e]) => { on = e.isIntersecting && !reduced; }).observe(cvs);
    requestAnimationFrame(frame);
  });

  mm.add('(min-width: 901px)', () => {
    const cards = $$('[data-pcard]');
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (next) {
        gsap.fromTo(card, { scale: 1, filter: 'brightness(1)' }, { scale: 0.93, filter: 'brightness(0.82)', ease: 'none', scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 120px', scrub: true } });
      }
      gsap.fromTo($('.pcard__logo', card), { y: 40 }, { y: -40, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  });
  // phones: no sticky stack, so each card grows into place and its logo floats
  mm.add('(max-width: 900px)', () => {
    if (reduced) return;
    $$('[data-pcard]').forEach((card) => {
      gsap.fromTo(card, { scale: 0.9, y: 50, autoAlpha: 0.35 }, { scale: 1, y: 0, autoAlpha: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 98%', end: 'top 50%', scrub: 0.6 } });
      gsap.fromTo($('.pcard__logo', card), { y: 26, scale: 0.9 }, { y: -26, scale: 1.05, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  });

  // ------------------------------------------------------------------ gallery
  const galTrack = $('#galTrack'), galVp = $('#galVp'), galBar = $('#galBar'), galNow = $('#galNow');
  const galItems = $$('.gph');
  const setGal = (prog) => {
    gsap.set(galBar, { scaleX: clamp(prog, 0, 1) });
    galNow.textContent = pad(Math.round(clamp(prog, 0, 1) * (galItems.length - 1)) + 1);
  };
  if (galTrack) {
    mm.add('(min-width: 901px)', () => {
      if (reduced) return;
      const dist = () => Math.max(0, galTrack.scrollWidth - galVp.clientWidth);
      const tween = gsap.to(galTrack, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: '.gallery__pin', start: 'top top', end: () => '+=' + dist(),
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: self => setGal(self.progress),
        },
      });
      $$('.gph__img img', galTrack).forEach((img) => {
        gsap.fromTo(img, { xPercent: -6 }, {
          xPercent: 6, ease: 'none',
          scrollTrigger: { trigger: img.closest('.gph'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        });
      });
      gsap.from(galItems, { y: 80, autoAlpha: 0, duration: 1.2, stagger: 0.08, scrollTrigger: { trigger: '.gallery__pin', start: 'top 70%', once: true } });
    });
    mm.add('(max-width: 900px)', () => {
      const onS = () => {
        setGal(galVp.scrollLeft / Math.max(1, galVp.scrollWidth - galVp.clientWidth));
        if (galVp.scrollLeft > 30) $('#galHint')?.classList.add('is-done');
      };
      galVp.addEventListener('scroll', onS, { passive: true });
      // one gentle nudge the first time the strip is seen, so people know it swipes
      if (!reduced) {
        const io = new IntersectionObserver(([e]) => {
          if (!e.isIntersecting) return;
          io.disconnect();
          const o = { x: 0 };
          const to = () => galVp.scrollTo({ left: o.x, behavior: 'instant' });
          galVp.style.scrollSnapType = 'none';      // snapping would cancel the nudge
          gsap.timeline({ delay: 0.5, onComplete: () => { galVp.style.scrollSnapType = ''; } })
            .to(o, { x: 90, duration: 0.7, ease: 'power2.out', onUpdate: to })
            .to(o, { x: 0, duration: 0.9, ease: 'power3.inOut', onUpdate: to });
        }, { threshold: 0.6 });
        io.observe(galVp);
      }
      return () => galVp.removeEventListener('scroll', onS);
    });

    // lightbox
    const lb = $('#lb'), lbImg = $('#lbImg'), lbCap = $('#lbCap'), lbCount = $('#lbCount');
    const shots = galItems.map(f => { const im = $('img', f); return { src: im.getAttribute('src'), alt: im.alt }; });
    let cur = 0, lastFocus = null;
    const preload = i => { const im = new Image(); im.src = shots[(i + shots.length) % shots.length].src; };
    const paint = (i) => {
      cur = (i + shots.length) % shots.length;
      lbImg.src = shots[cur].src; lbImg.alt = shots[cur].alt;
      lbCap.textContent = shots[cur].alt;
      lbCount.textContent = pad(cur + 1) + ' / ' + pad(shots.length);
      preload(cur + 1); preload(cur - 1);
    };
    const go = (dir) => {
      gsap.to(lbImg, { x: -dir * 50, autoAlpha: 0, duration: 0.22, ease: 'power2.in', onComplete: () => {
        paint(cur + dir);
        gsap.fromTo(lbImg, { x: dir * 50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
      } });
    };
    const openLb = (i) => {
      lastFocus = document.activeElement;
      paint(i); lb.hidden = false; lenis?.stop();
      gsap.fromTo(lb, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power2.out' });
      gsap.fromTo(lbImg, { scale: 0.92, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.7, ease: 'expo.out' });
      $('#lbClose').focus({ preventScroll: true });
    };
    const closeLb = () => {
      gsap.to(lb, { autoAlpha: 0, duration: 0.3, onComplete: () => { lb.hidden = true; lenis?.start(); lastFocus?.focus({ preventScroll: true }); } });
    };
    $$('.gph__btn').forEach(b => b.addEventListener('click', () => openLb(+b.dataset.i)));
    $('#lbClose').addEventListener('click', closeLb);
    $('#lbPrev').addEventListener('click', () => go(-1));
    $('#lbNext').addEventListener('click', () => go(1));
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.id === 'lbStage') closeLb(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });
    let sx = null;
    $('#lbStage').addEventListener('pointerdown', (e) => { sx = e.clientX; });
    $('#lbStage').addEventListener('pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); });
  }

  // progress bar
  $$('[data-progress-bar]').forEach((bar) => {
    const num = $('[data-progress]', bar.closest('.progress'));
    const end = +num.dataset.progress;
    const o = { v: 0 };
    gsap.set(bar, { scaleX: 0 });
    ScrollTrigger.create({
      trigger: bar, start: 'top 92%', once: true,
      onEnter: () => {
        gsap.to(bar, { scaleX: 1, duration: 2, ease: 'power3.out' });
        gsap.to(o, { v: end, duration: 2, ease: 'power3.out', onUpdate: () => { num.textContent = Math.round(o.v); } });
      },
    });
  });

  // ------------------------------------------------------------------ services: spotlight + tilt
  $$('.svc').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
  if (finePointer && !reduced) {
    $$('[data-tilt]').forEach((el) => {
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
      gsap.set(el, { transformPerspective: 1200 });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 7);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 7);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  // ------------------------------------------------------------------ timeline
  const tlFill = $('#tlFill');
  if (tlFill) {
    gsap.to(tlFill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#timeline', start: 'top 65%', end: 'bottom 65%', scrub: true } });
    $$('.tl__item').forEach((it) => {
      ScrollTrigger.create({ trigger: it, start: 'top 65%', onToggle: self => it.classList.toggle('is-on', self.isActive || self.progress === 1), end: 'max' });
    });
  }

  // ------------------------------------------------------------------ chronicle
  const chronFill = $('#chronFill');
  if (chronFill) {
    gsap.to(chronFill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#chron', start: 'top 70%', end: 'bottom 70%', scrub: true } });
    $$('.ci').forEach(it => ScrollTrigger.create({ trigger: it, start: 'top 72%', end: 'max', onToggle: self => it.classList.toggle('is-on', self.isActive) }));
  }

  // ------------------------------------------------------------------ calculator
  const inQ = $('#inQ'), inH = $('#inH'), inT = $('#inT');
  const out = { P: $('#rP'), E: $('#rE'), R: $('#rR'), Hh: $('#rHh'), C: $('#rC') };
  const arc = $('#gaugeArc');
  const PMAX = 9.81 * 10 * 30 * CALC.eff;
  const shown = { P: 0, E: 0, R: 0, Hh: 0, C: 0 };
  let lastCalc = null;

  // gauge ticks
  const ticks = $('#gaugeTicks');
  if (ticks) {
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI - (i / 10) * Math.PI;
      const r1 = 108, r2 = i % 5 === 0 ? 118 : 114;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', (120 + Math.cos(a) * r1).toFixed(1)); l.setAttribute('y1', (130 - Math.sin(a) * r1).toFixed(1));
      l.setAttribute('x2', (120 + Math.cos(a) * r2).toFixed(1)); l.setAttribute('y2', (130 - Math.sin(a) * r2).toFixed(1));
      ticks.appendChild(l);
    }
  }
  const fillRange = (el) => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');

  function calc(animate = true) {
    const Q = +inQ.value, H = +inH.value, T = Math.max(0, +inT.value || 0);
    const P = 9.81 * Q * H * CALC.eff;
    const E = P * 8760 * CALC.load;
    const target = { P, E, R: (E * T) / 1e6, Hh: E / CALC.household, C: (E * CALC.co2) / 1000 };
    lastCalc = { Q, H, ...target };
    $('#outQ').textContent = fmt(Q, 1) + L.uQ;
    $('#outH').textContent = fmt(H, H % 1 ? 1 : 0) + L.uH;
    fillRange(inQ); fillRange(inH);
    gsap.to(shown, { ...target, duration: animate ? 0.9 : 0, ease: 'power3.out', overwrite: true, onUpdate: renderCalc });
    gsap.to(arc, { attr: { 'stroke-dashoffset': 1 - Math.sqrt(clamp(P / PMAX, 0, 1)) }, duration: animate ? 1 : 0, ease: 'power3.out', overwrite: true });
    if (!animate) { Object.assign(shown, target); renderCalc(); }
  }
  function renderCalc() {
    out.P.textContent = fmt(shown.P, shown.P < 100 ? 1 : 0);
    out.E.textContent = fmt(shown.E);
    out.R.textContent = fmt(shown.R, shown.R < 100 ? 1 : 0);
    out.Hh.textContent = fmt(shown.Hh);
    out.C.textContent = fmt(shown.C, shown.C < 100 ? 1 : 0);
  }
  if (inQ) {
    [inQ, inH, inT].forEach(el => el.addEventListener('input', () => calc()));
    const tariffBtns = $$('.tariff');
    const syncTariff = () => tariffBtns.forEach(b => b.classList.toggle('is-on', +b.dataset.t === +inT.value));
    tariffBtns.forEach(b => b.addEventListener('click', () => { inT.value = b.dataset.t; syncTariff(); calc(); }));
    inT.addEventListener('input', syncTariff);
    calc(false);
    // first look: numbers stay visible at rest, then sweep up from zero when the section arrives
    if (!reduced) {
      ScrollTrigger.create({
        trigger: '.calc__out', start: 'top 80%', once: true,
        onEnter: () => { Object.keys(shown).forEach(k => { shown[k] = 0; }); gsap.set(arc, { attr: { 'stroke-dashoffset': 1 } }); calc(true); },
      });
    }
    $('#calcSend').addEventListener('click', () => {
      const c = lastCalc;
      $('#fMsg').value = L.calcMsg(fmt(c.Q, 1), fmt(c.H, 1), fmt(c.P), fmt(c.E));
      scrollToEl($('#contact'));
      setTimeout(() => $('#fName').focus({ preventScroll: true }), 1200);
      toast(L.calcAdded);
    });
  }

  // ------------------------------------------------------------------ FAQ accordion
  $$('.acc__item').forEach((d) => {
    const sum = $('summary', d), body = $('.acc__body', d);
    sum.addEventListener('click', (e) => {
      e.preventDefault();
      if (d.open) {
        gsap.to(body, { height: 0, duration: 0.5, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height' }); } });
      } else {
        d.open = true;
        gsap.fromTo(body, { height: 0 }, { height: body.scrollHeight, duration: 0.6, ease: 'power3.out', onComplete: () => gsap.set(body, { clearProps: 'height' }) });
        gsap.fromTo($('p', body), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, delay: 0.1 });
      }
    });
  });

  // ------------------------------------------------------------------ business card
  $$('.vcard').forEach((vcard) => {
    const flip = () => vcard.classList.toggle('is-flipped');
    vcard.addEventListener('click', flip);
    vcard.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    if (finePointer && !reduced) {
      const rx = gsap.quickTo(vcard, 'rotationX', { duration: 0.7, ease: 'power3' });
      const ry = gsap.quickTo(vcard, 'rotationY', { duration: 0.7, ease: 'power3' });
      gsap.set(vcard, { transformPerspective: 900 });
      vcard.addEventListener('pointermove', (e) => {
        const r = vcard.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * 16); rx(-py * 16);
        vcard.style.setProperty('--shine', `${px * 120}%`);
      });
      vcard.addEventListener('pointerleave', () => { rx(0); ry(0); vcard.style.setProperty('--shine', '-60%'); });
    }
  });
  if (!reduced && $('.team')) gsap.from('.vcard', { y: 80, rotationX: 30, autoAlpha: 0, duration: 1.4, stagger: 0.15, scrollTrigger: { trigger: '.team', start: 'top 88%', once: true } });

  // ------------------------------------------------------------------ connectivity notice
  window.addEventListener('offline', () => toast(L.offline));
  window.addEventListener('online', () => toast(L.online));

  // ------------------------------------------------------------------ copy + toast
  const toastEl = $('#toast');
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
    return Promise.resolve(false);
  }
  $$('[data-copy]').forEach((b) => {
    b.addEventListener('click', () => {
      copyText(b.dataset.copy).then(ok => toast(ok ? L.copied + b.dataset.copy : L.copyFail));
    });
  });

  // ------------------------------------------------------------------ lead form
  const form = $('#leadForm');
  if (form) {
    const err = $('#leadErr'), ok = $('#leadOk'), txt = $('#leadText');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#fName').value.trim();
      const phone = $('#fPhone').value.trim();
      const region = $('#fRegion').value;
      const source = (form.querySelector('input[name="source"]:checked') || {}).value || '';
      const msg = $('#fMsg').value.trim();
      $$('.fl', form).forEach(f => f.classList.remove('is-bad'));
      const problems = [];
      if (name.length < 2) { problems.push(L.errName); $('#fName').parentElement.classList.add('is-bad'); }
      if (phone.replace(/\D/g, '').length < 9) { problems.push(L.errPhone); $('#fPhone').parentElement.classList.add('is-bad'); }
      if (!region) { problems.push(L.errRegion); $('#fRegion').parentElement.classList.add('is-bad'); }
      if (problems.length) {
        err.textContent = L.errWrap(problems.join(', '));
        err.hidden = false;
        gsap.fromTo(err, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, .3)' });
        return;
      }
      err.hidden = true;
      const text = [
        L.leadHello,
        `${L.fName}: ${name}`,
        `${L.fPhone}: ${phone}`,
        `${L.fRegion}: ${region}`,
        `${L.fSource}: ${source}`,
        msg ? `${L.fMsg}: ${msg}` : null,
      ].filter(Boolean).join('\n');
      txt.textContent = text;
      const tg = 'https://t.me/ozodbekov?text=' + encodeURIComponent(text);
      $('#leadTg').href = tg;
      window.open(tg, '_blank', 'noopener');
      ok.hidden = false;
      gsap.fromTo(ok, { clipPath: 'circle(0% at 50% 100%)' }, { clipPath: 'circle(150% at 50% 100%)', duration: 1, ease: 'power3.inOut' });
      gsap.from($$('h3, p, pre, .lead__ok-ctas', ok), { y: 20, autoAlpha: 0, stagger: 0.08, delay: 0.4, duration: 0.8 });
    });
    $('#leadBack').addEventListener('click', () => {
      gsap.to(ok, { clipPath: 'circle(0% at 50% 100%)', duration: 0.7, ease: 'power3.inOut', onComplete: () => { ok.hidden = true; } });
    });
  }

  // ------------------------------------------------------------------ nav
  const nav = $('#nav');
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-solid', y > 40);
    if (!menuOpen) nav.classList.toggle('is-hidden', y > 500 && y > lastY + 2);
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navLinks = $$('.nav__links a');
  navLinks.forEach((a) => {
    const sec = document.getElementById(a.getAttribute('href').slice(1));
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: self => a.classList.toggle('is-active', self.isActive) });
  });

  // mobile menu
  const burger = $('#burger'), menu = $('#mobileMenu');
  function openMenu() {
    menuOpen = true; menu.hidden = false; burger.setAttribute('aria-expanded', 'true'); lenis?.stop();
    gsap.timeline()
      .to(menu, { clipPath: 'circle(150% at calc(100% - 40px) 40px)', duration: 0.9, ease: 'expo.inOut' })
      .fromTo($$('.mmenu__links a', menu), { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.06, duration: 0.8 }, 0.35)
      .fromTo('.mmenu__foot', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.6);
  }
  function closeMenu() {
    menuOpen = false; burger.setAttribute('aria-expanded', 'false'); lenis?.start();
    gsap.to(menu, { clipPath: 'circle(0% at calc(100% - 40px) 40px)', duration: 0.7, ease: 'expo.inOut', onComplete: () => { menu.hidden = true; } });
  }
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) closeMenu(); });

  // ------------------------------------------------------------------ cursor + magnetic
  if (finePointer && !reduced) {
    root.classList.add('has-cursor');
    const cur = $('#cursor'), dot = $('.cursor__dot', cur), ring = $('.cursor__ring', cur), label = $('#cursorLabel');
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' }), dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button, summary, label, input[type="range"]');
      cur.classList.toggle('is-link', !!t && !t.dataset.cursor);
      cur.classList.toggle('is-label', !!t && !!t.dataset.cursor);
      label.textContent = t && t.dataset.cursor ? t.dataset.cursor : '';
    });
    document.addEventListener('pointerleave', () => gsap.to(cur, { autoAlpha: 0, duration: 0.3 }));
    document.addEventListener('pointerenter', () => gsap.to(cur, { autoAlpha: 1, duration: 0.3 }));

    $$('.magnetic').forEach((el) => {
      const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' }), my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      const inner = el.querySelector('span');
      const ix = inner && gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'power3' }), iy = inner && gsap.quickTo(inner, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        mx(x * 0.28); my(y * 0.38);
        if (inner) { ix(x * 0.12); iy(y * 0.16); }
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, .35)' });
        if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, .35)' });
      });
    });
  }

  // footer wordmark
  if (!reduced) gsap.from('.foot__big', { yPercent: 40, autoAlpha: 0, duration: 1.6, scrollTrigger: { trigger: '.foot', start: 'top 90%', once: true } });

  if (document.readyState === 'complete') ScrollTrigger.refresh();
  else window.addEventListener('load', () => ScrollTrigger.refresh());
}

// Offline copy: registered only on built pages (versioned main.js), never during local editing.
if ('serviceWorker' in navigator && document.querySelector('script[src*="main.js?v="]')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SITE_BASE + 'sw.js', { scope: SITE_BASE }).catch(() => {});
  });
}

// Boot once the animation libraries are present. Some hosts inject external
// scripts asynchronously, so never assume they ran before this file.
(function boot(tries) {
  if ((window.gsap && window.ScrollTrigger && (window.Lenis || tries > 20)) || tries > 120) mainGES();
  else setTimeout(() => boot(tries + 1), 50);
})(0);
