# 3D turbina (How bo'limi)

`mini-ges-site/js/vendor/turbine3d.min.js` va `mini-ges-site/assets/3d/kaplan.glb` shu yerdagi paketlar bilan yasalgan.

```bash
cd tools/3d && npm ci
cd ../../mini-ges-site
NODE_PATH="../tools/3d/node_modules" npx -y esbuild@0.24.0 js/3d/turbine3d.src.js --bundle --minify --format=iife --target=es2019 --legal-comments=none "--banner:js=/* three.js r169 (c) three.js authors, MIT. Kaplan model by stas2001a, CC BY 4.0 */" --outfile=js/vendor/turbine3d.min.js
```

Modelni siqish (asl .glb Sketchfab'dan, stas2001a, CC BY 4.0):
`npx --prefix ../tools/3d gltf-transform meshopt asl.glb assets/3d/kaplan.glb`

Fayl o'zgarsa `index.html` / `main.js` dagi `?v=` raqamini oshiring.
