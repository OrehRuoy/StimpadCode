/**
 * Cleaner paywall chroma: hard key + despill + slight alpha erode/blur.
 */
const path = require("path");
const sharp = require("sharp");

const SRC = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-Ultima-Desktop-StimPad",
  "assets",
  "paywall_hero_magenta.png"
);
const DEST = path.join(__dirname, "..", "assets", "ui", "paywall_hero.png");

function isKey(r, g, b) {
  // Strong magenta / pink key — keep teal subject intact
  if (g >= 130) return false;
  if (r < 150 || b < 140) return false;
  return Math.min(r, b) - g > 45;
}

async function main() {
  let { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const w = info.width;
  const h = info.height;
  const out = Buffer.from(data);

  for (let i = 0; i < out.length; i += 4) {
    if (isKey(out[i], out[i + 1], out[i + 2])) out[i + 3] = 0;
  }

  // Flood remaining key from edges
  const seen = new Uint8Array(w * h);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    seen[idx] = 1;
    q.push(idx);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (q.length) {
    const p = q.pop();
    const x = p % w;
    const y = ((p - x) / w) | 0;
    const i = p * 4;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const max = Math.max(r, g, b);
    if (out[i + 3] < 8 || isKey(r, g, b) || (max < 20 && g < 25)) {
      out[i + 3] = 0;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
  }

  // Despill + kill near-transparent fringe (grain source)
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a === 0) continue;
    if (a < 40) {
      out[i + 3] = 0;
      continue;
    }
    let r = out[i];
    let g = out[i + 1];
    let b = out[i + 2];
    // Magenta despill
    if (r > g + 15 && b > g + 15) {
      r = Math.round(r * 0.35 + g * 0.65);
      b = Math.round(b * 0.35 + g * 0.65);
      out[i] = r;
      out[i + 2] = b;
    }
    // White-fringe crush on low-alpha edges
    if (a < 200) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > 210 && g < 180) {
        out[i + 3] = Math.min(a, 90);
      }
    }
  }

  // Morphological erode alpha 1px then slight dilate for smooth silhouette
  const a0 = Buffer.alloc(w * h);
  for (let p = 0; p < w * h; p++) a0[p] = out[p * 4 + 3];
  const a1 = Buffer.alloc(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let m = a0[i];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        m = Math.min(m, a0[(y + dy) * w + (x + dx)]);
      }
      a1[i] = m;
    }
  }
  // Soft blur
  const a2 = Buffer.alloc(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      a2[i] = Math.round(
        (a1[i] * 2 + a1[i - 1] + a1[i + 1] + a1[i - w] + a1[i + w]) / 6
      );
    }
  }
  for (let p = 0; p < w * h; p++) {
    out[p * 4 + 3] = a2[p] < 18 ? 0 : a2[p];
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(DEST);
  console.log("wrote", DEST);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
