/**
 * Recolor the outer dark backdrop to the plate color (keep plate + subject).
 * Does NOT punch holes — only shifts RGB of edge-connected outer pixels.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ART_DIR = path.join(ROOT, "assets", "art", "sounds");
const CORNER_RADIUS = 0.22;
const OUTER_DIST = 26;

function dist3(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2,
    dg = g1 - g2,
    db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
function lum(r, g, b) {
  return (r + g + b) / 3;
}

function restoreAlpha(data, w, h) {
  const out = Buffer.from(data);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = out[o],
      g = out[o + 1],
      b = out[o + 2];
    if (lum(r, g, b) > 2 || r > 4 || g > 4 || b > 4) out[o + 3] = 255;
    else out[o + 3] = 0;
  }
  return out;
}

function sampleOuter(data, w, h) {
  const samples = [];
  const take = (x, y) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 200) return;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let i = 2; i < 30; i++) {
    take(i, 2);
    take(w - 1 - i, 2);
    take(i, h - 3);
    take(w - 1 - i, h - 3);
    take(2, i);
    take(w - 3, i);
    take(2, h - 1 - i);
    take(w - 3, h - 1 - i);
  }
  if (!samples.length) return [20, 26, 38];
  const med = (idx) => {
    const v = samples.map((p) => p[idx]).sort((a, b) => a - b);
    return v[(v.length / 2) | 0];
  };
  return [med(0), med(1), med(2)];
}

function samplePlate(data, w, h) {
  const samples = [];
  for (const t of [0.14, 0.17, 0.2, 0.22]) {
    const x0 = Math.round(w * t);
    const y0 = Math.round(h * t);
    for (const [x, y] of [
      [x0, y0],
      [w - 1 - x0, y0],
      [x0, h - 1 - y0],
      [w - 1 - x0, h - 1 - y0],
      [Math.floor(w / 2), y0],
      [x0, Math.floor(h / 2)],
    ]) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 220) continue;
      const L = lum(data[i], data[i + 1], data[i + 2]);
      if (L >= 20 && L <= 100) samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  if (!samples.length) return [32, 40, 55];
  const med = (idx) => {
    const v = samples.map((p) => p[idx]).sort((a, b) => a - b);
    return v[(v.length / 2) | 0];
  };
  return [med(0), med(1), med(2)];
}

function roundedCorners(data, w, h) {
  const out = Buffer.from(data);
  const radius = Math.min(w, h) * CORNER_RADIUS;
  const cx0 = radius,
    cy0 = radius,
    cx1 = w - 1 - radius,
    cy1 = h - 1 - radius;
  const feather = 2.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let inside = true,
        edgeDist = 9999;
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
      if (!inside) out[i + 3] = 0;
      else if (edgeDist < feather)
        out[i + 3] = Math.round(out[i + 3] * Math.max(0, edgeDist / feather));
    }
  }
  return out;
}

function recolorOuterToPlate(data, w, h) {
  const out = Buffer.from(data);
  const [or, og, ob] = sampleOuter(out, w, h);
  const [pr, pg, pb] = samplePlate(out, w, h);
  const outerL = lum(or, og, ob);
  const plateL = lum(pr, pg, pb);
  if (plateL - outerL < 5) {
    return { out, changed: 0, skip: "contrast", outerL, plateL };
  }

  const seen = new Uint8Array(w * h);
  const q = [];
  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (out[i + 3] < 12) {
      seen[idx] = 1;
      q.push(idx);
      return;
    }
    const r = out[i],
      g = out[i + 1],
      b = out[i + 2];
    const L = lum(r, g, b);
    // Match outer backdrop; stay darker than plate so we don't recolor the plate itself
    if (dist3(r, g, b, or, og, ob) <= OUTER_DIST && L <= plateL - 5) {
      seen[idx] = 1;
      q.push(idx);
    }
  };

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  let changed = 0;
  let qi = 0;
  while (qi < q.length) {
    const idx = q[qi++];
    const i = idx * 4;
    if (out[i + 3] > 0) {
      // Only recolor if still outer-like (skip pure transparent walk nodes)
      const r = out[i],
        g = out[i + 1],
        b = out[i + 2];
      if (dist3(r, g, b, or, og, ob) <= OUTER_DIST && lum(r, g, b) <= plateL - 5) {
        out[i] = pr;
        out[i + 1] = pg;
        out[i + 2] = pb;
        changed++;
      }
    }
    const x = idx % w;
    const y = (idx / w) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  // Guard: center subject color must not become plate color en masse
  const cx = (w / 2) | 0,
    cy = (h / 2) | 0;
  let centerPlateish = 0;
  let centerOpaque = 0;
  for (let dy = -40; dy <= 40; dy++) {
    for (let dx = -40; dx <= 40; dx++) {
      const i = ((cy + dy) * w + (cx + dx)) * 4;
      if (out[i + 3] < 200) continue;
      centerOpaque++;
      if (dist3(out[i], out[i + 1], out[i + 2], pr, pg, pb) < 10) centerPlateish++;
    }
  }
  if (centerOpaque < 2000 || centerPlateish / Math.max(1, centerOpaque) > 0.55) {
    return {
      out: null,
      changed,
      skip: "center guard",
      centerOpaque,
      centerPlateish,
      outerL,
      plateL,
    };
  }
  return { out, changed, outerL, plateL, pr, pg, pb };
}

function fromGit(name) {
  try {
    return execSync(`git show HEAD:assets/art/sounds/${name}`, {
      maxBuffer: 30e6,
      cwd: ROOT,
    });
  } catch {
    return null;
  }
}

async function processFile(name) {
  let input = fromGit(name);
  if (!input) input = fs.readFileSync(path.join(ART_DIR, name));
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  let solid = restoreAlpha(data, info.width, info.height);
  const res = recolorOuterToPlate(solid, info.width, info.height);
  let out;
  if (!res.out) {
    out = roundedCorners(solid, info.width, info.height);
    console.log("SAFE", name, res.skip, "would", res.changed);
  } else {
    out = roundedCorners(res.out, info.width, info.height);
    console.log(
      "OK",
      name,
      "recolored",
      res.changed,
      "outerL",
      res.outerL.toFixed(1),
      "plate",
      res.pr + "," + res.pg + "," + res.pb
    );
  }
  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(path.join(ART_DIR, name));
}

async function main() {
  const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith(".png"));
  for (const name of files) await processFile(name);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
