# MINI GES — sayt

Ulug'nor GES (600 kVt, ishlab turibdi) va Baliqchi GES (1 000 kVt, 2026-yil oktyabr oxirida ishga tushadi)
mini gidroelektrostansiyalarini tanishtiruvchi va mini-GES qurish xizmatini sotuvchi sayt.

**Jonli sayt:** https://linverno-tm.github.io/mini-ges-site/

[![CI / Deploy](https://github.com/linverno-tm/mini-ges-site/actions/workflows/deploy.yml/badge.svg)](https://github.com/linverno-tm/mini-ges-site/actions/workflows/deploy.yml)

## Texnik qarorlar

| Qaror | Sabab |
|---|---|
| Framework'siz statik HTML/CSS/JS | Bitta sahifali marketing sayti: server ham, build zanjiri ham minimal. Istalgan statik hostingda ishlaydi |
| Kutubxonalar repo ichida (`js/vendor`) | CDN'ga bog'liq emas, yuklanish tartibi kafolatlangan, bitta tashqi ulanish kam |
| "Qanday ishlaydi" maketi — generatsiya qilingan izometrik SVG | ~53 KB, har qanday ekranda tiniq, arzon telefonda ham silliq. 3D model (WebGL) 1–3 MB bo'lardi |
| Rasmlar WebP, 2 o'lcham (`srcset`), `loading="lazy"` | Birinchi ochilishda rasm yuklanmaydi, telefon kichik nusxani oladi |
| Hero CSS + JS animatsiyasi, CSS failsafe | Skriptlar yuklanmasa ham sahifa ochiladi (yuklanish ekrani 6 soniyada o'zi yo'qoladi) |
| `prefers-reduced-motion` | Harakatni kamaytirishni yoqqan foydalanuvchilarga animatsiyasiz versiya |
| "Soha yangiliklari" build vaqtida HTML'ga yoziladi | Sahifa ochilganda begona saytga so'rov ketmaydi: tez, CSP buzilmaydi, oflaynda ham ko'rinadi |
| UZ/RU almashtirish yuklanish ekranisiz | `js/boot.js` birinchi kadrdan oldin ishlaydi: o'quvchi turgan bo'limida qoladi |

**Performance budjeti** (telefon, birinchi ochilish): HTML+CSS+JS+shriftlar ≈ 250 KB (gzip bilan ≈ 170 KB), rasm — 0 KB.

## Tuzilishi

```
mini-ges-site/
  index.html            sahifa: barcha matnlar, SEO/OG meta, JSON-LD, CSP
  css/style.css         dizayn tizimi (tokenlar :root da, brendbuk ranglari va shriftlari)
  js/main.js            animatsiyalar va interaktivlik (bo'limlarga ajratilgan)
  js/vendor/            GSAP 3.12.5, ScrollTrigger, Lenis 1.1.13
  assets/               logotiplar, ikonkalar, og-image, galereya, yilnoma, jamoa (WebP)
  404.html  robots.txt  sitemap.xml  manifest.webmanifest  .htaccess
  build.py              production build -> dist/
tools/check_site.py     statik sifat tekshiruvi (CI'da ishlaydi)
tools/i18n.py           tarjima: o'zbekcha manbadan /ru/ sahifasi (lug'at: mini-ges-site/i18n/ru.json)
tools/gen_iso.py        'Qanday ishlaydi' izometrik maketini yaratadi (SVG)
tools/fetch_news.py     'Soha yangiliklari': RSS'dan GES xabarlarini yig'adi -> mini-ges-site/data/news.json
.github/workflows/      CI: tekshiruv -> build -> GitHub Pages
```

## O'zgartirish kiritish va saytga chiqarish

```bash
# 1. mini-ges-site/ ichidagi fayllarni tahrirlang
# 2. lokal tekshiring
python -m http.server 5173 --directory mini-ges-site      # http://localhost:5173
python tools/check_site.py
# 3. yuklang
git add . && git commit -m "O'zgarish tavsifi" && git push
```

Push'dan keyin GitHub Actions ketma-ket ishlaydi:

1. **Quality checks:** JS sintaksisi, HTML validatsiya (`html-validate`), buzilgan havola va rasm,
   takroriy `id`, `alt`siz rasm, yorlig'siz forma maydoni, `rel="noopener"`siz tashqi havola.
2. **Build:** CSS/JS siqiladi, fayllarga versiya qo'shiladi (`?v=hash`), `%SITE_URL%` o'rniga haqiqiy manzil yoziladi.
3. **Deploy:** 1–2 daqiqada jonli saytda.

Tekshiruv o'tmasa, sayt **chiqmaydi**: eski versiya ishlashda davom etadi. Pull request ochilsa, faqat tekshiruv va build ishlaydi.

## Soha yangiliklari

GitHub Actions har kuni soat 06:00 da (Toshkent) `tools/fetch_news.py` ni ishga tushiradi. Skript O'zbekiston
OAV'larining RSS lentalari va Google News qidiruvidan GES haqidagi xabarlarni yig'adi, saralaydi va
`mini-ges-site/data/news.json` ga qo'shadi. Keyin sayt qayta yig'ilib chiqariladi. Faqat sarlavha, manba, sana va
havola saqlanadi, havola asl maqolaga olib boradi.

- Hozir yangilash: repo → **Actions → CI / Deploy → Run workflow**.
- Manbalar, kalit so'zlar va mavzular (`TAGS`) — `tools/fetch_news.py` boshida.
- Bitta manba ishlamasa, qolganlari bilan davom etadi; birortasi ham ochilmasa, eski ro'yxat qoladi.

## Domen ulash (domen sotib olingandan keyin)

1. `mini-ges-site/build.py` dagi `SITE_URL` ni yangi manzilga o'zgartiring, masalan: `https://miniges.uz/`.
   Canonical, Open Graph, JSON-LD, sitemap, robots va 404 sahifasi shundan o'zi yangilanadi.
2. Domen panelida (DNS):
   - `@` uchun 4 ta `A` yozuvi: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www` uchun `CNAME` yozuvi: `linverno-tm.github.io`
3. Repo → **Settings → Pages → Custom domain** ga domenni yozing, **Enforce HTTPS** ni yoqing.

`robots.txt` va `sitemap.xml` qidiruv tizimlari uchun faqat domen ildizida ishlaydi, shuning uchun to'liq kuchga domen ulangandan keyin kiradi.

## Boshqa hostingga yuklash

```bash
python mini-ges-site/build.py          # Node.js va Python kerak
```

`mini-ges-site/dist/` ichidagi hamma narsani (`.htaccess` bilan) hosting ildiziga yuklang.
`.htaccess` gzip, kesh va xavfsizlik sarlavhalarini sozlaydi (Apache).

## Muhim sozlamalar

- **Baliqchi GES ishga tushish sanasi:** `js/main.js` boshidagi `LAUNCH`. Sana o'tgach, hisoblagichlar o'zi "Ishga tushirildi" ga almashadi.
- **Kalkulyator koeffitsiyentlari:** `js/main.js` dagi `CALC` (FIK, yillik yuklama, xonadon iste'moli, CO₂).
- **Ariza qabul qiluvchi Telegram:** `js/main.js` dagi `t.me/ozodbekov`.

## Litsenziya

Barcha huquqlar MINI GES'ga tegishli, batafsil — [LICENSE](LICENSE).
