"""Production build: minified CSS/JS with cache-busting, templated URLs, web assets only.

Usage:  python build.py            ->  dist/ (upload its contents to any static host)
        SITE_URL=https://miniges.uz/ python build.py

Needs Node.js (esbuild is fetched by npx on first run) and Python 3.8+.
"""
import datetime, hashlib, json, os, re, shutil, subprocess, sys

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
    esbuild('css/style.css', 'css/style.css')

    css_v, js_v = fingerprint('css/style.css'), fingerprint('js/main.js')
    source = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

    def finish(html):
        html = re.sub(r'href="((?:\.\./)?css/style\.css)"', rf'href="\1?v={css_v}"', html)
        html = re.sub(r'src="((?:\.\./)?js/main\.js)"', rf'src="\1?v={js_v}"', html)
        html = re.sub(r'(src="(?:\.\./)?js/vendor/[^"?]+)"', r'\1?v=1"', html)
        return re.sub(r'\n\s*\n', '\n', html)

    write('index.html', finish(template(source)))

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
    write('ru/index.html', finish(template(ru)))

    for name in ('404.html', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest'):
        write(name, template(open(os.path.join(ROOT, name), encoding='utf-8').read()))

    # service worker: version = content hash of the pages, precache the shell (not the photos)
    build_id = hashlib.md5((css_v + js_v + open(os.path.join(DIST, 'index.html'), 'rb').read().hex()[:4000]).encode()).hexdigest()[:10]
    precache = ['./', 'ru/', f'css/style.css?v={css_v}', f'js/main.js?v={js_v}',
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
