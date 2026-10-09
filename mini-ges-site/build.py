"""Production build: minified CSS/JS with cache-busting, templated URLs, web assets only.

Usage:  python build.py            ->  dist/ (upload its contents to any static host)
        SITE_URL=https://miniges.uz/ python build.py

Needs Node.js (esbuild is fetched by npx on first run) and Python 3.8+.
"""
import datetime, hashlib, html, json, os, re, shutil, subprocess, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools'))
import i18n  # noqa: E402  (tools/i18n.py)

# Public address of the site, with a trailing slash. Change it here (or via the
# SITE_URL env var) once the domain is bought; everything else follows.
SITE_URL = os.environ.get('SITE_URL', 'https://linverno-tm.github.io/mini-ges-site/')

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
NPX = 'npx.cmd' if os.name == 'nt' else 'npx'
ESBUILD = 'esbuild@0.24.0'


def esbuild(src, out, *extra):
    subprocess.run([NPX, '--yes', ESBUILD, os.path.join(ROOT, src), '--minify', *extra,
                    '--outfile=' + os.path.join(DIST, out)], check=True)


def fingerprint(rel):
    return hashlib.md5(open(os.path.join(DIST, rel), 'rb').read()).hexdigest()[:8]


def template(text):
    return (text.replace('%SITE_URL%', SITE_URL)
                .replace('%BUILD_DATE%', datetime.date.today().isoformat()))


def write(rel, text):
    open(os.path.join(DIST, rel), 'w', encoding='utf-8', newline='\n').write(text)


# ---------------------------------------------------------------- industry news (data/news.json, tools/fetch_news.py)
NEWS_SHOWN, NEWS_MAX = 8, 24
NEWS_L = {
    'uz': {'live': 'Har kuni yangilanadi', 'updated': 'Oxirgi yangilanish', 'filters': 'Mavzu bo‘yicha saralash',
           'all': 'Barchasi', 'more': 'Yana ko‘rsatish', 'less': 'Qisqartirish', 'newtab': 'yangi oynada ochiladi',
           'empty': 'Hozircha yangi xabar yo‘q. Bo‘lim har kuni avtomatik yangilanadi.',
           'tags': {'tariff': 'Tarif', 'law': 'Qonunchilik', 'invest': 'Investitsiya', 'project': 'Loyihalar', 'news': 'Soha'},
           'months': 'yanvar fevral mart aprel may iyun iyul avgust sentabr oktabr noyabr dekabr'.split(),
           'date': '{d}-{m}, {y}'},
    'ru': {'live': 'Обновляется ежедневно', 'updated': 'Последнее обновление', 'filters': 'Фильтр по теме',
           'all': 'Все', 'more': 'Показать ещё', 'less': 'Свернуть', 'newtab': 'откроется в новом окне',
           'empty': 'Пока нет новых сообщений. Раздел обновляется автоматически каждый день.',
           'tags': {'tariff': 'Тарифы', 'law': 'Законодательство', 'invest': 'Инвестиции', 'project': 'Проекты', 'news': 'Отрасль'},
           'months': 'января февраля марта апреля мая июня июля августа сентября октября ноября декабря'.split(),
           'date': '{d} {m} {y}'},
}


def render_news(lang):
    """Static HTML for the news section: no request to a third party when the page opens."""
    esc = html.escape
    t = NEWS_L[lang]
    path = os.path.join(ROOT, 'data', 'news.json')
    data = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {'updated': '', 'items': []}
    items = [i for i in data['items'] if i['url'].startswith('https://')][:NEWS_MAX]

    def day(iso):
        d = datetime.date.fromisoformat(iso)
        return f'<time datetime="{iso}">{t["date"].format(d=d.day, m=t["months"][d.month - 1], y=d.year)}</time>'

    if not items:
        return f'<p class="news__empty">{t["empty"]}</p>'
    out = [f'<div class="news__bar" data-reveal><span class="news__live mono"><i aria-hidden="true"></i>{t["live"]}</span>'
           f'<span class="news__upd mono">{t["updated"]}: {day(data["updated"])}</span></div>']
    counts = {}
    for i in items:
        counts[i['tag']] = counts.get(i['tag'], 0) + 1
    chips = [f'<button type="button" class="nchip is-on" data-tag="all" aria-pressed="true">{t["all"]}<sup>{len(items)}</sup></button>']
    chips += [f'<button type="button" class="nchip" data-tag="{k}" aria-pressed="false">{v}<sup>{counts[k]}</sup></button>'
              for k, v in t['tags'].items() if counts.get(k)]
    out.append(f'<div class="news__chips" role="group" aria-label="{t["filters"]}" data-reveal>{"".join(chips)}</div>')
    out.append('<ul class="news__list" id="newsList">')
    for n, i in enumerate(items):
        more = n >= NEWS_SHOWN
        attrs = ' class="ncard ncard--more"' if more else ' class="ncard" data-reveal'
        title_lang = f' lang="{i["lang"]}"' if i['lang'] != lang else ''
        out.append(
            f'<li{attrs} data-tag="{esc(i["tag"])}"><a class="ncard__a" href="{esc(i["url"])}" target="_blank" rel="noopener noreferrer nofollow">'
            f'<span class="ncard__meta mono"><b class="ncard__tag ncard__tag--{esc(i["tag"])}">{t["tags"].get(i["tag"], i["tag"])}</b>{day(i["date"])}</span>'
            f'<span class="ncard__title"{title_lang}>{esc(i["title"])}</span>'
            f'<span class="ncard__src">{esc(i["source"])}<span class="sr-only"> ({t["newtab"]})</span>'
            f'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span></a></li>')
    out.append('</ul>')
    if len(items) > NEWS_SHOWN:
        out.append(f'<button type="button" class="btn btn--brand btn--sm news__more" id="newsMore" aria-expanded="false" aria-controls="newsList"'
                   f' data-less="{t["less"]}"><span>{t["more"]}</span></button>')
    return '\n'.join(out)


def copy_tree(rel, keep):
    for dirpath, _, files in os.walk(os.path.join(ROOT, rel)):
        for f in files:
            if keep(f):
                s = os.path.join(dirpath, f)
                d = os.path.join(DIST, os.path.relpath(s, ROOT))
                os.makedirs(os.path.dirname(d), exist_ok=True)
                shutil.copy2(s, d)


def main():
    assert SITE_URL.endswith('/'), 'SITE_URL must end with a slash'
    shutil.rmtree(DIST, ignore_errors=True)
    os.makedirs(DIST, exist_ok=True)

    esbuild('js/main.js', 'js/main.js', '--target=es2019')
    esbuild('js/boot.js', 'js/boot.js', '--target=es2019')
    esbuild('css/style.css', 'css/style.css')

    css_v, js_v, boot_v = fingerprint('css/style.css'), fingerprint('js/main.js'), fingerprint('js/boot.js')
    source = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

    def finish(html):
        html = re.sub(r'href="((?:\.\./)?css/style\.css)"', rf'href="\1?v={css_v}"', html)
        html = re.sub(r'src="((?:\.\./)?js/main\.js)"', rf'src="\1?v={js_v}"', html)
        html = re.sub(r'src="((?:\.\./)?js/boot\.js)"', rf'src="\1?v={boot_v}"', html)
        html = re.sub(r'(src="(?:\.\./)?js/vendor/[^"?]+)"', r'\1?v=1"', html)
        return re.sub(r'\n\s*\n', '\n', html)

    write('index.html', finish(template(source)).replace('<!--NEWS-->', render_news('uz')))

    # Russian page: same source, translated at build time, one folder deeper
    ru, missing = i18n.translate(source, 'ru')
    assert not missing, f'untranslated for ru: {missing[:5]}'
    ru = ru.replace('<html lang="uz"', '<html lang="ru"', 1)
    ru = ru.replace('content="uz_UZ"', 'content="ru_RU"')
    ru = ru.replace('<link rel="canonical" href="%SITE_URL%">', '<link rel="canonical" href="%SITE_URL%ru/">')
    ru = ru.replace('<meta property="og:url" content="%SITE_URL%">', '<meta property="og:url" content="%SITE_URL%ru/">')
    ru = ru.replace('href="./" hreflang="uz" lang="uz" aria-current="page"', 'href="./" hreflang="uz" lang="uz"')
    ru = ru.replace('href="ru/" hreflang="ru" lang="ru"', 'href="ru/" hreflang="ru" lang="ru" aria-current="page"')
    ru = re.sub(r'(\s(?:src|href|data-src)=")(?!https?:|//|#|data:|tel:|mailto:|%SITE_URL%|/|\.\./)', r'\1../', ru)
    ru = re.sub(r'(\ssrcset=")([^"]+)"', lambda m: m.group(1) + ', '.join(
        p.strip() if p.strip().startswith(('http', '/', 'data:')) else '../' + p.strip()
        for p in m.group(2).split(',')) + '"', ru)
    ru = ru.replace('href="../ru/"', 'href="./"').replace('href=".././"', 'href="../"')
    os.makedirs(os.path.join(DIST, 'ru'), exist_ok=True)
    write('ru/index.html', finish(template(ru)).replace('<!--NEWS-->', render_news('ru')))

    for name in ('404.html', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest'):
        write(name, template(open(os.path.join(ROOT, name), encoding='utf-8').read()))

    # service worker: version = content hash of the pages, precache the shell (not the photos)
    build_id = hashlib.md5((css_v + js_v + open(os.path.join(DIST, 'index.html'), 'rb').read().hex()[:4000]).encode()).hexdigest()[:10]
    precache = ['./', 'ru/', f'css/style.css?v={css_v}', f'js/main.js?v={js_v}', f'js/boot.js?v={boot_v}',
                'js/vendor/gsap.min.js?v=1', 'js/vendor/ScrollTrigger.min.js?v=1', 'js/vendor/lenis.min.js?v=1',
                'assets/logo-ulugnor.webp', 'assets/logo-baliqchi.webp', 'assets/favicon.png', 'manifest.webmanifest']
    sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()
    sw = sw.replace('%BUILD_ID%', build_id)
    sw = re.sub(r'/\*PRECACHE\*/.*?/\*END\*/', json.dumps(precache), sw, flags=re.S)
    write('sw.js', sw)

    # only what pages reference: web images + icons (source PNG logos stay out)
    copy_tree('assets', lambda f: f.endswith(('.webp', '.jpg')) or f in (
        'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'))
    copy_tree('js/vendor', lambda f: f.endswith('.js'))
    shutil.copy2(os.path.join(ROOT, '.htaccess'), os.path.join(DIST, '.htaccess'))

    leftovers = [p for p in ('index.html', 'ru/index.html', '404.html', 'robots.txt', 'sitemap.xml')
                 if '%SITE_URL%' in open(os.path.join(DIST, p), encoding='utf-8').read()]
    assert not leftovers, f'untemplated placeholders in {leftovers}'

    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(DIST) for f in fs)
    print(f'dist ready for {SITE_URL}: {total / 1024 / 1024:.1f} MB')


if __name__ == '__main__':
    main()
