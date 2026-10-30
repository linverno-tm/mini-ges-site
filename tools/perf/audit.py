"""Scroll the whole page like a reader; report JS errors, reveal elements still hidden after being on screen, and frame drops."""
import sys, json
from playwright.sync_api import sync_playwright
URL, TAG = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', args=['--enable-gpu-rasterization'])
    pg = b.new_page(viewport={'width': 1600, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
    cdp = pg.context.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(2500)
    pg.evaluate("""() => { window.__fr = []; let last = performance.now(); const tick = (t) => { window.__fr.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({type:'longtask', buffered:false}); } catch(e){} }""")
    H = pg.evaluate("document.documentElement.scrollHeight")
    hidden = {}
    y = 0
    while y < H:
        pg.mouse.wheel(0, 120); pg.wait_for_timeout(45); y += 120
        if y % 1800 < 120:
            pg.wait_for_timeout(900)
            res = pg.evaluate("""() => [...document.querySelectorAll('[data-reveal],[data-split],.mo')].filter(el => { const r = el.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight - 60 && r.height > 0 && getComputedStyle(el).display !== 'none'; })
              .filter(el => { let o = 1, n = el; while (n && n !== document.body) { o *= +getComputedStyle(n).opacity; n = n.parentElement; } return o < 0.5; })
              .map(el => (el.closest('section') || {}).id + ' ' + el.tagName + '.' + (el.className.baseVal ?? el.className).toString().slice(0, 40))""")
            for r in res: hidden[r] = hidden.get(r, 0) + 1
        H = pg.evaluate("document.documentElement.scrollHeight")
    fr = pg.evaluate("window.__fr.slice(5)"); lt = pg.evaluate("window.__lt")
    fr.sort()
    n = len(fr); jank = sum(1 for f in fr if f > 50)
    print(TAG, 'frames', n, 'p50 %.1f p95 %.1f p99 %.1f max %.0f' % (fr[n//2], fr[int(n*.95)], fr[int(n*.99)], fr[-1]), 'frames>50ms', jank, 'longtasks', len(lt), sum(d for _, d in lt), 'ms')
    print(TAG, 'hidden-on-screen', json.dumps(hidden, ensure_ascii=True))
    print(TAG, 'errors', errs[:8])
    b.close()
