"""Main-thread work before first contentful paint: top trace events by self time (mobile viewport, unthrottled)."""
import sys, json, collections
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    ctx = b.new_context(viewport={'width': 412, 'height': 823}, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    b.start_tracing(page=pg, categories=['devtools.timeline', 'blink.user_timing', 'loading', 'v8.execute', 'disabled-by-default-devtools.timeline'])
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(1500)
    raw = b.stop_tracing()
    ev = json.loads(raw)['traceEvents']
    nav = min(e['ts'] for e in ev if e.get('name') == 'navigationStart')
    fcp = [e['ts'] for e in ev if e.get('name') == 'firstContentfulPaint']
    fcp = min(fcp) if fcp else nav + 3e6
    print('FCP ms', round((fcp - nav) / 1000))
    main_tid = collections.Counter(e['tid'] for e in ev if e.get('name') == 'ParseHTML').most_common(1)[0][0]
    tot = collections.Counter(); spans = []
    for e in ev:
        if e.get('ph') == 'X' and e.get('tid') == main_tid and nav <= e['ts'] < fcp and e.get('dur', 0) > 2000:
            name = e['name']
            d = e.get('args', {}).get('data', {})
            if name in ('EvaluateScript', 'FunctionCall', 'v8.compile'): name += ' ' + (d.get('url', '') or d.get('functionName', ''))[-45:]
            tot[name] += e['dur'] / 1000
            if e['dur'] > 30000: spans.append((round((e['ts'] - nav) / 1000), round(e['dur'] / 1000), name))
    for k, v in tot.most_common(14): print(f'{v:7.0f} ms  {k}')
    print('big spans', sorted(spans)[:20])
    b.close()
