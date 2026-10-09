"""Production build: minified CSS/JS with cache-busting, templated URLs, web assets only.

Usage:  python build.py            ->  dist/ (upload its contents to any static host)
        SITE_URL=https://miniges.uz/ python build.py

Needs Node.js (esbuild is fetched by npx on first run) and Python 3.8+.
"""
import datetime, hashlib, os, re, shutil, subprocess

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
    os.makedirs(DIST)

    esbuild('js/main.js', 'js/main.js', '--target=es2019')
    esbuild('css/style.css', 'css/style.css')

    html = template(open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read())
    html = html.replace('href="css/style.css"', f'href="css/style.css?v={fingerprint("css/style.css")}"')
    html = html.replace('src="js/main.js"', f'src="js/main.js?v={fingerprint("js/main.js")}"')
    html = re.sub(r'(src="js/vendor/[^"?]+)"', r'\1?v=1"', html)
    html = re.sub(r'\n\s*\n', '\n', html)
    open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8', newline='\n').write(html)

    for name in ('404.html', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest'):
        text = open(os.path.join(ROOT, name), encoding='utf-8').read()
        open(os.path.join(DIST, name), 'w', encoding='utf-8', newline='\n').write(template(text))

    # only what pages reference: web images + icons (source PNG logos stay out)
    copy_tree('assets', lambda f: f.endswith(('.webp', '.jpg')) or f in (
        'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'))
    copy_tree('js/vendor', lambda f: f.endswith('.js'))
    shutil.copy2(os.path.join(ROOT, '.htaccess'), os.path.join(DIST, '.htaccess'))

    leftovers = [p for p in ('index.html', '404.html', 'robots.txt', 'sitemap.xml')
                 if '%SITE_URL%' in open(os.path.join(DIST, p), encoding='utf-8').read()]
    assert not leftovers, f'untemplated placeholders in {leftovers}'

    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(DIST) for f in fs)
    print(f'dist ready for {SITE_URL}: {total / 1024 / 1024:.1f} MB')


if __name__ == '__main__':
    main()
