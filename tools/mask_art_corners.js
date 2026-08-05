/**
 * Corner-only transparency for sound art.
 * Keeps the navy rounded button fill — only clears the square corner wedges.
 * Does NOT punch the dark tile body (that was destroying borders).
 */
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = (() => {
  try {
    return require("canvas");
  } catch {
    return {};
  }
})();

const ROOT = path.join(__dirname, "..");
const ART_DIR = path.join(ROOT, "assets", "art", "sounds");

async function withSharp() {
  const sharp = require("sharp");
  const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith(".png"));
  for (const f of files) {
    const file = path.join(ART_DIR, f);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    const w = info.width;
    const h = info.height;
    const ch = 4;
    const out = Buffer.from(data);
    // Slightly larger than the painted tile radius so leftover dark wedges disappear.
    const radius = Math.min(w, h) * 0.255;
    const feather = 4.5;
    const cx0 = radius;
    const cy0 = radius;
    const cx1 = w - 1 - radius;
    const cy1 = h - 1 - radius;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * ch;
        let edgeDist = 9999;
        let inside = true;
        if (x < cx0 && y < cy0) {
          const d = Math.hypot(x - cx0, y - cy0);
          inside = d <= radius;
          edgeDist = radius - d;
        } else if (x > cx1 && y < cy0) {
          const d = Math.hypot(x - cx1, y - cy0);
          inside = d <= radius;
          edgeDist = radius - d;
        } else if (x < cx0 && y > cy1) {
          const d = Math.hypot(x - cx0, y - cy1);
          inside = d <= radius;
          edgeDist = radius - d;
        } else if (x > cx1 && y > cy1) {
          const d = Math.hypot(x - cx1, y - cy1);
          inside = d <= radius;
          edgeDist = radius - d;
        }
        let factor = 1;
        if (!inside) factor = 0;
        else if (edgeDist < feather) factor = Math.max(0, edgeDist / feather);
        out[i + 3] = Math.round(out[i + 3] * factor);
      }
    }
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile(file);
    console.log("masked", f);
  }
  console.log("done", files.length);
}

withSharp().catch((e) => {
  console.error(e);
  process.exit(1);
});
