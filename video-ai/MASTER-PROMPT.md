# MINI GES: maketni realistik kadrlarga aylantirish (ComfyUI), 2-versiya

**Vazifa:** saytimizdagi izometrik maketning 6 ta ko'rinishini (`maket/` papkasi) xuddi shu joylashuvda
**fotorealistik dron kadrlariga** aylantirish va har birini 5–8 soniyalik videoga jonlantirish. Kadrdagi narsalar
maketdagi joyida qolishi kerak: kanal, suv qabul qilgich, 400 metrlik yoysimon o'zan, stansiya, podstansiya, qishloq.
Shunda saytda maket o'rnida obyektimizning «haqiqiy» ko'rinishi chiqadi.

Papkada:
- `maket/maket-0.jpg … maket-5.jpg`: **asosiy kirish rasmlari** (1920×1080). Raqam saytdagi bosqich raqami bilan bir xil.
- `references/`: obyektning haqiqiy rasmlari. Rang va detallarni shu rasmlardan oling (ko'k turbinalar, qizil
  g'ildirakli zatvor, beton, teraklar).
- Eski 1-versiyadagi 9:16 kadrlar **endi kerak emas**.

---

## 0. Avval tozalash (kompyuter qotmasligi uchun)

1. ComfyUI'dagi navbatni tozalang (**Queue → Clear**) va ComfyUI'ni to'liq yopib, qayta ishga tushiring.
2. Eski natijalarni `ComfyUI/output/` papkasidan boshqa joyga ko'chiring yoki o'chiring (1-versiya kadrlari).
   Eski workflow'larni yoping: faqat 2 ta workflow qoladi, **Rasm** va **Video**.
3. ComfyUI'ni xotirani tejaydigan rejimda ishga tushiring:
   - 12 GB va undan kam VRAM: `--lowvram --disable-smart-memory`
   - 16–24 GB: `--normalvram`
4. Ish paytida brauzerda faqat ComfyUI ochiq tursin (YouTube, o'yinlar va boshqa dasturlar yopilsin).
5. Rasm bosqichidan video bosqichiga o'tishda ComfyUI menyusidagi **Unload Models / Free model and node cache**
   tugmasini bosing, shunda xotira bo'shaydi.
6. Har doim **batch size 1**, bir vaqtda bitta vazifa.
7. Avval kichik o'lchamda sinang (rasm 1280×720, video 832×480). Kadr yoqsa, keyin kattaroq qiling.
8. Video bosqichida **VAE Decode (Tiled)** node'ini ishlating: oddiy VAE Decode xotirani to'ldiradi.

---

## 1. Ish tartibi

**1-bosqich, rasm (maket → foto):** Z-Image Turbo, img2img.
`Load Image (maket-N.jpg)` → `ImageScale 1280×720` → `VAE Encode` → `KSampler latent_image`.

| Sozlama | Qiymat |
|---|---|
| steps / cfg | 8 / 1.0 |
| sampler / scheduler | `res_multistep` / `simple`, shift 3 |
| denoise | **0.70** dan boshlang, natijaga qarab 0.65 yoki 0.80 |
| VAE | `ae.safetensors` (Flux VAE; `wan_2.1_vae` emas) |

- Har bir kadrga 4–6 seed sinang, maketga eng mos va eng real chiqqanini tanlang.
- Denoise kam bo'lsa, rasm multfilmligicha qoladi. Ko'p bo'lsa, joylashuv buziladi. Maqsad: joylashuv maketdagidek, ko'rinishi esa foto.
- Tayyor rasmni `bosqich-N.png` deb saqlang.

**2-bosqich, video:** tanlangan `bosqich-N.png` → Wan 2.2 Image-to-Video, **16:9**.

| VRAM | Model | O'lcham | Kadrlar |
|---|---|---|---|
| 16 GB+ | Wan 2.2 I2V A14B fp8 (high + low noise) + Lightx2v 4-step LoRA, VAE `wan_2.1_vae` | 1280×720 (sinov uchun 832×480) | 81 kadr, 16 fps, 4+4 qadam, cfg 1 |
| 8–12 GB | Wan 2.2 TI2V 5B, VAE `wan2.2_vae` | 1280×704 | 121 kadr, 24 fps, 20–30 qadam, cfg 5 |

Har bir kadrga 2–3 urinish qiling. Kamera harakati **sekin** bo'lsin: maketdagi joylashuv buzilmasin.

---

## 2. Umumiy uslub va salbiy prompt

**STYLE (har bir rasm va video promptining oxiriga):**
```text
photorealistic aerial drone photograph, high oblique view about 45 degrees, real materials: weathered concrete with
stains, real water with ripples, reflections and foam, real grass, soil and crops, tall Lombardy poplar trees, natural
summer daylight, soft haze, flat Fergana Valley farmland in Uzbekistan, shot on DJI Mavic 3, 24mm, high detail,
documentary realism
```

**NEGATIVE:**
```text
isometric, illustration, cartoon, 3d render, CGI, game graphics, flat colors, low poly, miniature, toy, tilt-shift,
text, letters, numbers, labels, watermark, logo, glowing icons, lightning symbols, mountains, dam, reservoir,
waterfall, vertical turbine, people, distorted geometry, melting, blurry, oversaturated, flicker, morphing
```

---

## 3. Obyekt pasporti (promptlar shunga asoslangan)

- **Asosiy kanal: KATTA FARG'ONA KANALI.** Juda keng (~35 m), qiya beton qirg'oqli, ikki yonida yo'l bor, suv kuchli
  oqadi. Uzoq qirg'oq bo'ylab tik teraklar qatori, orqasida dalalar. Bizning stansiya kanalga nisbatan **kichik**.
- **Suv qabul qilgich:** kanaldan silliq ajraladi. Beton bosh inshoot, ustida **sariq po'lat ko'targich rama**,
  ichida **kulrang po'lat zatvor, qizil g'ildiraklar bilan**, oldida qiya qora panjara (filtr).
- **Derivatsiya kanali:** ~400 m, to'rtburchak kesimli silliq kulrang beton o'zan. Yashil va sariq dalalar orasidan
  **katta yoy** chizib stansiyaga boradi, chetida yosh teraklar.
- **Stansiya:** kichik temir-beton karkasli bino, ko'k-kulrang devor panellari. Maketda bino **kesib ochilgan
  (cutaway)**: ichida **ikkita gorizontal ko'k qovurg'ali turbina**, uchida 4 parrakli g'ildirak va **qizil markaz**,
  ustida generator bloklari, tepasida **sariq ko'prik krani relsi**.
- **Chiqish:** bino ostidan ikki teshikdan oq ko'pikli suv chiqadi, qisqa egri beton o'zan bilan kanalga qaytadi.
- **Podstansiya:** bino yonida, beton maydonchada transformator, jigarrang chinni izolyatorlar, rux bilan qoplangan
  ustunlar. Undan po'lat panjarali tayanchlardagi elektr liniyasi qizil tomli uylari bor qishloqqa boradi.

---

## 4. Kadrlar

Har bir kadrda: **A**: rasm prompti (Z-Image img2img, kirish: `maket-N.jpg`), **B**: video harakat prompti (Wan I2V).

### Kadr 0: umumiy ko'rinish (`maket-0.jpg`)
**A:**
```text
High aerial oblique drone photo of a small run-of-canal hydropower plant beside the huge Great Fergana Canal. The wide
concrete-lined canal crosses the frame diagonally from top left to bottom right, a long row of tall poplars along its
far bank and fields beyond. On the near bank, at the right, a small concrete intake with a yellow steel hoist frame
lets part of the water into a narrow concrete derivation channel that curves in a long gentle arc across green and
golden crop fields toward a small concrete powerhouse at the upper left; from the powerhouse a short channel returns
the water into the canal. Next to the powerhouse a small substation; a power line on steel lattice towers runs to a
small village of red-roofed houses at the far left. + STYLE
```
**B:**
```text
Very slow drone glide forward and slightly down over the whole scheme. Water flows fast in the wide canal and along the
arched channel, poplar leaves move in a light wind, shadows of small clouds drift over the fields. Stable camera.
```

### Kadr 1: suv qabul qilgich (`maket-1.jpg`)
**A:**
```text
Close aerial drone photo of the point where a narrow concrete derivation channel branches off the huge Great Fergana
Canal. A concrete headworks with a tall yellow steel hoist frame stands over a grey steel sluice gate with red wheels;
in front of it a dark inclined steel trash rack. The wide canal with sloped concrete banks fills the upper right, a row
of tall poplars and a golden wheat field along its far bank. Grass and a few small trees on the near bank. + STYLE
```
**B:**
```text
Slow push-in toward the yellow hoist frame. Part of the canal current turns smoothly into the side channel, small
ripples and foam at the gate, leaves on the water drift into the trash rack. Stable camera.
```

### Kadr 2: derivatsiya kanali (`maket-2.jpg`)
**A:**
```text
Aerial drone photo looking along a 400 meter long narrow concrete derivation channel that runs in a long smooth arc
between green and golden crop fields with a line of young poplars along it, from a small intake on the huge canal at
the right toward a small concrete powerhouse with a substation at the top left. The wide Great Fergana Canal runs
parallel along the top of the frame with tall poplars on its far bank. + STYLE
```
**B:**
```text
Slow lateral drone move following the channel from right to left; fast glassy water races along the arched channel
toward the powerhouse, crops sway gently. Stable camera, the channel keeps its shape.
```

### Kadr 3: stansiya va turbinalar (`maket-3.jpg`)
**A:**
```text
Aerial drone photo, architectural cutaway visualization made photorealistic: a small reinforced-concrete powerhouse
with its front wall and roof cut open, revealing inside two large horizontal blue ribbed steel bulb turbines lying side
by side, each ending in a round face with a four-blade bronze runner and a red hub, grey generator blocks on top, a
yellow overhead crane rail along the walls. Water from the channel behind the building enters with white foam, and
leaves through two outlets below into a short concrete channel. On the left a small substation with a transformer,
brown porcelain insulators and galvanized steel posts. Real concrete, real steel, real water. + STYLE
```
**B:**
```text
Slow orbit to the right around the open powerhouse. The two turbine runners spin, water foams at the inlet and pours
out of the outlets, a faint heat shimmer over the transformer. Stable camera, the building keeps its exact shape.
```

### Kadr 4: generator va podstansiya (`maket-4.jpg`)
**A:**
```text
Aerial drone photo of a small concrete powerhouse beside the huge Great Fergana Canal, front cut open to show two blue
horizontal turbines with red hubs and generators on top. Next to it an outdoor substation on a concrete pad:
transformer, brown porcelain insulators, galvanized round steel posts and crossbeams. From the substation a power line
on two steel lattice towers leads away to the left across a grass field. Water foams in the inlet channel behind the
building. + STYLE
```
**B:**
```text
Slow pull-back and pan to the left along the power line; the wires sway slightly, the turbines keep spinning, water
flows in the channel. Stable camera.
```

### Kadr 5: suv kanalga qaytadi, tok qishloqqa (`maket-5.jpg`)
**A:**
```text
Wide aerial drone photo at golden hour: a small concrete powerhouse beside the huge Great Fergana Canal releases white
foaming water through a short curved concrete channel back into the canal. A power line on steel lattice towers runs
from the plant's small substation across the fields to a small village of red-roofed houses on the left, surrounded by
poplars. Crop fields in the foreground, long warm shadows. + STYLE
```
**B:**
```text
Slow rising pull-back at golden hour; the returned water merges into the canal current, the house windows in the
village light up one by one, warm light, gentle wind in the poplars. Stable camera.
```

---

## 5. Tayyor natijani bizga yuborish

Har bir kadr uchun:
- `bosqich-N.png`: tanlangan realistik rasm (1280×720 yoki kattaroq).
- `bosqich-N.mp4`: video, 16:9, kamida 5 soniya, yozuvsiz, ovozsiz bo'lsa ham bo'ladi.

Fayl nomidagi N = 0…5 (maket raqami bilan bir xil). Telegram'da **fayl sifatida** yuboring (siqilmasin).
Saytga qo'yishdan oldin biz siqamiz va tayyorlaymiz.

---

## 6. Ko'p uchraydigan muammolar

- **Hamon multfilmga o'xshaydi:** denoise'ni 0.75–0.85 ga ko'taring, NEGATIVE'da `isometric, illustration` borligini tekshiring.
- **Joylashuv buziladi (o'zan yo'qoladi, bino ko'chadi):** denoise'ni 0.6–0.65 ga tushiring; videoda kamera harakatini kamaytiring.
- **Yozuv yoki raqam paydo bo'ladi:** NEGATIVE'da `text, numbers, labels` turibdi; kerak bo'lsa inpaint bilan o'chiring.
- **Kompyuter qotadi yoki «out of memory» chiqadi:** o'lchamni 832×480 ga tushiring, `--lowvram` bilan qayta ishga
  tushiring, VAE Decode (Tiled) ishlating, har bir video oldidan **Unload Models** tugmasini bosing.
- **Video titraydi yoki shakllar «eriydi»:** harakat promptiga `stable camera, very slow` qo'shing, kadrlar sonini kamaytiring.
