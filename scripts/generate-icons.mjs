// Gera os ícones PWA a partir de um SVG vetorial (sem depender de fontes).
// Uso: node scripts/generate-icons.mjs
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/icons");

// "F" desenhado com retângulos brancos sobre fundo teal arredondado.
function svg({ bg = "#0e7490", pad = 0 } = {}) {
  const s = 512;
  const r = 112;
  const scale = 1 - pad;
  const tx = (s * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${r}" fill="${bg}"/>
  <g transform="translate(${tx},${tx}) scale(${scale})" fill="#ffffff">
    <rect x="176" y="132" width="52" height="248" rx="10"/>
    <rect x="176" y="132" width="164" height="52" rx="10"/>
    <rect x="176" y="240" width="128" height="48" rx="10"/>
  </g>
</svg>`;
}

const targets = [
  { name: "icon-192.png", size: 192, pad: 0 },
  { name: "icon-512.png", size: 512, pad: 0 },
  { name: "icon-maskable-512.png", size: 512, pad: 0.18 },
  { name: "apple-touch-icon.png", size: 180, pad: 0 },
];

await mkdir(outDir, { recursive: true });
for (const t of targets) {
  const buf = Buffer.from(svg({ pad: t.pad }));
  await sharp(buf).resize(t.size, t.size).png().toFile(resolve(outDir, t.name));
  console.log("gerado:", t.name);
}
// Favicon simples
await sharp(Buffer.from(svg())).resize(48, 48).png().toFile(resolve(root, "public/favicon.png"));
console.log("gerado: favicon.png");
