"""Tiny blurred placeholders for the page's lazy images.

For every opaque <img loading="lazy"> in mini-ges-site/index.html with a local src, a 16 px wide WebP
is stored as a data URI in mini-ges-site/data/lqip.json. build.py paints it as the image's
background, so a slow photo shows a soft preview instead of an empty grey box.

Run after adding or changing photos (needs Pillow; CI only reads the JSON):
  python tools/lqip.py
"""
import base64, io, json, os, re
from PIL import Image

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mini-ges-site')
OUT = os.path.join(SITE, 'data', 'lqip.json')


def transparent(im):
    """Logos and cut-outs: a blurred preview would show through their see-through parts."""
    if im.mode in ('RGBA', 'LA', 'PA') or 'transparency' in im.info:
        return im.convert('RGBA').getchannel('A').getextrema()[0] < 250
    return False


def thumb(path):
    im = Image.open(path)
    if transparent(im):
        return None
    im = im.convert('RGB')
    im.thumbnail((16, 16 * im.height // im.width or 1))
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=45)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


def main():
    html = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
    out = {}
    for tag in re.findall(r'<img[^>]*loading="lazy"[^>]*>', html):
        src = re.search(r'\ssrc="([^"]+)"', tag)
        if not src or src.group(1).startswith(('http', 'data:', '//')):
            continue
        rel = src.group(1).split('?')[0]
        path = os.path.join(SITE, rel)
        if os.path.exists(path) and rel not in out:
            uri = thumb(path)
            if uri:
                out[rel] = uri
            else:
                print('skipped (transparent):', rel)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1, sort_keys=True)
        f.write('\n')
    print(f'{len(out)} placeholders, {sum(map(len, out.values())) // 1024} KB -> {os.path.relpath(OUT)}')


if __name__ == '__main__':
    main()
