"""Build-time localisation for the static page.

The Uzbek page (mini-ges-site/index.html) is the single source. Translations live in
mini-ges-site/i18n/<lang>.json:

  "text":  { "<uzbek text segment>": "<translation>" }   text nodes and the attributes
                                                         alt / aria-label / title / data-cursor / content
  "html":  { "<data-i18n key>": "<inner html>" }         whole-element overrides, for
                                                         sentences whose word order changes

Usage:
  python tools/i18n.py extract ru     # list untranslated segments (exit 1 if any)
"""
import html as H
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mini-ges-site')
ATTRS = ('alt', 'aria-label', 'title', 'data-cursor', 'content')
LETTER = re.compile(r"[A-Za-zА-Яа-я]")
TOKEN = re.compile(r'(<!--.*?-->|<[^>]+>)', re.S)
ATTR_RE = re.compile(r'(\s(?:' + '|'.join(re.escape(a) for a in ATTRS) + r')=")([^"]*)(")')


def segments(src):
    """Yield ('text'|'attr', raw_value) for every translatable piece, skipping script/style."""
    skip = None
    for part in TOKEN.split(src):
        if not part:
            continue
        if part.startswith('<'):
            low = part.lower()
            if skip and low.startswith('</' + skip):
                skip = None
            elif low.startswith('<script') and 'ld+json' not in low or low.startswith('<style'):
                skip = 'script' if low.startswith('<script') else 'style'
            if not part.startswith('<!--'):
                for m in ATTR_RE.finditer(part):
                    yield 'attr', m.group(2)
        elif not skip:
            yield 'text', part


CYRILLIC = re.compile(r"[А-Яа-яЁё]")


def core(raw):
    # non-breaking spaces are presentation only: match them like normal spaces
    return H.unescape(raw).replace(' ', ' ').strip()


def load(lang):
    return json.load(open(os.path.join(ROOT, 'i18n', f'{lang}.json'), encoding='utf-8'))


def translate(src, lang):
    """Return the page translated into `lang`, plus a list of missing segments."""
    tr = load(lang)
    text, overrides = tr.get('text', {}), tr.get('html', {})
    missing = []

    # 1) whole-element overrides: <tag ... data-i18n="key">inner</tag>
    def over(m):
        open_tag, key, close_tag = m.group(1), m.group(3), m.group(4)
        if key not in overrides:
            missing.append('[html] ' + key)
            return m.group(0)
        return open_tag + overrides[key] + close_tag
    src = re.sub(r'(<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>).*?(</\2>)', over, src, flags=re.S)

    # 2) segment by segment
    out, skip = [], None
    for part in TOKEN.split(src):
        if not part:
            continue
        if part.startswith('<'):
            low = part.lower()
            if skip and low.startswith('</' + skip):
                skip = None
            elif (low.startswith('<script') and 'ld+json' not in low) or low.startswith('<style'):
                skip = 'script' if low.startswith('<script') else 'style'
            if not part.startswith('<!--'):
                def attr(m):
                    c = core(m.group(2))
                    if not LETTER.search(c):
                        return m.group(0)
                    if c in text:
                        return m.group(1) + H.escape(text[c], quote=True) + m.group(3)
                    if not c.startswith(('http', '%SITE_URL%', 'width=', 'default-src', 'strict-', '#', 'light', 'website', 'summary', 'uz_UZ', 'noindex')):
                        missing.append(c)
                    return m.group(0)
                part = ATTR_RE.sub(attr, part)
            out.append(part)
        elif skip:
            out.append(part)
        elif low_is_ldjson(out):
            out.append(translate_ldjson(part, text, missing))
        else:
            c = core(part)
            if LETTER.search(c) and not CYRILLIC.search(c):   # Cyrillic = already localised
                if c in text:
                    lead = part[:len(part) - len(part.lstrip())]
                    trail = part[len(part.rstrip()):]
                    part = lead + H.escape(text[c], quote=False).replace(' ', '&nbsp;') + trail
                else:
                    missing.append(c)
            out.append(part)
    return ''.join(out), sorted(set(missing))


def low_is_ldjson(out):
    return bool(out) and out[-1].lower().startswith('<script') and 'ld+json' in out[-1].lower()


def translate_ldjson(raw, text, missing):
    data = json.loads(raw)
    def walk(v, key=None):
        if isinstance(v, dict):
            return {k: walk(x, k) for k, x in v.items()}
        if isinstance(v, list):
            return [walk(x, key) for x in v]
        if isinstance(v, str) and key in ('name', 'description', 'addressRegion') and LETTER.search(v):
            if v in text:
                return text[v]
            missing.append(v)
        return v
    return '\n' + json.dumps(walk(data), ensure_ascii=False, indent=2) + '\n'


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    cmd, lang = sys.argv[1], sys.argv[2]
    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    if cmd == 'extract':
        _, missing = translate(src, lang)
        for m in missing:
            print(json.dumps(m, ensure_ascii=False))
        print(f'-- {len(missing)} untranslated segment(s) for "{lang}"', file=sys.stderr)
        sys.exit(1 if missing else 0)
