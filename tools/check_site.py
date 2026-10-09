"""Static quality gate for the site. Runs in CI before every deploy.

Checks: duplicate ids, broken in-page anchors, missing local files (HTML, CSS, JS),
images without alt, unnamed buttons/links, unlabeled form controls,
target=_blank without rel=noopener.

Usage:  python tools/check_site.py      (exit code 1 on any problem)
"""
import os, re, sys
from html.parser import HTMLParser

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mini-ges-site')
PAGES = ('index.html', '404.html')
SKIP = ('http://', 'https://', 'tel:', 'mailto:', 'data:', 'javascript:')
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}

problems = []


def local_path(ref):
    ref = ref.replace('%SITE_URL%', '').split('#')[0].split('?')[0]
    return os.path.normpath(os.path.join(SITE, ref)) if ref else None


def check_ref(page, ref, what):
    if not ref or ref.startswith(SKIP) or ref.startswith('#'):
        return
    p = local_path(ref)
    if p and not os.path.exists(p):
        problems.append(f'{page}: {what} -> missing file "{ref}"')


class Page(HTMLParser):
    def __init__(self, name):
        super().__init__(convert_charrefs=True)
        self.name, self.ids, self.anchors, self.labels_for = name, {}, [], set()
        self.stack = []          # open elements: [tag, attrs, text]
        self.controls = []       # (id, attrs, inside_label)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        if 'id' in a:
            if a['id'] in self.ids:
                problems.append(f'{self.name}:{line}: duplicate id "{a["id"]}" (first at line {self.ids[a["id"]]})')
            self.ids.setdefault(a['id'], line)
        for attr in ('src', 'href', 'poster'):
            if attr in a and not (tag == 'link' and a.get('rel') in ('preconnect', 'canonical')):
                ref = a[attr]
                if ref.startswith('#') and len(ref) > 1:
                    self.anchors.append((ref[1:], line))
                else:
                    check_ref(self.name, ref, f'<{tag} {attr}> line {line}')
        if 'srcset' in a:
            for part in a['srcset'].split(','):
                check_ref(self.name, part.strip().split(' ')[0], f'<{tag} srcset> line {line}')
        if tag == 'img' and 'alt' not in a:
            problems.append(f'{self.name}:{line}: <img> without alt')
        if a.get('target') == '_blank' and 'noopener' not in (a.get('rel') or ''):
            problems.append(f'{self.name}:{line}: target=_blank without rel="noopener"')
        if tag == 'label' and 'for' in a:
            self.labels_for.add(a['for'])
        if tag in ('input', 'select', 'textarea') and a.get('type') not in ('hidden', 'submit', 'button'):
            inside_label = any(t[0] == 'label' for t in self.stack)
            self.controls.append((a.get('id'), a, inside_label, line))
        if tag not in VOID:
            self.stack.append([tag, a, '', line])

    def handle_endtag(self, tag):
        while self.stack:
            t, a, text, line = self.stack.pop()
            if t in ('button', 'a') and not (text.strip() or a.get('aria-label') or a.get('aria-hidden') == 'true'):
                problems.append(f'{self.name}:{line}: <{t}> has no text or aria-label')
            if self.stack and t in ('button', 'a', 'span', 'em', 'b', 'i', 'strong', 'svg', 'path'):
                self.stack[-1][2] += text      # bubble text up so <a><span>x</span></a> counts
            if t == tag:
                break

    def handle_data(self, data):
        if self.stack:
            self.stack[-1][2] += data

    def finish(self):
        for target, line in self.anchors:
            if target not in self.ids:
                problems.append(f'{self.name}:{line}: link to "#{target}" but no element has that id')
        for cid, a, inside, line in self.controls:
            if not (inside or (cid and cid in self.labels_for) or a.get('aria-label')):
                problems.append(f'{self.name}:{line}: form control without a label')


for name in PAGES:
    p = Page(name)
    p.feed(open(os.path.join(SITE, name), encoding='utf-8').read())
    p.close()
    p.finish()

css = open(os.path.join(SITE, 'css', 'style.css'), encoding='utf-8').read()
for ref in re.findall(r'url\(["\']?([^"\')]+)', css):
    if not ref.startswith('%23'):          # fragment refs inside inline data: SVGs
        check_ref('style.css', ref, 'url()')

js = open(os.path.join(SITE, 'js', 'main.js'), encoding='utf-8').read()
for ref in set(re.findall(r'["\'](assets/[^"\']+)["\']', js)):
    check_ref('main.js', ref, 'asset string')

if problems:
    print(f'FAIL: {len(problems)} problem(s):')
    print('\n'.join('  - ' + p for p in problems))
    sys.exit(1)
print('OK: site checks passed')
