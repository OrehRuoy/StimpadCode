/**
 * Extend ambulance + replace bike bell with better BSB recording.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const TMP = path.join(AUDIO, "_tmp");
const SR = 44100;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "StimPad/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(new URL(res.headers.location, url).href, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error("HTTP " + res.statusCode));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", reject);
  });
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || "ffmpeg failed");
}

function toWav(src, dest) {
  ffmpeg(["-y", "-i", src, "-ac", "1", "-ar", String(SR), dest]);
}

function writeWav(filePath, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

function readWav(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 12;
  let channels = 1;
  let rate = SR;
  let bits = 16;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(offset + 10);
      rate = buf.readUInt32LE(offset + 12);
      bits = buf.readUInt16LE(offset + 22);
    } else if (id === "data") {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  const samples = [];
  const n = Math.floor(dataSize / ((bits / 8) * channels));
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      sum += buf.readInt16LE(dataOffset + (i * channels + c) * 2) / 32768;
    }
    samples.push(sum / channels);
  }
  if (rate === SR) return samples;
  const out = [];
  const ratio = rate / SR;
  const outN = Math.floor(samples.length / ratio);
  for (let i = 0; i < outN; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const f = src - i0;
    out.push((samples[i0] || 0) * (1 - f) + (samples[i0 + 1] || samples[i0] || 0) * f);
  }
  return out;
}

function peakNorm(samples, target = 0.92) {
  let peak = 0;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  if (peak < 1e-4) return samples.slice();
  const g = target / peak;
  return samples.map((x) => Math.max(-1, Math.min(1, x * g)));
}

function countPeaks(samples) {
  let peaks = 0;
  const step = Math.floor(SR * 0.08);
  for (let i = Math.floor(SR * 0.01); i < samples.length - 2; i++) {
    if (
      Math.abs(samples[i]) > 0.35 &&
      Math.abs(samples[i]) > Math.abs(samples[i - 1]) &&
      Math.abs(samples[i]) >= Math.abs(samples[i + 1])
    ) {
      peaks++;
      i += step;
    }
  }
  return peaks;
}

function extractDing(samples) {
  let bestI = 0;
  let bestV = -1;
  const win = Math.floor(SR * 0.015);
  const search = Math.min(samples.length, Math.floor(SR * 2.5));
  for (let i = win; i < search - win; i += 4) {
    let a = 0;
    let b = 0;
    for (let k = 0; k < win; k++) {
      a += Math.abs(samples[i - win + k]);
      b += Math.abs(samples[i + k]);
    }
    const sc = b - a * 0.5;
    if (sc > bestV) {
      bestV = sc;
      bestI = i;
    }
  }
  const start = Math.max(0, bestI - Math.floor(SR * 0.008));
  const end = Math.min(samples.length, start + Math.floor(SR * 0.18));
  return peakNorm(samples.slice(start, end), 0.95);
}

function quickFour(ding) {
  const out = [];
  const gap = Math.floor(SR * 0.035);
  for (let i = 0; i < 4; i++) {
    for (const x of ding) out.push(x);
    if (i < 3) for (let g = 0; g < gap; g++) out.push(0);
  }
  for (let g = 0; g < Math.floor(SR * 0.2); g++) out.push(0);
  return peakNorm(out, 0.95);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));

  // Ambulance: extend by repeating real recording
  const ambSrc = readWav(path.join(AUDIO, "ambulance_siren.wav"));
  const ambOut = [];
  const gap = Math.floor(SR * 0.05);
  const reps = 6;
  for (let r = 0; r < reps; r++) {
    for (const x of ambSrc) ambOut.push(x);
    if (r < reps - 1) for (let g = 0; g < gap; g++) ambOut.push(0);
  }
  writeWav(path.join(AUDIO, "ambulance_siren.wav"), peakNorm(ambOut, 0.93));
  const ambEntry = catalog.sounds.find((x) => x.id === "ambulance_siren");
  ambEntry.attribution = "Ambulance — Mike Koenig (SoundBible), loop-extended";
  ambEntry.path = "res://assets/audio/ambulance_siren.wav";
  console.log("ambulance dur", (ambOut.length / SR).toFixed(1));

  // Bike: try several real BSB bells
  const candidates = ["1102", "1042", "0028", "0275", "0974"];
  let best = null;
  let bestScore = -1;
  for (const id of candidates) {
    try {
      const mp3 = path.join(TMP, "bike_" + id + ".mp3");
      await download("https://bigsoundbank.com/UPLOAD/mp3/" + id + ".mp3", mp3);
      const wav = path.join(TMP, "bike_" + id + ".wav");
      toWav(mp3, wav);
      const samples = readWav(wav);
      const peaks = countPeaks(samples);
      const score = peaks * 3 + Math.min(samples.length / SR, 4);
      console.log("bike", id, "len", (samples.length / SR).toFixed(2), "peaks", peaks, "score", score.toFixed(1));
      if (score > bestScore) {
        bestScore = score;
        best = { id, samples, peaks };
      }
    } catch (e) {
      console.log("bike", id, "fail", e.message);
    }
  }
  if (!best) throw new Error("no bike candidates");

  let finalSamples;
  if (best.peaks >= 3 && best.samples.length / SR >= 1.2) {
    finalSamples = peakNorm(best.samples, 0.95);
    console.log("using natural multi-ring", best.id);
  } else {
    finalSamples = quickFour(extractDing(best.samples));
    console.log("using quick-four from", best.id);
  }
  writeWav(path.join(AUDIO, "bicycle_bell.wav"), finalSamples);
  const bikeEntry = catalog.sounds.find((x) => x.id === "bicycle_bell");
  bikeEntry.path = "res://assets/audio/bicycle_bell.wav";
  bikeEntry.license = "CC0";
  bikeEntry.attribution = "Bicycle bell (BigSoundBank #" + best.id + " / StimPad edit)";
  bikeEntry.mode = "oneshot";
  console.log("bike written", best.id, "dur", (finalSamples.length / SR).toFixed(2));

  // Fire engine confirmed OK
  const fire = catalog.sounds.find((x) => x.id === "fire_truck_siren");
  if (fire) {
    // leave as-is
  }

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
