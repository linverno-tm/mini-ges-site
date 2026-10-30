import json, sys, glob, os
for f in sorted(sum([glob.glob(p) for p in sys.argv[1:]], [])):
    d = json.load(open(f, encoding='utf-8')); a = d['audits']
    print(os.path.basename(f), round(d['categories']['performance']['score']*100),
          'LCP', round(a['largest-contentful-paint']['numericValue']), 'FCP', round(a['first-contentful-paint']['numericValue']),
          'TBT', round(a['total-blocking-time']['numericValue']), 'CLS', round(a['cumulative-layout-shift']['numericValue'], 3),
          'main', round(a['mainthread-work-breakdown']['numericValue']))
