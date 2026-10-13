# MINI GES: AI video, master prompt (ComfyUI)

Bu fayl videokartasi bor odam uchun. Maqsad: Andijondagi haqiqiy mini-GES (kanal yonidagi derivatsion stansiya)
haqida realistik, 9:16 vertikal, 6 kadrli (har biri 5–8 s) video yasash. Promptlar ingliz tilida, chunki modellar
inglizchani yaxshi tushunadi.

Papkada:
- `references/`: obyektning haqiqiy rasmlari (12 ta). Har bir faylning nomi qaysi kadr uchun ekanini bildiradi.
- `prompts.md`: Google Veo uchun qisqa variant (taqqoslash uchun).

---

## 1. Ish tartibi (eng ishonchli yo'l)

Matndan to'g'ridan-to'g'ri video (T2V) bir urinishda obyektga o'xshamaydi. Shuning uchun 2 bosqichda qilinadi:

1. **Kalit kadr (rasm):** Z-Image Turbo bilan har bir kadr uchun 720×1280 rasm.
   `references/` dagi haqiqiy rasm **img2img** sifatida beriladi (Load Image → VAE Encode → KSampler `latent_image`),
   `denoise` 0.50–0.65. Kichikroq denoise bo'lsa obyekt saqlanadi, kattaroq bo'lsa toza va chiroyli bo'ladi.
   Har bir kadrga 4–8 ta seed sinab, eng yaxshisini tanlang.
2. **Jonlantirish (video):** tanlangan rasm **Wan 2.2 Image-to-Video** ga beriladi va qisqa harakat prompti yoziladi.
   Har bir kadrga 2–4 ta urinish qiling.
3. **Silliqlash:** RIFE (ComfyUI-Frame-Interpolation) bilan 16 → 32 fps; xohlasa 2× upscale.
4. Tayyor kliplarni (MP4, ovozsiz bo'lsa ham bo'ladi) bizga yuboring: montaj, logotip, yozuv va ovozni biz qo'shamiz.

### Tavsiya etilgan sozlamalar

| Bosqich | Model | Sozlama |
|---|---|---|
| Rasm | `z_image_turbo_bf16.safetensors` (+ Qwen3-4B text encoder, VAE: `ae.safetensors`) | 720×1280, steps 8, cfg 1.0, sampler `res_multistep`, scheduler `simple`, shift 3, img2img denoise 0.5–0.65 |
| Video, 16 GB+ VRAM | Wan 2.2 I2V A14B (high + low noise, fp8) + Lightx2v 4-step LoRA, VAE `wan_2.1_vae` | 720×1280 (sekin bo'lsa 480×832), 81 kadr, 16 fps, 4+4 qadam, cfg 1 |
| Video, 8–12 GB VRAM | Wan 2.2 TI2V 5B, VAE `wan2.2_vae` | 704×1280, 121 kadr, 24 fps, 20–30 qadam, cfg 5 |

> Skrinshotdagi workflow'da Z-Image uchun `wan_2.1_vae` tanlangan. Z-Image Flux VAE'si (`ae.safetensors`) bilan
> ishlaydi: rasm g'alati rangda chiqsa, avval shuni tekshiring.

---

## 2. Obyekt pasporti (har bir promptning asosi)

Model nimani chizishini bilishi uchun obyekt aniq shunday (rasmlarga qarang):

- **Joy:** Farg'ona vodiysining tekis yeri, O'zbekiston. Atrofda tik o'sgan terak qatorlari, paxta va bug'doy dalalari,
  ochiq moviy osmon, yozgi kunduzgi yorug'lik. **Tog' yo'q, to'g'on yo'q, suv ombori yo'q.**
- **Asosiy kanal: KATTA FARG'ONA KANALI.** Bu kichik ariq emas: juda keng (taxminan 30–40 m), qiya beton
  qirg'oqli, ikki yonida xizmat yo'li bo'lgan magistral kanal; ko'p suv kuchli va tez oqadi. Bizning GES shu kanalning
  yonida, uning suvining bir qismini oladi. Videoda kanal **katta va qudratli**, stansiya esa uning yonida kichikroq
  ko'rinishi kerak (masshtab muhim).
- **Suv qabul qilgich:** kanal yonidan silliq yoy bilan ajraladi. Chuqur to'rtburchak beton kamera. Ichida qiya
  turgan, qora po'lat sterjenlardan iborat **chiqindi tutuvchi panjara (filtr)**, keyin **kulrang po'lat zatvor,
  ikki tomonida katta qizil g'ildiraklar**, ustida **sariq ko'targich rama** (zanjir bilan ko'tariladi).
- **Derivatsiya kanali:** ~400 m uzun, tekis, to'rtburchak kesimli, silliq kulrang beton devorli kanal; ikki chetida teraklar.
- **Stansiya binosi:** temir-beton karkasli bino (kulrang beton ustunlar va to'sinlar), ichida **qizil ko'prik
  krani to'sini**. Tashqi qoplama: ko'k metall panellar.
- **Turbinalar:** zal pastida, beton chuqurda **ikkita gorizontal (qiya) kapsulali turbina**. Korpusi **ko'k, qovurg'ali
  po'lat**, ichida **4 parrakli bronza-po'lat ishchi g'ildirak, markazi qizil**. Generator turbina o'qida.
- **Chiqish:** turbinalardan suv ikki teshikdan oq ko'pik bo'lib chiqadi va qisqa beton kanal orqali asosiy kanalga qaytadi.
- **Podstansiya:** bino yonida ochiq taqsimlash qurilmasi: rux bilan qoplangan dumaloq po'lat ustunlar beton poydevorda,
  ko'ndalang to'sinlar, jigarrang chinni izolyatorlar. Undan dalalar ustidan elektr uzatish liniyalari qishloqqa boradi.

---

## 3. Umumiy uslub va salbiy prompt

**STYLE (har bir rasm va video promptining oxiriga qo'shing):**

```text
photorealistic, shot on a professional drone / cinema camera, 35mm lens, natural summer daylight, soft haze, high
dynamic range, realistic concrete texture with stains and formwork marks, realistic water physics with foam and
reflections, flat Fergana Valley landscape in Uzbekistan, rows of tall poplar trees, cotton fields, clear blue sky,
documentary industrial film look, sharp focus, 9:16 vertical composition
```

**NEGATIVE (rasm va video uchun):**

```text
mountains, dam, reservoir, small ditch, narrow stream, waterfall, vertical turbine, wind turbine, cartoon, anime, 3d render, CGI look, plastic,
toy, miniature, tilt-shift, text, letters, watermark, logo, subtitles, people in foreground, faces, distorted
geometry, melting structures, warped bars, extra wheels, blurry, low quality, oversaturated, flickering, jitter,
morphing, duplicated objects, static frame
```

---

## 4. Kadrlar (6 ta)

Har bir kadrda: **A**: rasm prompti (Z-Image), **B**: harakat prompti (Wan I2V), **R**: qaysi haqiqiy rasm, denoise.

### Kadr 1: dron, kanal va suv qabul qilgich (8 s)

**R:** `references/shot1-3_derivatsiya-kanali.jpg` (yoki `shot1-6_bino-va-ikki-suv-yoli.jpg`), denoise 0.65.

**A:**
```text
High aerial drone view of the Great Fergana Canal, a huge main irrigation canal about 35 meters wide with sloped
concrete-lined banks and service roads along both sides, carrying a massive, powerful, fast flow of green-brown water
through flat green farmland. On the right bank, much smaller in scale, a side intake branches off in a smooth gentle curve into a deep rectangular concrete headworks with two grey steel
gates fitted with large red wheels under a bright yellow steel hoist frame. Beyond the gates a long straight concrete
channel with smooth grey walls runs away across the fields toward a small blue-clad industrial building on the
horizon. Rows of tall poplar trees line both channels, cotton fields on both sides, morning sun. + STYLE
```

**B:**
```text
Slow cinematic drone descent along the huge canal, then a gentle push toward the intake gates. The wide canal carries
a massive fast current; part of it turns smoothly into the side intake. Poplar leaves sway lightly in the wind. Smooth stable camera, no cuts.
```

### Kadr 2: filtr (panjara) va zatvor (8 s)

**R:** `references/shot2_filtr-panjara.jpg` (panjara), `shot2_zatvor-qizil-gildirak.jpg` (zatvor), denoise 0.55.
Ikkita alohida klip qilsa ham bo'ladi: 2a panjara, 2b zatvor.

**A (2a):**
```text
Inside a deep rectangular concrete intake chamber, a tall steeply inclined trash rack made of evenly spaced dark steel
vertical bars with horizontal steel braces spans the full width. Clear green water flows through the bars, a few
leaves and small twigs are caught on them. Wet concrete walls with formwork marks, daylight from above. + STYLE
```

**B (2a):**
```text
Water flows steadily through the steel bars of the trash rack, small leaves tremble on the bars, ripples and light
reflections move on the surface. Camera slowly tilts up along the inclined rack. Bars stay perfectly straight and rigid.
```

**A (2b):**
```text
A heavy rectangular grey steel sluice gate with two large bright red wheels on each side, hanging in concrete side
slots of an intake chamber, lifted by chains from a yellow steel hoist frame above. Water rushes under the gate in a
smooth powerful flow with white foam. Poplar trees behind, blue sky. + STYLE
```

**B (2b):**
```text
The steel gate slowly rises on its chains, the red wheels roll along the concrete slots, water bursts out from under
the gate and accelerates into the channel with foam and spray. Slow push-in camera.
```

### Kadr 3: derivatsiya kanali (8 s)

**R:** `references/shot1-3_derivatsiya-kanali.jpg`, denoise 0.6 (rasmda kanal bo'sh: promptda suv to'la deb yozilgan).

**A:**
```text
Low angle just above the water inside a long straight rectangular concrete channel completely full of fast flowing
glassy green water, smooth grey concrete walls with formwork lines on both sides, tall poplar trees above the walls.
At the far end the channel meets a reinforced-concrete powerhouse with grey columns and blue metal cladding. + STYLE
```

**B:**
```text
Fast low tracking shot gliding forward just above the racing water toward the powerhouse, poplars passing on both
sides, sunlight sparkling on the surface. Smooth gimbal motion, constant speed.
```

### Kadr 4: turbinalar (8 s)

**R:** `references/shot4_ikki-turbina.jpg`, `shot4_turbina-korpusi.jpg`, `shot4_turbina-zali-yuqoridan.jpg`, denoise 0.5
(rasmlarda qurilish payti: odamlar va armatura bor, promptda ular yo'q deb yozilgan).

**A:**
```text
Inside a clean finished powerhouse hall, two large horizontal bulb turbine units lie side by side in a concrete pit,
each with a long ribbed blue steel casing with bolted flanges, slightly inclined, connected to round penstocks. A red
overhead crane beam spans the hall above, grey concrete columns, industrial lighting mixed with daylight. Clean,
operational, no people. + STYLE
```

**B:**
```text
Slow orbit and push-in around the blue turbine casing. The turbines are running: a subtle vibration, a light mist near
the flanges, a soft hum. The camera moves smoothly, the blue casing keeps its exact shape.
```

**4b, kesim (cutaway), xohlasa:**
```text
Cutaway view of a horizontal bulb turbine: the blue ribbed casing is cut open and reveals a four-blade propeller runner
with broad polished bronze-steel blades and a red hub inside the water passage, water rushing through, engineering
visualization, photorealistic metal. + STYLE
```
```text
The four-blade runner spins fast, water streams through the tube around it, small bubbles, the camera slowly pushes in.
```

### Kadr 5: generator va podstansiya (8 s)

**R:** `references/shot3-5_bino-va-qizil-kran.jpg`, denoise 0.6 (podstansiya rasmi yo'q, prompt bo'yicha).

**A:**
```text
Outdoor substation next to a concrete powerhouse in flat farmland: tall galvanized round steel columns on concrete
plinths, steel crossbeams, three brown porcelain insulators on a steel frame, cables running from the building, a
power transformer, poplar trees and blue sky behind. + STYLE
```

**B:**
```text
Slow sideways dolly along the substation, faint heat shimmer, small electric glow at the insulator tips, power lines
gently swaying, a bird flies across. Realistic, no sparks fireworks.
```

### Kadr 6: suv kanalga qaytadi va qishloqqa tok (8 s)

**R:** `references/shot1-6_bino-va-ikki-suv-yoli.jpg`, `shot4-6_turbina-chiqishi.jpg`, denoise 0.65.

**A:**
```text
Water leaves a concrete powerhouse through two rectangular outlets as white foaming jets and flows along a short curved
concrete channel back into the huge Great Fergana Canal (about 35 m wide, sloped concrete banks), merging with its
powerful current. Golden hour light, long shadows, power
lines run from the plant across the fields toward a village. + STYLE
```

**B:**
```text
The foaming water pours out and rejoins the wide, powerful canal. The camera slowly rises and pulls back into a wide aerial view at
golden hour, power lines lead across the fields to a village where house lights switch on one by one.
```

---

## 5. Ko'p uchraydigan muammolar

- **Panjara sterjenlari qiyshayib "eriydi":** denoise'ni 0.45 ga tushiring, harakat promptiga `bars stay perfectly
  straight and rigid` yozing, kamera harakatini sekinlashtiring.
- **Tog' yoki to'g'on paydo bo'ladi:** NEGATIVE'da borligini tekshiring, promptga `flat land, no mountains` qo'shing.
- **Odamlar chiqib qoladi (rasmlar qurilish paytida olingan):** promptda `no people`, kerak bo'lsa rasmni kesing yoki
  odamni inpaint bilan o'chiring.
- **Multfilmga o'xshaydi:** cfg'ni oshirmang (Z-Image 1.0), STYLE'dagi `documentary`, `realistic concrete texture`
  qismini qoldiring.
- **Turbina rangi o'zgaradi:** promptda rangni aniq yozing: `blue ribbed steel casing`, `red hub`, `red crane beam`.
- **Video qotib qoladi:** harakat promptida kamera harakatini (`slow push-in`, `drone descent`) va suv harakatini
  aniq yozing.
