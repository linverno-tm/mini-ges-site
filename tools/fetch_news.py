"""Collects hydro-power news about Uzbekistan for the "Soha yangiliklari" section.

Usage:  python tools/fetch_news.py          ->  updates mini-ges-site/data/news.json

Sources are public RSS feeds: Google News searches (they reach back several months) and the
main Uzbek outlets' own feeds (fresh, direct links). Only the headline, outlet, date and link
are stored; the page links to the original article. Items accumulate across runs, so a quiet
day never empties the section. A source that fails is skipped; the script never fails the build.
"""
import datetime as dt, email.utils, html, json, os, re, sys, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'mini-ges-site', 'data', 'news.json')
KEEP, MAX_AGE_DAYS = 60, 365

def gnews(q, hl):
    return 'https://news.google.com/rss/search?' + urllib.parse.urlencode(
        {'q': f'{q} when:365d', 'hl': hl, 'gl': 'UZ', 'ceid': f'UZ:{hl}'})

# direct feeds first: on duplicates their links (straight to the outlet) win
FEEDS = [
    'https://www.gazeta.uz/oz/rss/', 'https://www.gazeta.uz/ru/rss/', 'https://kun.uz/news/rss',
    'https://www.spot.uz/rss/', 'https://daryo.uz/feed/', 'https://uza.uz/uz/rss', 'https://uza.uz/ru/rss',
    'https://podrobno.uz/rss/', 'https://www.uzdaily.uz/ru/rss', 'https://nuz.uz/feed',
    gnews('малые ГЭС Узбекистан', 'ru'), gnews('микроГЭС Узбекистан', 'ru'), gnews('ГЭС Узбекистан', 'ru'),
    gnews('mikroGES', 'uz'), gnews('kichik GES', 'uz'), gnews('gidroelektr stansiya', 'uz'),
]

HYDRO = re.compile(r'ГЭС|ГЕС|гидроэлектр|гидроэнерг|\bGES\b|gidroelektr|gidroenerg|закупочн\w* тариф', re.I)
UZBEK = re.compile(r'Узбек|Ўзбек|O.?zbek|Uzbek|Ташкент|Toshkent|Андижан|Andijon|Наманган|Namangan|Ферган|Farg|Сурхандар|Surxondar|Кашкадар|Qashqadar|Самарканд|Samarqand|Бухар|Buxoro|Хорезм|Xorazm|Джизак|Jizzax|Навои|Navoiy|Сырдар|Sirdaryo|Каракалпак|Qoraqalpo|Чирчик|Chirchiq|Пскем|Сох', re.I)
# the audience builds small plants: regional mega-projects and grid incidents abroad are noise here
NOISE = re.compile(r'Камбар|Kambar|Рогун|Rogun|Токтогул|Toktog|Кайраккум|блэкаут|blackout|АЭС|железн', re.I)
SMALL = re.compile(r'мал\w* (?:и микро)?ГЭС|мал\w* и микро|микро\s?ГЭС|микрогидро|малой гидро|kichik GES|mikro\s?GES|kichik gidro|кичик ГЭС', re.I)
TAGS = [  # first match wins
    ('tariff', re.compile(r'тариф|tarif|закупочн|narx', re.I)),
    ('law', re.compile(r'постановлен|указ\b|закон|правил|услови|льгот|субсид|поддерж|механизм|мер[ыау]? по|аукцион|земл|президент|Мирзиёев|qaror|farmon|qonun|imtiyoz|subsidiya|Prezident|Mirziyoyev', re.I)),
    ('invest', re.compile(r'инвест|investi|кредит|kredit|банк|JBIC|ADB|\$|млрд|mlrd', re.I)),
    ('project', re.compile(r'запуст|ввод|введ|строят|строительств|построен|выработку|площад|станци|ishga tush|qurilish|qurib|bitkaz', re.I)),
]


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; MiniGES-news/1.0)'})
    return urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'replace')


def text(s):
    s = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', s or '', flags=re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s))).strip()


def lang_of(t):
    if re.search(r'[ўқғҳЎҚҒҲ]', t):
        return 'uz'
    return 'ru' if re.search(r'[А-Яа-яЁё]', t) else 'uz'


def parse(feed):
    for it in re.findall(r'<item[\s>].*?</item>', feed, re.S):
        g = lambda tag: (re.search(rf'<{tag}[^>]*>(.*?)</{tag}>', it, re.S) or [None, ''])[1]
        title, link, date = text(g('title')), text(g('link')), text(g('pubDate'))
        src = re.search(r'<source url="([^"]*)"[^>]*>(.*?)</source>', it, re.S)
        if src:   # Google News: "Headline - Outlet"
            source, home = text(src.group(2)), src.group(1)
            title = re.sub(r'\s+-\s+' + re.escape(source) + r'$', '', title)
        else:
            home = link
            source = re.sub(r'^www\.', '', urllib.parse.urlsplit(link).hostname or '')
        try:
            when = email.utils.parsedate_to_datetime(date).astimezone(dt.timezone.utc)
        except (TypeError, ValueError):
            continue
        if not title or not link.startswith('https://'):
            continue
        yield {'title': title, 'url': link, 'source': source, 'home': home,
               'date': when.strftime('%Y-%m-%d'), 'lang': lang_of(title)}


def relevant(it):
    t = it['title']
    if not HYDRO.search(t) or NOISE.search(t):
        return False
    host = urllib.parse.urlsplit(it['home']).hostname or ''
    # Uzbek outlets: any hydro story; foreign outlets: only small hydro in Uzbekistan
    return host.endswith('.uz') or bool(UZBEK.search(t) and SMALL.search(t))


def words(t):
    # crude stems: Russian and Uzbek words change endings, the first five letters rarely do
    return {w[:5] for w in re.findall(r'\w{4,}', t.lower())}


def same_story(a, b):
    """Several outlets retell one announcement: treat close headlines within 3 days as one item."""
    da, db = dt.date.fromisoformat(a['date']), dt.date.fromisoformat(b['date'])
    if abs((da - db).days) > 3:
        return False
    wa, wb = words(a['title']), words(b['title'])
    return bool(wa and wb) and len(wa & wb) / min(len(wa), len(wb)) >= 0.5


def main():
    old = {'items': []}
    if os.path.exists(OUT):
        old = json.load(open(OUT, encoding='utf-8'))
    found, ok = [], 0
    for url in FEEDS:
        try:
            found += [it for it in parse(fetch(url)) if relevant(it)]
            ok += 1
        except Exception as e:  # one dead source must not stop the others
            print(f'skip {url[:70]}: {type(e).__name__}', file=sys.stderr)
    if not ok:
        print('no source reachable, news.json left as is')
        return

    cutoff = (dt.date.today() - dt.timedelta(days=MAX_AGE_DAYS)).isoformat()
    items = []
    for it in old['items'] + found:          # stored items first: their tags and links stay stable
        if it['date'] < cutoff or any(it['url'] == x['url'] or same_story(it, x) for x in items):
            continue
        it.pop('home', None)
        it['tag'] = next((k for k, rx in TAGS if rx.search(it['title'])), 'news')
        items.append(it)
    items.sort(key=lambda x: x['date'], reverse=True)
    items = items[:KEEP]

    data = {'updated': dt.date.today().isoformat(), 'items': items}
    if data['items'] == old.get('items') and old.get('updated') == data['updated']:
        print('no changes')
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(items)} items ({len(found)} matches from {ok}/{len(FEEDS)} sources)')


if __name__ == '__main__':
    main()
