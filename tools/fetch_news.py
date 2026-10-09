"""Collects hydro-power news about Uzbekistan for the "Soha yangiliklari" section.

Usage:  python tools/fetch_news.py          ->  updates mini-ges-site/data/news.json

Sources: the Uzbek outlets' own RSS feeds (fresh, direct links), the site search of Kun.uz and
Daryo.uz (Uzbek-language archive; both robots.txt allow it, Gazeta.uz forbids search pages so only
its RSS is used), and Google News searches (Russian-language coverage, several months back).
Only the headline, outlet, date and link are stored; the page links to the original article.
Items accumulate across runs, so a quiet day never empties the section. A source that fails is
skipped; the script never fails the build. CI runs it every 3 hours (.github/workflows/deploy.yml).
"""
import datetime as dt, email.utils, html, json, os, re, sys, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'mini-ges-site', 'data', 'news.json')
KEEP, MAX_AGE_DAYS = 90, 365

def gnews(q, hl):
    return 'https://news.google.com/rss/search?' + urllib.parse.urlencode(
        {'q': f'{q} when:365d', 'hl': hl, 'gl': 'UZ', 'ceid': f'UZ:{hl}'})

# direct feeds first: on duplicates their links (straight to the outlet) win
FEEDS = [
    # Uzbek (Latin and Cyrillic)
    'https://www.gazeta.uz/oz/rss/', 'https://www.gazeta.uz/uz/rss/', 'https://kun.uz/news/rss', 'https://daryo.uz/feed/',
    'https://uza.uz/oz/rss', 'https://uza.uz/uz/rss', 'https://xabar.uz/rss', 'https://www.uzdaily.uz/uz/rss',
    'https://www.spot.uz/oz/rss/', 'https://review.uz/oz/rss', 'https://aniq.uz/rss', 'https://zamin.uz/rss',
    # Russian
    'https://www.gazeta.uz/ru/rss/', 'https://www.spot.uz/rss/', 'https://uza.uz/ru/rss',
    'https://podrobno.uz/rss/', 'https://www.uzdaily.uz/ru/rss', 'https://nuz.uz/feed',
    gnews('малые ГЭС Узбекистан', 'ru'), gnews('микроГЭС Узбекистан', 'ru'), gnews('ГЭС Узбекистан', 'ru'),
    gnews('mikroGES', 'uz'), gnews('kichik GES', 'uz'), gnews('gidroelektr stansiya', 'uz'),
]

# Site search pages (HTML): Uzbek words take suffixes (GESlar, GESni), RSS keeps only a day or two
SEARCH_QUERIES = ['GES', 'kichik GES', 'mikro GES', 'gidroenergetika', 'gidroelektrostansiya']
SEARCH = [  # (url template, article link pattern, site root, outlet)
    ('https://kun.uz/search?q={}', re.compile(r'^/news/(\d{4})/(\d{2})/(\d{2})/[\w-]+$'), 'https://kun.uz', 'Kun.uz'),
    ('https://daryo.uz/search?q={}', re.compile(r'^/(\d{4})/(\d{2})/(\d{2})/[\w-]+/?$'), 'https://daryo.uz', 'Daryo.uz'),
]
NAMES = {'kun.uz': 'Kun.uz', 'daryo.uz': 'Daryo.uz', 'gazeta.uz': 'Gazeta.uz', 'spot.uz': 'Spot.uz', 'uza.uz': 'UZA.uz',
         'podrobno.uz': 'Podrobno.uz', 'uzdaily.uz': 'UzDaily.uz', 'nuz.uz': 'Nuz.uz', 'xabar.uz': 'Xabar.uz',
         'review.uz': 'Review.uz', 'aniq.uz': 'Aniq.uz', 'zamin.uz': 'Zamin.uz'}

HYDRO = re.compile(r'ГЭС|ГЕС|гидроэлектр|гидроэнерг|\bGES|mikroGES|gidroelektr|gidroenerg|закупочн\w* тариф', re.I)
UZBEK = re.compile(r'Узбек|Ўзбек|O.?zbek|Uzbek|Ташкент|Toshkent|Андижан|Andijon|Наманган|Namangan|Ферган|Farg|Сурхандар|Surxondar|Кашкадар|Qashqadar|Самарканд|Samarqand|Бухар|Buxoro|Хорезм|Xorazm|Джизак|Jizzax|Навои|Navoiy|Сырдар|Sirdaryo|Каракалпак|Qoraqalpo|Чирчик|Chirchiq|Пскем|Сох', re.I)
# the audience builds small plants: regional mega-projects and grid incidents abroad are noise here
NOISE = re.compile(r'Камбар|Kambar|Qambar|kutubxona|библиотек|ESG|yilligi|юбилей|tayinlandi|назначен|Рогун|Rog.?un|Токтогул|Toktog|Кайраккум|Qayroqqum|блэкаут|blackout|АЭС|\bAES\b|железн|temir yo', re.I)
# plants abroad: kept only when the headline also ties them to Uzbekistan
FOREIGN = re.compile(r'Xitoy|Китай|Moldov|Молдов|Tojik|Таджик|Qirg.?iz|Кыргыз|Киргиз|Qozog|Казах|Rossiya|Росси|Afg.?on|Афган|Hindiston|Инди|Turkiya|Турци|Eron|Иран|Gruziya|Грузи|Pokiston|Пакистан|Nepal|Непал|Braziliya|Бразил|Efiopiya|Эфиоп|Misr|Египет|Dag.?iston|Дагестан|Norvegiya|Норвег|Shveytsar|Швейцар|AQSH|США|Yevropa|Европ', re.I)
SMALL = re.compile(r'мал\w* (?:и микро)?ГЭС|мал\w* и микро|микро\s?ГЭС|микрогидро|малой гидро|kichik GES|mikro\s?GES|kichik gidro|кичик ГЭС', re.I)
TAGS = [  # first match wins
    ('tariff', re.compile(r'тариф|tarif|закупочн|narx|sotib olin', re.I)),
    ('law', re.compile(r'постановлен|указ\b|закон|правил|услови|льгот|субсид|поддерж|механизм|мер[ыау]? по|аукцион|земл|президент|Мирзиёев|qaror|farmon|qonun|imtiyoz|subsidiya|Prezident|Mirziyoyev|soddalashtir|tartib|sharoit|chora|yer ol|chek qo|reja', re.I)),
    ('invest', re.compile(r'инвест|investi|кредит|kredit|банк|\bJBIC\b|\bADB\b|\$|млрд|mlrd|dollar', re.I)),
    ('project', re.compile(r'запуст|ввод|введ|строят|строительств|построен|выработку|площад|станци|ishga tush|quril|qurib|bitkaz|foydalanishga|uskuna', re.I)),
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
            host = re.sub(r'^(?:www|oz|uz)\.', '', urllib.parse.urlsplit(link).hostname or '')
            source = NAMES.get(host, host)
        try:
            when = email.utils.parsedate_to_datetime(date).astimezone(dt.timezone.utc)
        except (TypeError, ValueError):
            continue
        if not title or not link.startswith('https://'):
            continue
        yield {'title': title, 'url': link, 'source': source, 'home': home,
               'date': when.strftime('%Y-%m-%d'), 'lang': lang_of(title)}


def parse_search(page, pattern, base, outlet):
    """Article links on a search results page; the date comes from the URL (/2026/08/26/slug)."""
    best = {}
    for href, inner in re.findall(r'<a[^>]+href="([^"#?]+)"[^>]*>(.*?)</a>', page, re.S):
        href = href.replace(base, '')
        if not pattern.match(href):
            continue
        # cards append reading time / timestamps: "... 2 daq · 23-Sen, 13:45", "... 13:38 / 23.09.2026"
        t = text(re.sub(r'<[^>]+>', ' ', inner))
        t = re.split(r'\d+\s*daq\b|\d{1,2}:\d{2}\s*/\s*\d{1,2}\.\d{2}\.\d{4}|\s\d{1,2}-[A-Za-z]{3}[ ,]', t)[0].strip(' ·|')
        if len(t) >= 20 and len(t) > len(best.get(href, '')):
            best[href] = t
    for href, t in best.items():
        y, mo, d = pattern.match(href).groups()
        yield {'title': t, 'url': base + href, 'source': outlet, 'home': base + href,
               'date': f'{y}-{mo}-{d}', 'lang': lang_of(t)}


def relevant(it, stored=False):
    t = it['title']
    if not HYDRO.search(t) or NOISE.search(t) or (FOREIGN.search(t) and not UZBEK.search(t)):
        return False
    if stored:      # passed the outlet check when it was collected
        return True
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
    for tpl, pattern, base, outlet in SEARCH:
        for q in SEARCH_QUERIES:
            url = tpl.format(urllib.parse.quote(q))
            try:
                found += [it for it in parse_search(fetch(url), pattern, base, outlet) if relevant(it)]
                ok += 1
            except Exception as e:
                print(f'skip {url[:70]}: {type(e).__name__}', file=sys.stderr)
    if not ok:
        print('no source reachable, news.json left as is')
        return

    cutoff = (dt.date.today() - dt.timedelta(days=MAX_AGE_DAYS)).isoformat()
    items = []
    stored = [it for it in old['items'] if relevant(it, stored=True)]   # filter changes apply to old items too
    for it in stored + found:                # stored items first: their links stay stable
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
    uz = sum(i['lang'] == 'uz' for i in items)
    print(f'{len(items)} items, {uz} in Uzbek ({len(found)} matches, {ok} requests ok)')


if __name__ == '__main__':
    main()
