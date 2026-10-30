"""Same scroll positions on the old and new build: frames of hero intro and each section, saved side by side."""
import sys
from playwright.sync_api import sync_playwright
from PIL import Image
OUT = sys.argv[1]  # usage: cmp.py OUTDIR OLD_URL NEW_URL
SECTIONS = ['hero', 'about', 'how', 'projects', 'eco', 'yilnoma', 'gallery', 'services', 'process', 'calc', 'faq', 'contact']
def run(url, tag, p):
    b = p.chromium.launch(channel='chrome'); ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url, wait_until='load'); pg.wait_for_timeout(250); pg.screenshot(path=f'{OUT}/c-{tag}-intro250.png')
    pg.wait_for_timeout(1500); pg.screenshot(path=f'{OUT}/c-{tag}-intro1750.png')
    for s in SECTIONS[1:]:
        top = pg.evaluate(f"(() => {{ const e = document.getElementById('{s}'); return e ? e.getBoundingClientRect().top + scrollY : -1 }})()")
        if top < 0: continue
        for k, off in enumerate((-450, 150)):
            y = top + off
            # walk there in wheel steps so scroll-driven animations run as for a reader
            cur = pg.evaluate('scrollY')
            while abs(cur - y) > 200:
                pg.mouse.wheel(0, 200 if y > cur else -200); pg.wait_for_timeout(16); cur = pg.evaluate('scrollY')
            pg.evaluate(f'scrollTo(0,{y})'); pg.wait_for_timeout(1600)
            pg.screenshot(path=f'{OUT}/c-{tag}-{s}{k}.png')
    print(tag, 'errors', errs); b.close()
with sync_playwright() as p:
    run(sys.argv[2], 'old', p)
    run(sys.argv[3], 'new', p)
import glob, os
for f in sorted(glob.glob(f'{OUT}/c-old-*.png')):
    g = f.replace('c-old-', 'c-new-')
    if not os.path.exists(g): continue
    a, c = Image.open(f), Image.open(g)
    w, h = a.size; s = Image.new('RGB', (w * 2 + 20, h), 'red'); s.paste(a, (0, 0)); s.paste(c, (w + 20, 0))
    s.resize(((w * 2 + 20) // 2, h // 2)).save(f.replace('c-old-', 'sbs-'))
print('done')
