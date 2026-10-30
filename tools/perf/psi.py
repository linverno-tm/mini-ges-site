"""PageSpeed Insights (mobile) for each URL, N runs: score, LCP, CLS, TBT, LCP element, LCP breakdown, render-blocking."""
import sys, json, time, urllib.request, urllib.parse
N = int(sys.argv[1]); URLS = sys.argv[2:]
API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?'
for u in URLS:
    for i in range(N):
        q = urllib.parse.urlencode({'url': u, 'strategy': 'mobile', 'category': 'performance'})
        for attempt in range(3):
            try:
                d = json.load(urllib.request.urlopen(API + q, timeout=180)); break
            except Exception as e:
                print('retry', u, e, flush=True); time.sleep(20)
        else:
            continue
        a = d['lighthouseResult']['audits']
        out = {'url': u, 'run': i, 'score': round(d['lighthouseResult']['categories']['performance']['score'] * 100),
               'lcp': a['largest-contentful-paint']['displayValue'], 'fcp': a['first-contentful-paint']['displayValue'],
               'cls': a['cumulative-layout-shift']['displayValue'], 'tbt': a['total-blocking-time']['displayValue'],
               'si': a['speed-index']['displayValue']}
        try:
            el = a['largest-contentful-paint-element']['details']['items']
            out['lcp_el'] = [x.get('node', {}).get('snippet', '')[:160] for it in el for x in it.get('items', [it])][:1]
            out['lcp_phases'] = [x for it in el for x in it.get('items', []) if 'phase' in x]
        except Exception: pass
        rb = a.get('render-blocking-resources', {}).get('details', {}).get('items', []) or \
             a.get('render-blocking-insight', {}).get('details', {}).get('items', [])
        out['blocking'] = [(x.get('url', '')[-60:], x.get('wastedMs')) for x in rb]
        print(json.dumps(out, ensure_ascii=False), flush=True)
