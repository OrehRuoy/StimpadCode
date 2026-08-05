/**
 * Final cleanup: remove ghost rounded rims + grainy speckles in open areas.
 * Protects solid subject cores.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ART_DIR = path.join(__dirname, "..", "assets", "art", "sounds");

function finalize(data, w, h) {
  const out = Buffer.from(data);
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = out[i * 4 + 3];

  // Count opaque neighbors (8-conn) for despeckle
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const i = idx * 4;
      const a = out[i + 3];
      if (a === 0) continue;

      let opaqueN = 0;
      let strongN = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const aa = alpha[(y + dy) * w + (x + dx)];
          if (aa > 40) opaqueN++;
          if (aa > 160) strongN++;
        }
      }

      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const avg = (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);

      // Isolated grain / dust
      if (opaqueN <= 2 && a < 200) {
        out[i + 3] = 0;
        continue;
      }
      if (strongN <= 1 && a < 120 && avg > 40) {
        out[i + 3] = 0;
        continue;
      }

      // Ghost rim: semi-transparent, near edge of canvas or with transparent neighbors, dark-ish or pale fringe
      const edgeDist = Math.min(x, y, w - 1 - x, h - 1 - y);
      let transN = 0;
      for (const [dx, dy] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [3, 3],
        [-3, 3],
        [3, -3],
        [-3, -3],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
          transN++;
          continue;
        }
        if (alpha[ny * w + nx] < 25) transN++;
      }

      if (a < 170 && transN >= 3 && strongN <= 3) {
        // pale fringe or dark ghost border
        if (avg < 55 || (avg > 60 && sat < 35 && a < 140)) {
          out[i + 3] = 0;
          continue;
        }
      }

      // Soft kill remaining light fringe hugging subjects (semi, low sat, mid brightness)
      if (a < 130 && avg > 70 && sat < 30 && strongN < 5) {
        out[i + 3] = 0;
        continue;
      }

      // Outer margin ghost rounded frame (within ~6% of border)
      const margin = Math.min(w, h) * 0.07;
      if (edgeDist < margin && a < 180 && avg < 70 && strongN <= 4) {
        out[i + 3] = 0;
      }
    }
  }

  // Second pass: clear any leftover low-alpha dust
  for (let i = 0; i < w * h; i++) {
    const a = out[i * 4 + 3];
    if (a > 0 && a < 28) out[i * 4 + 3] = 0;
  }
  return out;
}

function schoolExtra(data, w, h) {
  const out = Buffer.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = out[i + 3];
      if (a < 8) continue;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const avg = (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const beige = r > 120 && g > 100 && b > 65 && r > b + 15;
      if (beige) continue;
      // light gray halo around unit
      if (avg > 55 && avg < 175 && sat < 28 && a < 220) {
        let nearBeige = false;
        for (let dy = -2; dy <= 2 && !nearBeige; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = (ny * w + nx) * 4;
            if (out[j + 3] < 150) continue;
            const rr = out[j];
            const gg = out[j + 1];
            const bb = out[j + 2];
            if (rr > 125 && gg > 105 && bb > 70 && rr > bb + 18) nearBeige = true;
          }
        }
        if (nearBeige) out[i + 3] = 0;
      }
    }
  }
  return out;
}

async function main() {
  const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith(".png"));
  for (const f of files) {
    const file = path.join(ART_DIR, f);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    let out = finalize(data, info.width, info.height);
    if (f === "school_bell.png") out = schoolExtra(out, info.width, info.height);
    await sharp(out, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(file);
    console.log("final", f);
  }
  console.log("done", files.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
