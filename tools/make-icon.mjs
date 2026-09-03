/**
 * Génère les icônes de l'application (SVG + PNG 192/512/1024) sans dépendance.
 * Motif : lame dressée dans un anneau doré, sur fond ember-black — la DA du site FaB.
 * Usage : npm run icon
 */
import { writeFile, mkdir } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "www", "icons");

const GOLD = [0xda, 0xb4, 0x5f];
const GOLD_DEEP = [0x8a, 0x6e, 0x33];
const PARCHMENT = [0xf9, 0xe6, 0xc5];
const BLOOD = [0x91, 0x16, 0x0d];

/* ------------------------------ PNG ------------------------------ */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, pixels) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filtre « none »
    pixels.copy(raw, y * stride + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // 8 bits par canal
  ihdr[9] = 2;   // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/* ----------------------------- dessin ---------------------------- */

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));

/** `emblem` réduit l'emblème sans réduire la toile (utile pour l'écran de lancement). */
function draw(size, emblem = 1) {
  const px = Buffer.alloc(size * size * 3);
  const c = size / 2;
  const S = (size / 1024) * emblem; // l'emblème est décrit sur une grille de 1024

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c, dy = y - c;
      const dist = Math.hypot(dx, dy) / c;

      // fond : braise sombre, plus chaud au centre
      let col = mix([0x2a, 0x1a, 0x12], [0x0a, 0x03, 0x00], dist * 1.15);
      col = mix(col, BLOOD, Math.max(0, 0.16 - dist * 0.16));

      // anneau doré
      const r = dist * c;
      const ringMid = 470 * S, ringHalf = 11 * S;
      const ring = 1 - Math.min(1, Math.abs(r - ringMid) / ringHalf);
      if (ring > 0) col = mix(col, mix(GOLD_DEEP, GOLD, 0.5 + dy / size), ring);

      // lame : fuseau vertical, pointe en haut
      const bx = Math.abs(dx);
      const top = -330 * S, bottom = 210 * S;
      if (dy > top && dy < bottom) {
        const t = (dy - top) / (bottom - top);           // 0 pointe → 1 talon
        const halfWidth = (6 + 40 * Math.min(1, t * 2.6)) * S;
        const edge = halfWidth - bx;
        if (edge > 0) {
          const sheen = 1 - Math.min(1, bx / halfWidth);
          col = mix(mix(GOLD_DEEP, PARCHMENT, 0.25 + sheen * 0.6), col, Math.max(0, 1 - edge / (3 * S)));
        }
      }

      // garde
      if (Math.abs(dy - 205 * S) < 17 * S && bx < 165 * S) col = mix(GOLD, col, Math.abs(dy - 205 * S) / (17 * S) * 0.6);
      // poignée
      if (dy > 205 * S && dy < 330 * S && bx < 17 * S) col = mix(GOLD_DEEP, col, 0.15);
      // pommeau
      if (Math.hypot(dx, dy - 352 * S) < 32 * S) col = mix(GOLD, col, Math.hypot(dx, dy - 352 * S) / (32 * S) * 0.7);

      // vignettage
      col = mix(col, [0x06, 0x02, 0x00], Math.max(0, (dist - 0.72) * 1.5));

      const i = (y * size + x) * 3;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2];
    }
  }
  return px;
}

/* ------------------------------ SVG ------------------------------ */

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="72%">
      <stop offset="0" stop-color="#2a1a12"/>
      <stop offset="1" stop-color="#0a0300"/>
    </radialGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8a6e33"/>
      <stop offset=".5" stop-color="#f9e6c5"/>
      <stop offset="1" stop-color="#8a6e33"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="212" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="470" fill="none" stroke="#dab45f" stroke-width="22" opacity=".85"/>
  <path d="M512 182 552 372v350h-80V372z" fill="url(#blade)"/>
  <rect x="347" y="700" width="330" height="34" rx="17" fill="#dab45f"/>
  <rect x="495" y="734" width="34" height="125" rx="17" fill="#8a6e33"/>
  <circle cx="512" cy="864" r="32" fill="#dab45f"/>
</svg>
`;

/* ---------------------------- écriture --------------------------- */

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

await mkdir(OUT, { recursive: true });
await mkdir(ASSETS, { recursive: true });
await writeFile(join(OUT, "icon.svg"), svg);

for (const size of [192, 512, 1024]) {
  await writeFile(join(OUT, `icon-${size}.png`), encodePNG(size, draw(size)));
  console.log(`✔ icons/icon-${size}.png`);
}
console.log("✔ icons/icon.svg");

// Sources attendues par @capacitor/assets pour générer les ressources Android.
await writeFile(join(ASSETS, "icon.png"), encodePNG(1024, draw(1024)));
await writeFile(join(ASSETS, "splash.png"), encodePNG(2732, draw(2732, 0.34)));
console.log("✔ assets/icon.png · assets/splash.png");
