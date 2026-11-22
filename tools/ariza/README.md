# Arizalar Telegram botga

Saytdagi «Ariza qoldirish» formasi ma'lumotni shu Cloudflare Worker'ga yuboradi, Worker esa uni bot orqali Telegram'ga tashlaydi.
Mijoz Telegram'da «Yuborish»ni bosmasa ham ariza keladi. Worker ishlamasa, forma eskicha ishlaydi: Telegram chat ariza matni bilan ochiladi.

## Bir martalik sozlash

1. **Bot.** Telegram'da @BotFather → `/newbot` → nom bering (masalan «MINI GES arizalar»). U bergan tokenni hech kimga ko'rsatmang.
2. **Qabul qiluvchi.** Arizalar kimga kelsin:
   - bitta odamga: o'sha odam botga `/start` yozadi;
   - bir nechta odamga: Telegram guruh oching, botni va Doniyorbek Ozodbekovni qo'shing, guruhga bitta xabar yozing.

   Keyin brauzerda `https://api.telegram.org/bot<TOKEN>/getUpdates` ni oching va `"chat":{"id": ...}` dagi raqamni oling (guruh uchun minus bilan boshlanadi).
3. **Cloudflare.** Shu papkada (`tools/ariza`) terminal oching:

   ```powershell
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put TG_TOKEN
   npx wrangler secret put TG_CHAT
   ```

   `TG_CHAT` ga 2-qadamdagi raqam(lar)ni vergul bilan yozasiz. Deploy `https://mini-ges-ariza.<akkaunt>.workers.dev` manzilini beradi.
4. **Sayt.** `mini-ges-site/js/main.js` dagi `LEAD_API` ga shu manzilni yozing va `index.html` dagi CSP `connect-src` ga qo'shing. Keyin push qiling.

## Tekshirish

```powershell
curl.exe -X POST https://mini-ges-ariza.<akkaunt>.workers.dev -H "Origin: https://linverno-tm.github.io" -H "Content-Type: text/plain" --data '{\"name\":\"Test\",\"phone\":\"+998 90 000 00 00\",\"region\":\"Andijon viloyati\"}'
```

`{"ok":true}` qaytsa va Telegram'ga xabar kelsa, hammasi joyida.

## Himoya

- Faqat `ALLOWED_ORIGINS` dagi saytlardan qabul qiladi (`wrangler.jsonc`). Domen o'zgarsa, shu ro'yxatga qo'shing.
- Bitta IP'dan daqiqasiga 5 tadan ko'p ariza o'tmaydi.
- Formada robotlar uchun yashirin maydon (`website`) bor: u to'ldirilgan bo'lsa, xabar yuborilmaydi.
- Xabar oddiy matn bo'lib ketadi, mijoz yozgan narsa formatlashga aylanmaydi.
