/** Mask corners only for the new stim-pack art tiles. */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ART = path.join(__dirname, "..", "assets", "art", "sounds");
const IDS = [
  "keyboard_thock",
  "relay_click",
  "circuit_breaker",
  "rotary_selector",
  "magnetic_fidget",
  "magsafe_snap",
  "rain_metal_roof",
  "nails_glass",
  "nails_plastic",
  "nails_wood",
];

async function maskFile(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const w = info.width;
  const h = info.height;
  const ch = 4;
  const out = Buffer.from(data);
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
  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);
  console.log("masked", path.basename(file));
}

(async () => {
  for (const id of IDS) {
    const f = path.join(ART, id + ".png");
    if (!fs.existsSync(f)) throw new Error("missing " + f);
    await maskFile(f);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
