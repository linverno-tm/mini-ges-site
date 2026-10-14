# MINI GES videolarini 4K ga oshirish (ComfyUI)

**Vazifa:** paketdagi 720p (1280×720) videolarni **4K (3840×2160)** ga AI yordamida oshirish. Natija tiniq
bo'lishi, suv, beton, teraklar va turbinalarda «g'ayritabiiy» chizilgan detal yoki miltillash bo'lmasligi kerak.
Videolar saytda taqdimot (to'liq ekran) rejimida ko'rsatiladi.

Papkada:
- `videos/bosqich-1.mp4, bosqich-2.mp4, bosqich-5.mp4`: 720p, 24 fps, 8 soniya (har birida 192 kadr).
  Bosqich 3 va 4 videolari bugun kechqurun tayyor bo'ladi, keyin alohida yuboramiz.
- `images/maket-0-2k.jpg, maket-3-2k.jpg, maket-4-2k.jpg`: rasmlar (2752×1536). Bularni ham 4K ga oshirsa yaxshi
  (3840×2143).

---

## 0. Boshlashdan oldin

1. ComfyUI'da navbatni tozalang (Queue → Clear) va ComfyUI'ni qayta ishga tushiring.
2. 12 GB va undan kam VRAM bo'lsa, ComfyUI'ni `--lowvram` bilan oching.
3. Kerakli node paketlari (ComfyUI Manager → Install Custom Nodes):
   - **ComfyUI-VideoHelperSuite** (videoni kadrlarga ajratish va qayta yig'ish uchun `Load Video` / `Video Combine`)
   - **ComfyUI-SeedVR2_VideoUpscaler** (1-usul uchun)
4. Avval **bitta video, faqat 2 soniyasi** bilan sinang (`Load Video` → `frame_load_cap: 48`). Natija yoqsa, to'liq videoni ishlating.

---

## 1-usul (eng yaxshisi): SeedVR2, videoga mo'ljallangan upscaler

SeedVR2 kadrlarni bir-biriga bog'lab oshiradi, shuning uchun suv va barglar **miltillamaydi**.

1. `Load Video (VHS)`: `bosqich-N.mp4`, `force_rate: 0` (asl 24 fps), `frame_load_cap: 0` (hammasi).
2. `SeedVR2 Video Upscaler`:
   - model: VRAM 16 GB+ bo'lsa **7B fp8**, kamroq bo'lsa **3B fp8**
   - `resolution` (qisqa tomon): **2160**
   - `batch_size`: node tavsiya qilgan format (odatda 4n+1: 5, 9, 13…). VRAM yetmasa kichikroq qiling
   - xotira yetmasa `block swap` / `tiled VAE` parametrlarini yoqing (node'da bor)
   - rang o'zgarsa `color correction` ni yoqing
3. `Video Combine (VHS)`: `frame_rate: 24`, `format: video/h264-mp4`, `crf: 16`, `pix_fmt: yuv420p`,
   `filename_prefix: bosqich-N-4k`.

Bu og'ir jarayon: bitta 8 soniyalik video bir necha o'n daqiqa ishlashi mumkin. Kompyuterni boshqa ish bilan band qilmang.

---

## 2-usul (yengilroq): Real-ESRGAN, kadrma-kadr

VRAM kam bo'lsa yoki SeedVR2 ishlamasa.

1. Modelni yuklab `ComfyUI/models/upscale_models/` ga qo'ying: **RealESRGAN_x4plus** yoki **4x-UltraSharp**.
2. Workflow:
   `Load Video (VHS)` → `Upscale Image (using Model)` (+ `Load Upscale Model`) → `ImageScale` (**3840×2160**,
   `lanczos`) → `Video Combine (VHS)` (`frame_rate 24`, `h264-mp4`, `crf 16`).
   - x4 model 1280×720 ni 5120×2880 qiladi, `ImageScale` uni aniq 3840×2160 ga tushiradi.
   - Xotira yetmasa, `Upscale Image (using Model)` o'rniga tile qilib ishlaydigan node'dan foydalaning yoki `Load Video` da
     `frame_load_cap: 48` va `skip_first_frames` bilan videoni 4 bo'lakda ishlang.
3. Bu usulda suv sal miltillashi mumkin. Shunday bo'lsa, 1-usulni sinab ko'ring.

**Rasmlar uchun** (`images/`): `Load Image` → `Upscale Image (using Model)` → `ImageScale` (eni 3840, `lanczos`)
→ `Save Image` (PNG). Nomi: `maket-N-4k.png`.

---

## 3. Natijani tekshirish

- O'lchami **3840×2160**, kadr tezligi **24 fps**, davomiyligi 8 soniya bo'lsin (asl nusxa bilan bir xil).
- 100% kattalashtirib qarang: beton yoriqlari, teraklar, turbina qovurg'alari tabiiy ko'rinsin. «Plastik», yog'li
  yoki ortiqcha o'tkir chiziqlar bo'lmasin.
- Suv va barglar kadrdan kadrga miltillamasin.
- Ranglar asl nusxadagidek bo'lsin (sarg'ayib yoki ko'karib ketmasin).

---

## 4. Bizga yuborish

- `bosqich-1-4k.mp4`, `bosqich-2-4k.mp4`, `bosqich-5-4k.mp4` (keyin 3 va 4 ham)
- `maket-0-4k.png`, `maket-3-4k.png`, `maket-4-4k.png`

Telegram'da **fayl sifatida** yuboring (video sifatida yuborilsa, Telegram siqib yuboradi). Fayl katta bo'lsa
(har biri ~50–150 MB), Google Drive havolasi ham bo'ladi. Saytga qo'yishdan oldin biz o'zimiz siqamiz.
