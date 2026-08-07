/**
 * Rebuild solid Construction-Site-style tiles from over-transparent arts.
 * Keeps construction_site.png unchanged. Forces opaque rounded tiles and
 * fills punched holes in subjects.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ART_DIR = path.join(__dirname, "..", "assets", "art", "sounds");
const RADIUS = 0.22;

function inTile(x, y, w, h) {
  const radius = Math.min(w, h) * RADIUS;
  const cx0 = radius,
    cy0 = radius,
    cx1 = w - 1 - radius,
    cy1 = h - 1 - radius;
  if (x < cx0 && y < cy0) return Math.hypot(x - cx0, y - cy0) <= radius;
  if (x > cx1 && y < cy0) return Math.hypot(x - cx1, y - cy0) <= radius;
  if (x < cx0 && y > cy1) return Math.hypot(x - cx0, y - cy1) <= radius;
  if (x > cx1 && y > cy1) return Math.hypot(x - cx1, y - cy1) <= radius;
  return x >= 0 && y >= 0 && x < w && y < h;
}

function samplePad(data, w, h) {
  // Prefer dark opaque pixels near the inner rim (leftover tile color)
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  const inset = Math.floor(Math.min(w, h) * 0.1);
  for (let t = 0; t < 40; t++) {
    const pts = [
      [inset + t * 20, inset],
      [inset + t * 20, h - 1 - inset],
      [inset, inset + t * 20],
      [w - 1 - inset, inset + t * 20],
    ];
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (!inTile(x, y, w, h)) continue;
      const i = (y * w + x) * 4;
      if (data[i + 3] < 180) continue;
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg > 70) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  if (n < 10) return [22, 28, 38];
  return [(r / n) | 0, (g / n) | 0, (b / n) | 0];
}

function isNearPad(r, g, b, pr, pg, pb, tol = 18) {
  return Math.abs(r - pr) < tol && Math.abs(g - pg) < tol && Math.abs(b - pb) < tol;
}

function healOne(src, w, h) {
  const [pr, pg, pb] = samplePad(src, w, h);
  const out = Buffer.alloc(w * h * 4);

  // 1) Opaque rounded pad
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!inTile(x, y, w, h)) {
        out[i + 3] = 0;
        continue;
      }
      out[i] = pr;
      out[i + 1] = pg;
      out[i + 2] = pb;
      out[i + 3] = 255;
    }
  }

  // 2) Stamp any visible source pixels fully opaque
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inTile(x, y, w, h)) continue;
      const i = (y * w + x) * 4;
      const a = src[i + 3];
      if (a < 28) continue;
      const t = Math.min(1, a / 200);
      out[i] = Math.round(src[i] * t + pr * (1 - t));
      out[i + 1] = Math.round(src[i + 1] * t + pg * (1 - t));
      out[i + 2] = Math.round(src[i + 2] * t + pb * (1 - t));
      out[i + 3] = 255;
    }
  }

  // 3) Aggressive hole fill: replace pad-colored interior pixels that have subject neighbors
  for (let pass = 0; pass < 12; pass++) {
    const copy = Buffer.from(out);
    let filled = 0;
    const rad = pass < 4 ? 2 : 3;
    for (let y = rad; y < h - rad; y++) {
      for (let x = rad; x < w - rad; x++) {
        if (!inTile(x, y, w, h)) continue;
        const i = (y * w + x) * 4;
        if (!isNearPad(out[i], out[i + 1], out[i + 2], pr, pg, pb, 20)) continue;

        let sr = 0,
          sg = 0,
          sb = 0,
          n = 0;
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (!dx && !dy) continue;
            const j = ((y + dy) * w + (x + dx)) * 4;
            if (isNearPad(copy[j], copy[j + 1], copy[j + 2], pr, pg, pb, 20)) continue;
            sr += copy[j];
            sg += copy[j + 1];
            sb += copy[j + 2];
            n++;
          }
        }
        const need = pass < 6 ? 5 : 3;
        if (n >= need) {
          out[i] = (sr / n) | 0;
          out[i + 1] = (sg / n) | 0;
          out[i + 2] = (sb / n) | 0;
          out[i + 3] = 255;
          filled++;
        }
      }
    }
    if (filled === 0) break;
  }

  return out;
}

async function main() {
  const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith(".png"));
  for (const name of files) {
    const file = path.join(ART_DIR, name);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    const w = info.width;
    const h = info.height;
    let trans = 0;
    for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] < 8) trans++;
    const pct = (100 * trans) / (w * h);

    // Keep Construction Site as the gold standard
    if (name === "construction_site.png") {
      console.log("keep", name, "trans%", pct.toFixed(1));
      continue;
    }
    // Already fully opaque squares (rare) — leave
    if (pct < 1) {
      console.log("skip opaque", name);
      continue;
    }

    const out = healOne(data, w, h);
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile(file);
    let t2 = 0;
    for (let i = 0; i < w * h; i++) if (out[i * 4 + 3] < 8) t2++;
    console.log("healed", name, pct.toFixed(1), "->", ((100 * t2) / (w * h)).toFixed(1));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
