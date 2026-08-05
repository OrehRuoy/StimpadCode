/**
 * Pass 2: punch flat dark pad fill inside rounded tiles (keep subjects),
 * plus a harder school_bell cleanup for fringe / arcs / rim.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ART_DIR = path.join(ROOT, "assets", "art", "sounds");

function dist(r, g, b, br, bg, bb) {
  return Math.hypot(r - br, g - bg, b - bb);
}

function isPadDark(r, g, b) {
  const avg = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (avg > 72) return false;
  if (max - min > 38 && max > 70) return false; // colored glow/subject hint
  return true;
}

function isSubjectPixel(r, g, b) {
  const avg = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  // bright / colored / metallic highlights
  if (avg > 78) return true;
  if (sat > 42 && max > 60) return true;
  // cream / beige school bell
  if (r > 110 && g > 90 && b > 55 && r >= g - 5 && avg > 85) return true;
  // chrome-ish (similar channels but not too dark)
  if (avg > 55 && sat < 25 && avg > 50) return true;
  return false;
}

function sampleNearRim(data, w, h) {
  // Sample just inside the rounded tile (not outer transparent corners)
  const pts = [];
  const inset = Math.floor(Math.min(w, h) * 0.08);
  for (let t = 0; t < 12; t++) {
    const x = inset + Math.floor(((w - 1 - 2 * inset) * t) / 11);
    pts.push([x, inset], [x, h - 1 - inset]);
  }
  for (let t = 0; t < 12; t++) {
    const y = inset + Math.floor(((h - 1 - 2 * inset) * t) / 11);
    pts.push([inset, y], [w - 1 - inset, y]);
  }
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 40) continue;
    if (!isPadDark(data[i], data[i + 1], data[i + 2])) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (n < 8) return [20, 22, 28];
  return [r / n, g / n, b / n];
}

/** Flood from rim inward through pad-colored pixels only. */
function punchPadFlood(data, w, h, hard = 26, soft = 48) {
  const [br, bg, bb] = sampleNearRim(data, w, h);
  const out = Buffer.from(data);
  const seen = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;

  function trySeed(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (out[i + 3] < 12) {
      seen[idx] = 1;
      return;
    }
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (isSubjectPixel(r, g, b)) return;
    if (!isPadDark(r, g, b)) return;
    if (dist(r, g, b, br, bg, bb) > soft + 8) return;
    seen[idx] = 1;
    qx[qt] = x;
    qy[qt] = y;
    qt++;
  }

  // Seed along outer semi-transparent rim and near-edge opaque pad
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = out[i + 3];
      if (a === 0) continue;
      // edge-ish: has transparent neighbor
      let edge = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
          edge = true;
          break;
        }
        if (out[((ny * w + nx) * 4) + 3] < 20) {
          edge = true;
          break;
        }
      }
      if (edge) trySeed(x, y);
    }
  }

  while (qh < qt) {
    const x = qx[qh];
    const y = qy[qh];
    qh++;
    const i = (y * w + x) * 4;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const d = dist(r, g, b, br, bg, bb);
    let factor = 1;
    if (d <= hard) factor = 0;
    else if (d < soft) factor = (d - hard) / (soft - hard);
    out[i + 3] = Math.round(out[i + 3] * Math.max(0, Math.min(1, factor)));

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      trySeed(x + dx, y + dy);
    }
  }
  return out;
}

function cleanSchoolBellHard(data, w, h) {
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
      const avg = (r + g + b) / 3;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max - min;

      // Remove mint/cyan/green arc leftovers (any saturation green-cyan)
      const greenCyan = (g > r + 8 || b > r + 5) && g + b > r * 1.35 && sat > 18 && avg > 35;
      const beige = r > 115 && g > 95 && b > 60 && r > b + 15 && Math.abs(r - g) < 60;
      if (greenCyan && !beige) {
        out[i + 3] = 0;
        continue;
      }

      // Kill dark smudgy halo near beige unit
      if (!beige && avg < 50 && sat < 35) {
        let nearBeige = false;
        for (let dy = -3; dy <= 3 && !nearBeige; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = (ny * w + nx) * 4;
            if (out[j + 3] < 160) continue;
            const rr = out[j];
            const gg = out[j + 1];
            const bb = out[j + 2];
            if (rr > 120 && gg > 100 && bb > 65 && rr > bb + 18) nearBeige = true;
          }
        }
        if (nearBeige) {
          out[i + 3] = Math.round(a * 0.08);
          continue;
        }
      }

      // Kill thick near-black rim strokes (jagged outer border leftovers)
      if (avg < 22 && a < 230) {
        let nearTrans = false;
        for (const [dx, dy] of [
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
          [3, 3],
          [-3, -3],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
            nearTrans = true;
            break;
          }
          if (out[((ny * w + nx) * 4) + 3] < 30) nearTrans = true;
        }
        if (nearTrans) out[i + 3] = 0;
      }
    }
  }
  return out;
}

function killLightRim(data, w, h) {
  const out = Buffer.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = out[i + 3];
      if (a === 0 || a > 150) continue;
      const avg = (out[i] + out[i + 1] + out[i + 2]) / 3;
      const sat = Math.max(out[i], out[i + 1], out[i + 2]) - Math.min(out[i], out[i + 1], out[i + 2]);
      if (avg > 65 && sat < 40) out[i + 3] = 0;
    }
  }
  return out;
}

async function processFile(file) {
  const base = path.basename(file);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const w = info.width;
  const h = info.height;
  let out = data;
  if (base === "school_bell.png") {
    out = cleanSchoolBellHard(out, w, h);
  }
  out = punchPadFlood(out, w, h, 24, 46);
  // second softer pass
  out = punchPadFlood(out, w, h, 20, 40);
  out = killLightRim(out, w, h);
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(file);
  console.log("pad-punch", base);
}

async function main() {
  const only = process.argv.slice(2);
  const files = fs
    .readdirSync(ART_DIR)
    .filter((f) => f.endsWith(".png"))
    .filter((f) => (only.length ? only.includes(f) : true))
    .map((f) => path.join(ART_DIR, f));
  for (const f of files) await processFile(f);
  console.log("done", files.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
