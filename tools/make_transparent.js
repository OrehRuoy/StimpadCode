/**
 * Make navy/dark square backgrounds transparent.
 * - UI icons (plus/gear): flood-remove dark bg from corners with soft edges
 * - Sound art: soft rounded-rect alpha so only the rounded tile remains
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");

function colorDist(r, g, b, br, bg, bb) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isDarkNavy(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Dark, low saturation-ish navy/charcoal backgrounds used across assets
  if (max > 95) return false;
  if ((r + g + b) / 3 > 78) return false;
  // Prefer bluish / cool darks; also allow near-black charcoal
  return b >= r - 8 || max < 45;
}

async function loadRaw(file) {
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function sampleCorners(data, w, h, ch) {
  const pts = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
    [Math.floor(w / 2), 2],
    [2, Math.floor(h / 2)],
  ];
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const [x, y] of pts) {
    const i = (y * w + x) * ch;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return [r / n, g / n, b / n];
}

/** Soft remove pixels similar to corner background (for plus/gear). */
function punchBackground(data, w, h, ch, hard = 28, soft = 52) {
  const [br, bg, bb] = sampleCorners(data, w, h, ch);
  const out = Buffer.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const a = out[i + 3];
      if (a === 0) continue;
      // Only punch dark navy-like pixels (protect cream/mint/coral subjects)
      if (!isDarkNavy(r, g, b) && colorDist(r, g, b, br, bg, bb) > soft + 10) {
        continue;
      }
      const d = colorDist(r, g, b, br, bg, bb);
      let factor = 1;
      if (d <= hard) factor = 0;
      else if (d < soft) factor = (d - hard) / (soft - hard);
      // Extra: if clearly dark navy, lean toward transparent even if slightly off sample
      if (isDarkNavy(r, g, b) && d < soft + 18) {
        factor = Math.min(factor, Math.max(0, (d - hard * 0.6) / (soft - hard * 0.6)));
      }
      out[i + 3] = Math.round(a * Math.max(0, Math.min(1, factor)));
    }
  }
  return out;
}

/** Keep rounded-rect tile; fade corners outside radius (sound art). */
function roundedRectMask(data, w, h, ch, radiusRatio = 0.22, feather = 2.2) {
  const out = Buffer.from(data);
  const radius = Math.min(w, h) * radiusRatio;
  const cx0 = radius;
  const cy0 = radius;
  const cx1 = w - 1 - radius;
  const cy1 = h - 1 - radius;

  function cornerDist(x, y, cx, cy) {
    const dx = x - cx;
    const dy = y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      let inside = true;
      let edgeDist = 9999;

      if (x < cx0 && y < cy0) {
        const d = cornerDist(x, y, cx0, cy0);
        inside = d <= radius;
        edgeDist = radius - d;
      } else if (x > cx1 && y < cy0) {
        const d = cornerDist(x, y, cx1, cy0);
        inside = d <= radius;
        edgeDist = radius - d;
      } else if (x < cx0 && y > cy1) {
        const d = cornerDist(x, y, cx0, cy1);
        inside = d <= radius;
        edgeDist = radius - d;
      } else if (x > cx1 && y > cy1) {
        const d = cornerDist(x, y, cx1, cy1);
        inside = d <= radius;
        edgeDist = radius - d;
      } else {
        // Inside the straight edges of the rounded rect
        const dx = Math.min(x, w - 1 - x);
        const dy = Math.min(y, h - 1 - y);
        edgeDist = Math.min(dx, dy);
        // Not in corner zones; fully inside horizontally/vertically for a filled rounded square canvas
        inside = true;
      }

      let factor = 1;
      if (!inside) factor = 0;
      else if (edgeDist < feather) factor = Math.max(0, edgeDist / feather);

      out[i + 3] = Math.round(out[i + 3] * factor);
    }
  }
  return out;
}

async function saveRaw(file, data, w, h) {
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(file);
}

async function processUiIcon(file) {
  const { data, width, height, channels } = await loadRaw(file);
  let out = punchBackground(data, width, height, channels, 26, 48);
  // Second pass with slightly looser tolerance for leftover fringe
  const tmp = { data: out, width, height, channels };
  out = punchBackground(tmp.data, width, height, channels, 22, 44);
  await saveRaw(file, out, width, height);
  console.log("ui", path.basename(file));
}

async function processSoundArt(file) {
  const { data, width, height, channels } = await loadRaw(file);
  // First: if outer margin is darker canvas around a smaller tile, punch it
  let out = punchBackground(data, width, height, channels, 20, 40);
  // Then: force clean rounded-rect silhouette (no square corner wedges / fringe lines)
  out = roundedRectMask(out, width, height, channels, 0.2, 2.5);
  await saveRaw(file, out, width, height);
  console.log("art", path.basename(file));
}

async function main() {
  const plus = path.join(ROOT, "assets/ui/icon_plus_badge.png");
  const gear = path.join(ROOT, "assets/ui/icon_settings_gear.png");
  await processUiIcon(plus);
  await processUiIcon(gear);

  const artDir = path.join(ROOT, "assets/art/sounds");
  const files = fs.readdirSync(artDir).filter((f) => f.endsWith(".png"));
  for (const f of files) {
    await processSoundArt(path.join(artDir, f));
  }
  console.log("done", files.length, "sound arts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
