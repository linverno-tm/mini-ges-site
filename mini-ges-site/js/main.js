/* MINI GES — interaction & motion layer.
   GSAP + ScrollTrigger for scroll choreography, Lenis for smooth scroll,
   two hand-rolled canvases (hero power-grid scene, project ripples). */
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

  // ------------------------------------------------------------------ hero: power grid scene
  // A transmission line comes in from the horizon, passes a substation and leaves toward the
  // viewer. Current pulses travel the conductors; now and then a short-circuit arc flashes.
  // Static geometry is painted once into two offscreen layers (far / near) for cheap parallax.
  (function powerGrid() {
    const cvs = $('#flow');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const far = document.createElement('canvas'), near = document.createElement('canvas'), glow = document.createElement('canvas');
    const fctx = far.getContext('2d'), nctx = near.getContext('2d'), gctx = glow.getContext('2d');
    let W = 0, H = 0, dpr = 1, running = true, routes = [], arcs = [], pulses = [], sparks = [];
    let VPX = 0, VPY = 0, F = 1, CAMH = 6, arc = null, nextArc = 0, ready = false;
    const px = { x: 0, y: 0, tx: 0, ty: 0 };
    const SKY = '70,198,247', VOLT = '74,247,69';

    // world (X right, Y up, Z depth) -> screen
    const P = (X, Y, Z) => [VPX + (X * F) / Z, VPY + ((CAMH - Y) * F) / Z];
    let AL = 30, LW = 1;                 // depth brightness and stroke scale, set per composition in build()
    const depthAlpha = Z => Math.max(0.1, Math.min(0.85, AL / Z));
    // atmospheric perspective: distant steel turns deep blue, near steel is pale cyan
    const steel = (Z) => { const t = Math.max(0, Math.min(1, (Z - 30) / 220)); return `${Math.round(150 - 90 * t)},${Math.round(215 - 60 * t)},${Math.round(250 - 10 * t)}`; };
    let curZ = 40;

    function line(c, a, b, alpha, width) {
      c.strokeStyle = `rgba(${steel(curZ)},${alpha})`; c.lineWidth = width;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }

    // lattice pylon; returns the three conductor attach points
    function pylon(c, X, Z) {
      curZ = Z;
      const al = depthAlpha(Z), lw = Math.max(0.6, 26 / Z) * LW;
      const b1 = P(X - 3, 0, Z), b2 = P(X + 3, 0, Z), t1 = P(X - 0.8, 21, Z), t2 = P(X + 0.8, 21, Z);
      line(c, b1, t1, al, lw); line(c, b2, t2, al, lw);
      for (let y = 3; y < 19; y += 4) {                      // cross bracing
        const k1 = 3 - 2.2 * (y / 21), k2 = 3 - 2.2 * ((y + 4) / 21);
        line(c, P(X - k1, y, Z), P(X + k2, y + 4, Z), al * 0.7, lw * 0.7);
        line(c, P(X + k1, y, Z), P(X - k2, y + 4, Z), al * 0.7, lw * 0.7);
      }
      line(c, P(X - 6, 16, Z), P(X + 6, 16, Z), al, lw);      // cross arms
      line(c, P(X - 4, 20, Z), P(X + 4, 20, Z), al, lw);
      const att = [[X - 5.6, 14.6], [X + 5.6, 14.6], [X + 3.6, 18.6]];
      att.forEach(([ax, ay]) => {                            // insulator strings
        const top = P(ax, ay === 14.6 ? 16 : 20, Z), bot = P(ax, ay, Z);
        line(c, top, bot, al, lw * 0.8);
        c.fillStyle = `rgba(${SKY},${al})`;
        for (let i = 1; i <= 3; i++) {
          const yy = top[1] + ((bot[1] - top[1]) * i) / 4;
          c.fillRect(top[0] - lw * 1.4, yy - lw * 0.3, lw * 2.8, lw * 0.6);
        }
      });
      return att.map(([ax, ay]) => [ax, ay, Z]);
    }

    // conductor between two world points, sagging; returns screen polyline
    function span(a, b, steps = 18) {
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, sag = 1.6 * 4 * t * (1 - t);
        pts.push(P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t));
      }
      return pts;
    }
    const strokePoly = (c, pts, alpha, width) => {
      c.strokeStyle = `rgba(${SKY},${alpha})`; c.lineWidth = width * LW;
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
    };

    // substation in elevation at depth Z, centred on X; returns busbar, entry/exit points and arc sites
    function substation(c, CX, Z) {
      curZ = Z;
      const al = 0.8, lw = Math.max(0.8, 34 / Z) * LW, k = F / Z;
      const L = CX - 11, R = CX + 11;
      // fence
      line(c, P(L - 2, 1.8, Z - 4), P(R + 2, 1.8, Z - 4), 0.25, lw * 0.6);
      for (let x = L - 2; x <= R + 2; x += 2.2) line(c, P(x, 0, Z - 4), P(x, 1.8, Z - 4), 0.2, lw * 0.5);
      // gantries
      [L, CX, R].forEach(x => { line(c, P(x - 0.5, 0, Z), P(x - 0.5, 11, Z), al, lw); line(c, P(x + 0.5, 0, Z), P(x + 0.5, 11, Z), al, lw); });
      line(c, P(L - 0.5, 11, Z), P(R + 0.5, 11, Z), al, lw * 1.2);
      line(c, P(L - 0.5, 10.2, Z), P(R + 0.5, 10.2, Z), al * 0.6, lw * 0.7);
      // insulator strings + busbars (three phases)
      const phases = [9.2, 8.6, 8.0];
      const strings = [L + 2, CX - 3, CX + 3, R - 2];
      strings.forEach(x => {
        const top = P(x, 10.2, Z), bot = P(x, 9.2, Z);
        line(c, top, bot, al, lw * 0.8);
        c.fillStyle = `rgba(${SKY},${al})`;
        [0.33, 0.66].forEach(f => c.fillRect(top[0] - lw * 1.6, top[1] + (bot[1] - top[1]) * f - lw * 0.3, lw * 3.2, lw * 0.6));
      });
      const bus = phases.map(y => [P(L, y, Z), P(R, y, Z)]);
      bus.forEach(([a, b], i) => line(c, a, b, 0.55 - i * 0.08, lw));
      // transformers with radiators and bushings
      const sites = [];
      [CX - 6.5, CX + 6.5].forEach(tx => {
        const a = P(tx - 3, 0, Z), b = P(tx + 3, 4.6, Z);
        c.fillStyle = 'rgba(8,26,54,.85)'; c.fillRect(a[0], b[1], b[0] - a[0], a[1] - b[1]);
        c.strokeStyle = `rgba(${SKY},${al})`; c.lineWidth = lw; c.strokeRect(a[0], b[1], b[0] - a[0], a[1] - b[1]);
        for (let i = 0; i < 6; i++) {                        // radiator fins
          const fx = a[0] + ((b[0] - a[0]) * (i + 0.5)) / 6;
          line(c, [fx, b[1] + k * 0.6], [fx, a[1] - k * 0.5], 0.35, lw * 0.6);
        }
        [-1.8, 0, 1.8].forEach((dx, i) => {                  // bushings + droppers to the busbar
          const base = P(tx + dx, 4.6, Z), tip = P(tx + dx, 6.4, Z);
          line(c, base, tip, al, lw * 1.3);
          for (let j = 1; j <= 3; j++) {
            const yy = base[1] + ((tip[1] - base[1]) * j) / 4;
            c.fillStyle = `rgba(${SKY},${al})`; c.fillRect(base[0] - lw * 1.8, yy - lw * 0.35, lw * 3.6, lw * 0.7);
          }
          const drop = P(tx + dx, phases[i], Z);
          line(c, tip, drop, 0.3, lw * 0.6);
          sites.push([tip, drop]);                           // bushing <-> busbar
        });
        sites.push([P(tx - 1.8, 6.4, Z), P(tx, 6.4, Z)]);    // phase to phase
      });
      // circuit breakers
      [CX - 1.2, CX, CX + 1.2].forEach(x => {
        line(c, P(x, 0, Z), P(x, 3.4, Z), al, lw * 1.4);
        const hd = P(x, 3.6, Z); c.fillStyle = `rgba(${SKY},${al})`; c.fillRect(hd[0] - lw * 2, hd[1] - lw, lw * 4, lw * 2);
      });
      strings.forEach(x => sites.push([P(x, 9.2, Z), P(x, 10.2, Z)]));   // string flashover
      return {
        bus: bus.map(([a, b]) => [a, b]),
        entry: phases.map(y => [L, y, Z]),
        exit: phases.map(y => [R, y, Z]),
        sites,
      };
    }

    function build() {
      dpr = lite ? 1 : Math.min(window.devicePixelRatio || 1, 1.6);
      W = cvs.clientWidth; H = cvs.clientHeight;
      ready = W > 0 && H > 0;            // layout not ready yet (hidden, first paint): retry on resize
      if (!ready) return;
      [cvs, far, near].forEach(c => { c.width = W * dpr; c.height = H * dpr; });
      [ctx, fctx, nctx].forEach(c => c.setTransform(dpr, 0, 0, dpr, 0, 0));
      // Composition is measured from the real layout:
      // desktop: a full-width panorama. The line comes from the far left horizon, runs through a large
      //   substation standing just above the status card, and leaves for the right horizon;
      //   the CSS mask keeps it faint behind the copy.
      // phones: the substation stands on the headline's top edge, top-right, and the outgoing line leaves the screen.
      const narrow = W < 700;
      const subZ = 40;
      let subX, visibleTop = H;
      const hr = cvs.getBoundingClientRect();
      const card = $('.status'), title = $('.hero__title');
      const cr = card ? card.getBoundingClientRect() : null, tr = title ? title.getBoundingClientRect() : null;
      if (narrow) {
        const baseY = (tr ? tr.top - hr.top : H * 0.14) - 6;
        const width = Math.min(170, W * 0.45), k = width / 22;
        const cx = W - 16 - width / 2;
        F = k * subZ;
        VPY = baseY - CAMH * k;
        VPX = cx + 4 * k;
        subX = (cx - VPX) / k;
        visibleTop = baseY + 4;
      } else {
        const cardTop = cr ? cr.top - hr.top : H * 0.62;
        const nav = $('.nav');
        const top = (nav ? nav.getBoundingClientRect().bottom - hr.top : 80) + 16;
        const baseY = cardTop - 18;
        // substation ~40% of the width; nearest pylons (21 m at Z 80) must stay below the nav
        const k = Math.max(12, Math.min(32, (W * 0.4) / 22, (baseY - top) / 13.5));   // px per metre
        const cx = Math.min(W * 0.7, W - 19 * k);
        F = k * subZ;
        VPY = baseY - CAMH * k;
        VPX = cx + 4 * k;
        subX = (cx - VPX) / k;
        visibleTop = cardTop - 4;
      }

      LW = Math.max(1, Math.min(2.4, F / 520));   // strokes grow with the scene so a large substation is not spindly
      AL = narrow ? 30 : 64;                       // the desktop incoming line is a main element, keep it readable
      // far layer: perspective ground grid + incoming line
      fctx.clearRect(0, 0, W, H);
      curZ = 200;
      for (let x = -400; x <= 400; x += 25) line(fctx, P(x, 0, 30), P(x, 0, 2000), 0.05, 1);
      for (let z = 30; z < 600; z *= 1.22) line(fctx, P(-400, 0, z), P(400, 0, z), Math.min(0.08, 6 / z), 1);
      // horizon haze
      const haze = fctx.createLinearGradient(0, VPY - 70, 0, VPY + 90);
      haze.addColorStop(0, 'rgba(70,198,247,0)'); haze.addColorStop(0.45, 'rgba(70,198,247,.09)'); haze.addColorStop(1, 'rgba(70,198,247,0)');
      fctx.fillStyle = haze; fctx.fillRect(0, VPY - 70, W, 160);
      // incoming line, far -> near. Desktop: it sweeps in from the left horizon across the whole hero
      const farPylons = [];
      if (narrow) for (let z = 330; z >= 70; z -= 37) farPylons.push(pylon(fctx, subX - 1, z));
      else for (let i = 6; i >= 0; i--) farPylons.push(pylon(fctx, subX - 34 - i * 44, 80 + i * 40));

      // near layer: substation + outgoing line
      nctx.clearRect(0, 0, W, H);
      const sub = substation(nctx, subX, subZ);
      // phones: the outgoing line comes towards the viewer and leaves the screen;
      // desktop: it recedes to the right horizon and stays inside the frame
      const outs = narrow
        ? [pylon(nctx, subX + 16, 32), pylon(nctx, subX + 26, 25), pylon(nctx, subX + 38, 19)]
        : [0, 1, 2, 3].map(i => pylon(i ? fctx : nctx, subX + 26 + i * 16, 80 + i * 40));

      // conductors and the routes pulses follow (far -> substation -> viewer), one per phase
      routes = [0, 1, 2].map(ph => {
        let pts = [];
        for (let i = 0; i < farPylons.length - 1; i++) {
          const s = span(farPylons[i][ph], farPylons[i + 1][ph], 10);
          strokePoly(fctx, s, depthAlpha(farPylons[i][ph][2]) * 0.8, 0.8);
          pts = pts.concat(s);
        }
        const inS = span(farPylons[farPylons.length - 1][ph], sub.entry[ph], 14);
        strokePoly(nctx, inS, 0.45, 0.9);
        const [b0, b1] = sub.bus[ph];
        const last = outs[outs.length - 1][ph];
        const chain = [sub.exit[ph], ...outs.map(o => o[ph]), narrow ? [last[0] + 14, last[1], 14] : [last[0] + 18, last[1], last[2] + 60]];
        const outSpans = chain.slice(1).map((q, i) => span(chain[i], q));
        outSpans.forEach(s => strokePoly(nctx, s, 0.5, 1.1));
        const farPart = pts.slice(), nearPart = [].concat(inS, [b0, b1], ...outSpans);
        pts = farPart.concat(nearPart);
        [[fctx, farPart, 0.06, 2], [nctx, nearPart, 0.1, 3.2]].forEach(([c, part, al, lw]) => {   // energised underglow
          c.strokeStyle = `rgba(${VOLT},${al})`; c.lineWidth = lw * LW;
          c.beginPath(); part.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
        });
        const lens = [0];
        for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        return { pts, lens, total: lens[lens.length - 1] };
      });
      // only flash where the scene is clearly visible (the left side fades under the copy)
      arcs = sub.sites.filter(([a]) => a[1] < visibleTop && (narrow || a[0] > W * 0.55));
      if (!arcs.length) arcs = sub.sites;
      // soft bloom of the near layer, computed once
      glow.width = near.width; glow.height = near.height;
      gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glow.width, glow.height);
      gctx.filter = 'blur(6px)'; gctx.drawImage(near, 0, 0); gctx.filter = 'none';
      const per = lite ? 3 : 6;
      pulses = [];
      routes.forEach((r, ri) => { for (let i = 0; i < per; i++) pulses.push({ r: ri, d: (r.total * (i + ri / 3)) / per, v: 0.9 + Math.random() * 0.5 }); });
    }

    const at = (r, d) => {
      let lo = 0, hi = r.lens.length - 1;
      while (lo < hi - 1) { const m = (lo + hi) >> 1; if (r.lens[m] < d) lo = m; else hi = m; }
      const seg = r.lens[hi] - r.lens[lo] || 1, t = (d - r.lens[lo]) / seg;
      return [r.pts[lo][0] + (r.pts[hi][0] - r.pts[lo][0]) * t, r.pts[lo][1] + (r.pts[hi][1] - r.pts[lo][1]) * t];
    };
    // speed and size grow toward the viewer (lower on screen = nearer)
    const nearness = y => Math.max(0, Math.min(1, (y - VPY) / (H - VPY)));

    function jag(a, b, n = 7, amp = 6) {
      const pts = [a];
      for (let i = 1; i < n; i++) {
        const t = i / n, o = (Math.random() - 0.5) * 2 * amp;
        const nx = -(b[1] - a[1]), ny = b[0] - a[0], L = Math.hypot(nx, ny) || 1;
        pts.push([a[0] + (b[0] - a[0]) * t + (nx / L) * o, a[1] + (b[1] - a[1]) * t + (ny / L) * o]);
      }
      pts.push(b);
      return pts;
    }

    function frame(now) {
      ctx.clearRect(0, 0, W, H);
      px.x += (px.tx - px.x) * 0.05; px.y += (px.ty - px.y) * 0.05;
      ctx.drawImage(far, px.x * 0.4, px.y * 0.4, W, H);
      ctx.globalAlpha = 0.55; ctx.drawImage(glow, px.x, px.y, W, H); ctx.globalAlpha = 1;
      ctx.drawImage(near, px.x, px.y, W, H);
      ctx.save(); ctx.translate(px.x, px.y);
      ctx.globalCompositeOperation = 'lighter';

      // current pulses
      for (const p of pulses) {
        const r = routes[p.r];
        const [x, y] = at(r, p.d), nr = nearness(y);
        p.d += p.v * (0.6 + nr * 5.5);
        if (p.d > r.total) p.d = 0;
        const rad = 1.2 + nr * 3.6;
        // light streak running along the conductor (follows the wire's curve)
        const len = 40 + nr * 180, steps = 10;
        ctx.lineCap = 'round';
        for (let i = steps; i > 0; i--) {
          const d0 = Math.max(0, p.d - (len * i) / steps), d1 = Math.max(0, p.d - (len * (i - 1)) / steps);
          const [x0, y0] = at(r, d0), [x1, y1] = at(r, d1), k = 1 - i / steps;
          ctx.strokeStyle = `rgba(${VOLT},${(0.08 + 0.6 * k).toFixed(2)})`; ctx.lineWidth = rad * (0.5 + k);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 5);
        g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.3, `rgba(${VOLT},.7)`); g.addColorStop(1, `rgba(${VOLT},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad * 5, 0, 6.283); ctx.fill();
      }

      // short-circuit arc
      if (!arc && now > nextArc && arcs.length) {
        const [a, b] = arcs[(Math.random() * arcs.length) | 0];
        arc = { a, b, until: now + 320 + Math.random() * 200 };
        for (let i = 0; i < (lite ? 12 : 30); i++) {
          sparks.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, vx: (Math.random() - 0.5) * 3.2, vy: -Math.random() * 2.6, life: 1 });
        }
      }
      if (arc) {
        const mx = (arc.a[0] + arc.b[0]) / 2, my = (arc.a[1] + arc.b[1]) / 2;
        const flicker = Math.random() > 0.25 ? 1 : 0.35;
        const flash = ctx.createRadialGradient(mx, my, 0, mx, my, 260);
        flash.addColorStop(0, `rgba(210,255,200,${0.42 * flicker})`); flash.addColorStop(0.35, `rgba(120,220,255,${0.12 * flicker})`); flash.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.fillStyle = flash; ctx.beginPath(); ctx.arc(mx, my, 260, 0, 6.283); ctx.fill();
        const amp = Math.max(3, Math.hypot(arc.b[0] - arc.a[0], arc.b[1] - arc.a[1]) * 0.35);
        for (let k = 0; k < 2; k++) {
          const pts = jag(arc.a, arc.b, 7, amp);
          ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.strokeStyle = `rgba(${VOLT},.55)`; ctx.lineWidth = 5; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.4; ctx.stroke();
        }
        if (now > arc.until) { arc = null; nextArc = now + 6000 + Math.random() * 3000; }
      }
      sparks = sparks.filter(s => s.life > 0);
      for (const s of sparks) {
        s.x += s.vx; s.y += s.vy; s.vy += 0.12; s.life -= 0.025;
        ctx.fillStyle = `rgba(255,${200 + ((s.life * 55) | 0)},150,${s.life})`;
        ctx.fillRect(s.x, s.y, 2, 2);
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    const loop = (now) => {
      if (!ready && cvs.clientWidth > 0) build();
      if (running && ready) frame(now);
      requestAnimationFrame(loop);
    };
    build();
    if (document.fonts) document.fonts.ready.then(build);          // headline width changes once fonts arrive
    window.addEventListener('resize', () => { clearTimeout(build._t); build._t = setTimeout(build, 150); });
    if (reduced) { if (ready) frame(0); return; }
    const hero = $('#hero');
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      px.tx = ((e.clientX - r.left) / r.width - 0.5) * -24;
      px.ty = ((e.clientY - r.top) / r.height - 0.5) * -12;
    });
    hero.addEventListener('pointerleave', () => { px.tx = px.ty = 0; });
    new IntersectionObserver(([en]) => { running = en.isIntersecting && !document.hidden; }).observe(cvs);
    document.addEventListener('visibilitychange', () => { running = !document.hidden; });
    nextArc = performance.now() + 1500;
    requestAnimationFrame(loop);
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
      gsap.to(fill, { attr: n >= 2 ? { x: 350, width: 600 } : { x: 950, width: 0 }, duration: reduced ? 0 : (n >= 2 && prev < 2 ? 2.6 : 0.9), ease: 'power2.inOut', overwrite: true });
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
    if (reduced) { for (let i = 1; i <= 5; i++) dia.classList.add('on-' + i); fill.setAttribute('x', 350); fill.setAttribute('width', 600); }
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
