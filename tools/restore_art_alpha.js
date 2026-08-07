/**
 * Restore over-transparent sound art WITHOUT changing image content.
 * Our cleanup zeroed alpha but left RGB intact — reinstate opacity for any
 * pixel that still has color, then apply Construction-Site-style rounded corners only.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ART_DIR = path.join(ROOT, "assets", "art", "sounds");
const RADIUS = 0.22; // match construction_site look

function restoreAlpha(data, w, h) {
  const out = Buffer.from(data);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    const avg = (r + g + b) / 3;
    // Any leftover color under transparent pixels = real art; make solid again
    if (avg > 2 || r > 4 || g > 4 || b > 4) {
      out[o + 3] = 255;
    } else {
      out[o + 3] = 0;
    }
  }
  return out;
}

function roundedCornersOnly(data, w, h) {
  const out = Buffer.from(data);
  const radius = Math.min(w, h) * RADIUS;
  const cx0 = radius;
  const cy0 = radius;
  const cx1 = w - 1 - radius;
  const cy1 = h - 1 - radius;
  const feather = 2.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let inside = true;
      let edgeDist = 9999;
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
      } else {
        edgeDist = Math.min(x, w - 1 - x, y, h - 1 - y);
      }
      if (!inside) {
        out[i + 3] = 0;
      } else if (edgeDist < feather) {
        out[i + 3] = Math.round(out[i + 3] * Math.max(0, edgeDist / feather));
      }
    }
  }
  return out;
}

async function fromGitHead(name) {
  try {
    const buf = execSync(`git show HEAD:assets/art/sounds/${name}`, {
      maxBuffer: 30e6,
      cwd: ROOT,
    });
    return buf;
  } catch {
    return null;
  }
}

async function main() {
  const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith(".png"));
  for (const name of files) {
    // Prefer committed over-transparent original (RGB preserved) over healed disk copy
    let input = await fromGitHead(name);
    if (!input) input = fs.readFileSync(path.join(ART_DIR, name));

    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    let out = restoreAlpha(data, info.width, info.height);
    out = roundedCornersOnly(out, info.width, info.height);
    await sharp(out, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(path.join(ART_DIR, name));

    let trans = 0;
    for (let i = 0; i < info.width * info.height; i++) if (out[i * 4 + 3] < 8) trans++;
    console.log(
      "restored",
      name,
      "trans%",
      ((100 * trans) / (info.width * info.height)).toFixed(1)
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
