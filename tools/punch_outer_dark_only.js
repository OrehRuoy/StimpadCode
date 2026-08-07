/**
 * Remove ONLY darker outer background outside each icon plate.
 * Flood from image borders through pixels darker than the plate; never enter
 * plate-brightness pixels (subjects behind the plate stay untouched).
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ART_DIR = path.join(__dirname, "..", "assets", "art", "sounds");

function avg(r, g, b) {
  return (r + g + b) / 3;
}

function samplePlate(data, w, h) {
  const samples = [];
  for (const t of [0.13, 0.15, 0.17, 0.2]) {
    const x0 = Math.floor(w * t);
    const y0 = Math.floor(h * t);
    const pts = [
      [x0, y0],
      [w - 1 - x0, y0],
      [x0, h - 1 - y0],
      [w - 1 - x0, h - 1 - y0],
      [(w / 2) | 0, y0],
      [(w / 2) | 0, h - 1 - y0],
      [x0, (h / 2) | 0],
      [w - 1 - x0, (h / 2) | 0],
    ];
    for (const [x, y] of pts) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 200) continue;
      const a = avg(data[i], data[i + 1], data[i + 2]);
      if (a < 22 || a > 90) continue;
      samples.push(a);
    }
  }
  if (samples.length < 4) return 44;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function punchOuterDark(data, w, h) {
  const out = Buffer.from(data);
  const plateAvg = samplePlate(data, w, h);
  const stopAt = plateAvg - 7; // don't enter plate-or-brighter
  const seen = new Uint8Array(w * h);
  const q = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;

  function tryPush(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    const i = idx * 4;
    const alpha = out[i + 3];
    if (alpha < 10) {
      // transparent: walk through, don't clear again
      seen[idx] = 1;
      q[qt++] = idx;
      return;
    }
    const v = avg(out[i], out[i + 1], out[i + 2]);
    if (v >= stopAt) return; // plate / subject / lighter
    const sat =
      Math.max(out[i], out[i + 1], out[i + 2]) -
      Math.min(out[i], out[i + 1], out[i + 2]);
    // Skip saturated pixels (glow, chrome tint) — not flat outer bg
    if (sat > 30 && v > 22) return;
    seen[idx] = 1;
    q[qt++] = idx;
  }

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  let cleared = 0;
  while (qh < qt) {
    const idx = q[qh++];
    const i = idx * 4;
    if (out[i + 3] >= 10) {
      out[i + 3] = 0;
      cleared++;
    }
    const x = idx % w;
    const y = (idx / w) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }
  return { out, plateAvg, cleared, stopAt };
}

async function main() {
  const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith(".png"));
  for (const name of files) {
    const file = path.join(ART_DIR, name);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    const before = Buffer.from(data);
    const { out, plateAvg, cleared, stopAt } = punchOuterDark(data, info.width, info.height);

    // Safety: refuse if we cleared an implausible amount of the image center
    let centerCleared = 0;
    const x0 = (info.width * 0.35) | 0;
    const x1 = (info.width * 0.65) | 0;
    const y0 = (info.height * 0.35) | 0;
    const y1 = (info.height * 0.65) | 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * info.width + x) * 4;
        if (before[i + 3] >= 10 && out[i + 3] < 10) centerCleared++;
      }
    }
    const centerN = (x1 - x0) * (y1 - y0);
    if (centerCleared > centerN * 0.08) {
      console.log(
        "SKIP",
        name,
        "center damage",
        ((100 * centerCleared) / centerN).toFixed(1) + "%"
      );
      continue;
    }

    await sharp(out, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(file);
    let trans = 0;
    for (let i = 0; i < info.width * info.height; i++) if (out[i * 4 + 3] < 8) trans++;
    console.log(
      name,
      "plate",
      plateAvg.toFixed(1),
      "stop",
      stopAt.toFixed(1),
      "cleared",
      cleared,
      "trans%",
      ((100 * trans) / (info.width * info.height)).toFixed(1)
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
