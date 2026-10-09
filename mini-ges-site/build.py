"""Production build: minified CSS/JS with cache-busting, only web assets, server config.

Usage:  python build.py      ->  upload the contents of ./dist to the hosting root.
Needs Node.js (esbuild is fetched by npx on first run).
"""
import hashlib, os, re, shutil, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
NPX = 'npx.cmd' if os.name == 'nt' else 'npx'

shutil.rmtree(DIST, ignore_errors=True)
os.makedirs(os.path.join(DIST, 'css')); os.makedirs(os.path.join(DIST, 'js'))

for src, out in (('js/main.js', 'js/main.js'), ('css/style.css', 'css/style.css')):
    args = [NPX, '--yes', 'esbuild@0.24.0', os.path.join(ROOT, src), '--minify', '--outfile=' + os.path.join(DIST, out)]
    if src.endswith('.js'):
        args.insert(4, '--target=es2019')
    subprocess.run(args, check=True)

def ver(path):
    return hashlib.md5(open(os.path.join(DIST, path), 'rb').read()).hexdigest()[:8]

html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
html = html.replace('href="css/style.css"', f'href="css/style.css?v={ver("css/style.css")}"')
html = html.replace('src="js/main.js"', f'src="js/main.js?v={ver("js/main.js")}"')
html = html.replace('src="js/vendor/', 'src="js/vendor/').replace('.min.js"', '.min.js?v=3.12.5"')
html = re.sub(r'\n\s*\n', '\n', html)
open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8', newline='\n').write(html)

# only what the page references: webp images + favicon (source PNG logos stay out)
def copy_tree(rel, keep):
    for dirpath, _, files in os.walk(os.path.join(ROOT, rel)):
        for f in files:
            if keep(f):
                s = os.path.join(dirpath, f)
                d = os.path.join(DIST, os.path.relpath(s, ROOT))
                os.makedirs(os.path.dirname(d), exist_ok=True)
                shutil.copy2(s, d)
copy_tree('assets', lambda f: f.endswith('.webp') or f == 'favicon.png')
copy_tree('js/vendor', lambda f: f.endswith('.js'))

open(os.path.join(DIST, '.htaccess'), 'w', newline='\n').write('''# gzip text assets
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript text/javascript image/svg+xml
</IfModule>
# long cache for images, versioned css/js; html always fresh
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType text/html "access plus 0 seconds"
</IfModule>
AddType image/webp .webp
''')

total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(DIST) for f in fs)
print(f'dist ready: {total / 1024 / 1024:.1f} MB')
