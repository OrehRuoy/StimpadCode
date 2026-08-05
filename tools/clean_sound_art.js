/**
 * Uniform sound-art cleanup:
 * - Punch outer black / near-black canvas to transparent
 * - Soft rounded-rect silhouette (consistent corners, no light rim fringe)
 * - Do NOT alter the subject artwork itself
 * - school_bell: also remove leftover cyan arcs / edge fringe around the unit
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ART_DIR = path.join(ROOT, "assets", "art", "sounds");

function dist(r, g, b, br, bg, bb) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isOuterCanvas(r, g, b) {
  const avg = (r + g + b) / 3;
  if (avg > 42) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // near-black or very dark cool navy used as outer pad
  return max < 55 && max - min < 28;
}

function sampleCorners(data, w, h) {
  const pts = [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
    [Math.floor(w / 2), 1],
    [1, Math.floor(h / 2)],
    [w - 2, Math.floor(h / 2)],
    [Math.floor(w / 2), h - 2],
  ];
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return [r / n, g / n, b / n];
}

/** Remove outer black canvas only (protects dark subjects that aren't corner-colored). */
function punchOuterCanvas(data, w, h, hard = 18, soft = 36) {
  const [br, bg, bb] = sampleCorners(data, w, h);
  const out = Buffer.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const a = out[i + 3];
      if (a < 8) {
        out[i + 3] = 0;
        continue;
      }
      if (!isOuterCanvas(r, g, b)) continue;
      const d = dist(r, g, b, br, bg, bb);
      let factor = 1;
      if (d <= hard) factor = 0;
      else if (d < soft) factor = (d - hard) / (soft - hard);
      // Extra kill for pure black margins
      if ((r + g + b) / 3 < 14) factor = 0;
      out[i + 3] = Math.round(a * Math.max(0, Math.min(1, factor)));
    }
  }
  return out;
}

function roundedRectMask(data, w, h, radiusRatio = 0.22, feather = 3.2) {
  const out = Buffer.from(data);
  const radius = Math.min(w, h) * radiusRatio;
  const cx0 = radius;
  const cy0 = radius;
  const cx1 = w - 1 - radius;
  const cy1 = h - 1 - radius;

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

/** Kill light rim / pale fringe on nearly-transparent outer edge. */
function killLightRim(data, w, h) {
  const out = Buffer.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = out[i + 3];
      if (a === 0 || a > 140) continue;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const avg = (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      // Pale fringe lines on dark tiles
      if (avg > 70 && sat < 35 && a < 120) {
        out[i + 3] = 0;
      }
    }
  }
  return out;
}

function isCyanArc(r, g, b) {
  // Neon mint/cyan vibration leftovers around school bell
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 70) return false;
  if (g < 90 && b < 90) return false;
  // green/cyan dominant, not beige/cream subject
  const beige =
    r > 120 && g > 95 && b > 70 && Math.abs(r - g) < 55 && r > b + 15;
  if (beige) return false;
  return (g > r + 15 || b > r + 10) && g + b > r * 1.55 && max - min > 25;
}

function cleanSchoolBell(data, w, h) {
  let out = Buffer.from(data);
  // Pass 1: remove cyan/green arc artifacts
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (out[i + 3] < 10) continue;
      if (isCyanArc(out[i], out[i + 1], out[i + 2])) {
        out[i + 3] = 0;
      }
    }
  }
  // Pass 2: soft-kill dark grainy halo around beige unit (dark pixels abutting opaque beige)
  const copy = Buffer.from(out);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const r = copy[i];
      const g = copy[i + 1];
      const b = copy[i + 2];
      const a = copy[i + 3];
      if (a < 20) continue;
      const avg = (r + g + b) / 3;
      // dark fringe candidates
      if (avg > 55 || avg < 8) continue;
      let nearBeige = false;
      for (let dy = -2; dy <= 2 && !nearBeige; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const j = ((y + dy) * w + (x + dx)) * 4;
          const rr = copy[j];
          const gg = copy[j + 1];
          const bb = copy[j + 2];
          const aa = copy[j + 3];
          if (aa > 180 && rr > 130 && gg > 105 && bb > 70 && rr > bb + 20) {
            nearBeige = true;
          }
        }
      }
      if (nearBeige && avg < 48) {
        // fade dark halo clinging to the unit
        out[i + 3] = Math.round(a * 0.15);
      }
    }
  }
  // Pass 3: stronger outer-canvas punch for leftover black outside tile
  out = punchOuterCanvas(out, w, h, 22, 42);
  return out;
}

async function processFile(file) {
  const base = path.basename(file);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const w = info.width;
  const h = info.height;
  let out = punchOuterCanvas(data, w, h, 18, 38);
  if (base === "school_bell.png") {
    out = cleanSchoolBell(out, w, h);
  }
  out = roundedRectMask(out, w, h, 0.23, 3.5);
  out = killLightRim(out, w, h);
  // Second outer punch after mask for any residual black corners
  out = punchOuterCanvas(out, w, h, 16, 32);

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(file);
  console.log("cleaned", base);
}

async function main() {
  const files = fs
    .readdirSync(ART_DIR)
    .filter((f) => f.endsWith(".png"))
    .map((f) => path.join(ART_DIR, f));
  for (const f of files) {
    await processFile(f);
  }
  console.log("done", files.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
