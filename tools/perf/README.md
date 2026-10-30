# Tezlik va animatsiya tekshiruvlari

Hammasi lokal: Python + Playwright (`pip install playwright pillow`, Chrome o'rnatilgan bo'lishi kerak).
Og'ir ishlarni navbat orqali ishga tushiring: `python /d/Dasturlar/Navbat/navbat.py --kim GES -- <buyruq>`.

| Skript | Nima qiladi | Ishlatish |
|---|---|---|
| `audit.py` | Sahifani o'quvchidek skroll qiladi (CPU 4x sekin): JS xatolar, ekranda yashirin qolgan reveal elementlar, kadr vaqtlari (p50/p95, >50 ms) | `python tools/perf/audit.py URL TEG` |
| `perf.py` | Telefon + sekin 4G + CPU 4x: LCP va CLS, 2 marta | `python tools/perf/perf.py URL` |
| `psi.py` | Google PageSpeed Insights (mobil), N marta | `python tools/perf/psi.py 2 URL [URL...]` |
| `lhlocal.sh` | Lokal Lighthouse (mobil), N marta → `lh-TEG-N.json` | `OUT=papka bash tools/perf/lhlocal.sh TEG PORT N` |
| `lhsum.py` | Lighthouse JSONlaridan qisqa jadval | `python tools/perf/lhsum.py "papka/lh-*.json"` |
| `trace.py` | Birinchi bo'yalishgacha main-thread ishi (eng og'ir qadamlar) | `python tools/perf/trace.py URL` |
| `cmp.py` | Eski va yangi buildni bir xil skroll nuqtalarida suratga olib, yonma-yon qo'yadi | `python tools/perf/cmp.py PAPKA ESKI_URL YANGI_URL` |

Eski buildni ko'rish: `git worktree add ../old <commit>`, keyin `python build.py` va `dist/` ni lokal server bilan oching.
