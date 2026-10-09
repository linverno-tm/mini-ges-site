# MINI GES — sayt

Ulug'nor GES va Baliqchi GES mini gidroelektrostansiyalarini tanishtiruvchi va xizmatlarni sotuvchi sayt.

**Jonli sayt:** https://linverno-tm.github.io/mini-ges-site/

## Tuzilishi

```
mini-ges-site/
  index.html        sahifa (barcha matnlar shu yerda)
  css/style.css     dizayn
  js/main.js        animatsiyalar va interaktivlik
  js/vendor/        GSAP, ScrollTrigger, Lenis (saytning o'zida, CDN'siz)
  assets/           logotiplar, galereya, yilnoma va maket suratlari (WebP)
  build.py          production build: siqish + kesh versiyasi -> dist/
.github/workflows/deploy.yml   har push'da avtomatik deploy
```

## O'zgartirish kiritish va saytga chiqarish

1. `mini-ges-site/` ichidagi fayllarni tahrirlang (matn — `index.html`, dizayn — `css/style.css`).
2. GitHub'ga yuklang:

   ```bash
   git add .
   git commit -m "Saytdagi o'zgarish tavsifi"
   git push
   ```

3. GitHub Actions saytni o'zi yig'adi va 1–2 daqiqada jonli saytga chiqaradi.
   Jarayonni repo'ning **Actions** bo'limida kuzatish mumkin.

## Lokal ko'rish

```bash
python -m http.server 5173 --directory mini-ges-site
```

So'ng brauzerda http://localhost:5173 ni oching.

## Lokal build (ixtiyoriy)

Node.js va Python kerak:

```bash
python mini-ges-site/build.py
```

Natija `mini-ges-site/dist/` papkasida — uni istalgan hostingga ham yuklash mumkin (`.htaccess` gzip va keshni sozlaydi).

## minigesuz.uz domenini ulash

1. Domen panelida (DNS) yozuvlar qo'shing:
   - `A` yozuvlari `@` uchun: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` yozuvi `www` uchun: `linverno-tm.github.io`
2. Repo → **Settings → Pages → Custom domain** ga `minigesuz.uz` yozib saqlang va **Enforce HTTPS** ni yoqing.

## Muhim sanalar

- Baliqchi GES ishga tushish sanasi `js/main.js` boshidagi `LAUNCH` o'zgaruvchisida (hozir 2026-yil 31-oktabr).
  Sana o'tgach, hisoblagichlar o'zi "Ishga tushirildi" ga almashadi.
