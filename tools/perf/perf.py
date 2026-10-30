"""Lighthouse-like mobile check: slow 4G + 4x CPU, measures LCP and CLS (also scrolls the page for CLS)."""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
OBS = """
window.__lcp = 0; window.__cls = 0;
new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({type: 'largest-contentful-paint', buffered: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({type: 'layout-shift', buffered: true});
"""
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    for run in range(2):
        ctx = b.new_context(viewport={'width': 412, 'height': 823}, device_scale_factor=2.625, is_mobile=True, has_touch=True,
                            user_agent='Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
        pg = ctx.new_page()
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Network.enable')
        cdp.send('Network.setCacheDisabled', {'cacheDisabled': True})
        cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 150, 'downloadThroughput': 1.6 * 1024 * 1024 / 8, 'uploadThroughput': 750 * 1024 / 8})
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        pg.add_init_script(OBS)
        pg.goto(URL, wait_until='load', timeout=120000)
        pg.wait_for_timeout(4000)
        lcp = pg.evaluate('window.__lcp')
        el = pg.evaluate("(() => { const e = performance.getEntriesByType('largest-contentful-paint').pop(); return e && e.element ? e.element.tagName + '.' + e.element.className : null })()")
        for y in range(0, 14):
            pg.mouse.wheel(0, 700); pg.wait_for_timeout(250)
        pg.wait_for_timeout(1000)
        cls = pg.evaluate('window.__cls')
        print(json.dumps({'run': run, 'lcp_ms': round(lcp), 'lcp_el': el, 'cls': round(cls, 4)}))
        ctx.close()
    b.close()
