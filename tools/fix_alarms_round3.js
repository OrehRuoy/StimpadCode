/**
 * Round 3: REAL recordings only (no synth sirens).
 * - SoundBible CC BY ambulance / fire truck
 * - Process alarm louder + less fade
 * - Bike bell = 4 very quick dings
 */
const https = require("https");
const http = require("http");
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
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    lib
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(new URL(res.headers.location, url).href, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
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
  if (r.status !== 0) {
    throw new Error("ffmpeg failed:\n" + (r.stderr || r.stdout || ""));
  }
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

function readWavMono(filePath) {
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
  const nFrames = Math.floor(dataSize / ((bits / 8) * channels));
  for (let i = 0; i < nFrames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const idx = dataOffset + (i * channels + c) * (bits / 8);
      sum += bits === 16 ? buf.readInt16LE(idx) / 32768 : 0;
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
    const a = samples[i0] || 0;
    const b = samples[i0 + 1] || a;
    out.push(a * (1 - f) + b * f);
  }
  return out;
}

function peakNormalize(samples, target = 0.92) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  if (peak < 0.0001) return samples.slice();
  const g = target / peak;
  return samples.map((s) => Math.max(-1, Math.min(1, s * g)));
}

function trimSilence(samples, thresh = 0.012) {
  let start = 0;
  let end = samples.length - 1;
  while (start < end && Math.abs(samples[start]) < thresh) start++;
  while (end > start && Math.abs(samples[end]) < thresh) end--;
  // keep a tiny tail so it doesn't click, but not a long fade-to-nothing
  end = Math.min(samples.length - 1, end + Math.floor(SR * 0.04));
  return samples.slice(start, end + 1);
}

function findBestDing(samples, maxLenSec = 0.28) {
  const maxLen = Math.floor(SR * maxLenSec);
  // find loudest onset in first 2 seconds
  const searchN = Math.min(samples.length, Math.floor(SR * 2.5));
  let best = 0;
  let bestScore = -1;
  const win = Math.floor(SR * 0.02);
  for (let i = win; i < searchN - win; i += 8) {
    let before = 0;
    let after = 0;
    for (let k = 0; k < win; k++) {
      before += Math.abs(samples[i - win + k]);
      after += Math.abs(samples[i + k]);
    }
    const score = after - before * 0.6;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  const start = Math.max(0, best - Math.floor(SR * 0.01));
  let end = Math.min(samples.length, start + maxLen);
  // cut earlier if energy already low
  for (let i = start + Math.floor(SR * 0.08); i < end; i++) {
    if (Math.abs(samples[i]) < 0.04) {
      // confirm quiet for a bit
      let quiet = true;
      for (let k = 0; k < Math.floor(SR * 0.04) && i + k < end; k++) {
        if (Math.abs(samples[i + k]) > 0.05) {
          quiet = false;
          break;
        }
      }
      if (quiet) {
        end = i + Math.floor(SR * 0.03);
        break;
      }
    }
  }
  return peakNormalize(samples.slice(start, end), 0.95);
}

function quickMultiDing(ding, count = 4, gapSec = 0.05) {
  const gap = Math.floor(SR * gapSec);
  const out = [];
  for (let i = 0; i < count; i++) {
    for (const s of ding) out.push(s);
    if (i < count - 1) {
      for (let g = 0; g < gap; g++) out.push(0);
    }
  }
  // short natural decay silence
  for (let g = 0; g < Math.floor(SR * 0.15); g++) out.push(0);
  return out;
}

function updateEntry(sounds, id, patch) {
  const s = sounds.find((x) => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
}

function rmIf(p) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));

  // --- Ambulance: SoundBible #558 real pass-by (CC BY 3.0) ---
  {
    const mp3 = path.join(TMP, "ambulance.mp3");
    await download("http://soundbible.com/grab.php?id=558&type=mp3", mp3);
    const wav = path.join(AUDIO, "ambulance_siren.wav");
    toWav(mp3, wav);
    // loudness normalize via ffmpeg as well
    const loud = path.join(TMP, "ambulance_loud.wav");
    ffmpeg([
      "-y",
      "-i",
      wav,
      "-af",
      "loudnorm=I=-14:TP=-1.5:LRA=11,volume=1.15",
      "-ac",
      "1",
      "-ar",
      String(SR),
      loud,
    ]);
    fs.copyFileSync(loud, wav);
    rmIf(path.join(AUDIO, "ambulance_siren.mp3"));
    updateEntry(catalog.sounds, "ambulance_siren", {
      path: "res://assets/audio/ambulance_siren.wav",
      license: "CC BY 3.0",
      attribution: "Ambulance — Mike Koenig (SoundBible)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
      mode: "loop",
      default_duration_sec: 60,
    });
    console.log("ambulance", fs.statSync(wav).size);
  }

  // --- Fire truck: SoundBible #1511 real recording (CC BY 3.0) ---
  {
    const mp3 = path.join(TMP, "fire.mp3");
    await download("http://soundbible.com/grab.php?id=1511&type=mp3", mp3);
    const wav = path.join(AUDIO, "fire_truck_siren.wav");
    toWav(mp3, wav);
    const loud = path.join(TMP, "fire_loud.wav");
    ffmpeg([
      "-y",
      "-i",
      wav,
      "-af",
      "loudnorm=I=-14:TP=-1.5:LRA=11,volume=1.1",
      "-ac",
      "1",
      "-ar",
      String(SR),
      loud,
    ]);
    fs.copyFileSync(loud, wav);
    rmIf(path.join(AUDIO, "fire_truck_siren.mp3"));
    updateEntry(catalog.sounds, "fire_truck_siren", {
      path: "res://assets/audio/fire_truck_siren.wav",
      license: "CC BY 3.0",
      attribution: "Fire Truck Siren — FiremanSam (SoundBible)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
      mode: "loop",
      default_duration_sec: 60,
    });
    console.log("fire", fs.statSync(wav).size);
  }

  // --- Alarm clock: louder, cut long fade, keep ringing energy ---
  {
    const src = path.join(AUDIO, "alarm_clock.wav");
    if (!fs.existsSync(src)) {
      // fallback from any leftover mp3
      const mp3 = path.join(AUDIO, "alarm_clock.mp3");
      if (fs.existsSync(mp3)) toWav(mp3, src);
    }
    let samples = readWavMono(src);
    samples = trimSilence(samples, 0.02);
    // remove trailing soft fade: cut once envelope drops below 25% of peak for 80ms
    let peak = 0;
    for (const s of samples) peak = Math.max(peak, Math.abs(s));
    const cutThresh = peak * 0.28;
    const hold = Math.floor(SR * 0.08);
    let cut = samples.length;
    for (let i = Math.floor(samples.length * 0.35); i < samples.length - hold; i++) {
      let low = true;
      for (let k = 0; k < hold; k++) {
        if (Math.abs(samples[i + k]) > cutThresh) {
          low = false;
          break;
        }
      }
      if (low) {
        cut = i + Math.floor(SR * 0.02);
        break;
      }
    }
    samples = samples.slice(0, cut);
    samples = peakNormalize(samples, 0.95);
    // repeat solid rings with tiny gaps (no long decay between)
    const gap = Math.floor(SR * 0.04);
    const out = [];
    for (let r = 0; r < 5; r++) {
      for (const s of samples) out.push(s);
      if (r < 4) for (let g = 0; g < gap; g++) out.push(0);
    }
    const dest = path.join(AUDIO, "alarm_clock.wav");
    writeWav(dest, peakNormalize(out, 0.95));
    rmIf(path.join(AUDIO, "alarm_clock.mp3"));
    updateEntry(catalog.sounds, "alarm_clock", {
      path: "res://assets/audio/alarm_clock.wav",
      name: "Ringing Alarm Clock",
      mode: "oneshot",
      license: "CC0",
      attribution: "Mechanical alarm clock ring, loudness-fixed (BigSoundBank #2659 / StimPad edit)",
    });
    console.log("alarm", fs.statSync(dest).size, "dur~", (out.length / SR).toFixed(2));
  }

  // --- Bike bell: keep CC0 BigSoundBank source; edit to 4 very quick dings ---
  // (SoundBible #292 is Personal Use Only — not usable for a store app.)
  {
    let srcWav = path.join(AUDIO, "bicycle_bell.wav");
    if (!fs.existsSync(srcWav)) {
      const mp3 = path.join(AUDIO, "bicycle_bell.mp3");
      if (fs.existsSync(mp3)) {
        srcWav = path.join(TMP, "bike_src.wav");
        toWav(mp3, srcWav);
      } else {
        // re-download CC0 BigSoundBank #0974
        const mp3New = path.join(TMP, "bike_bsb.mp3");
        await download("https://bigsoundbank.com/UPLOAD/mp3/0974.mp3", mp3New);
        srcWav = path.join(TMP, "bike_src.wav");
        toWav(mp3New, srcWav);
      }
    }
    const samples = readWavMono(srcWav);
    const ding = findBestDing(samples, 0.2);
    const multi = quickMultiDing(ding, 4, 0.04);
    const dest = path.join(AUDIO, "bicycle_bell.wav");
    writeWav(dest, peakNormalize(multi, 0.95));
    rmIf(path.join(AUDIO, "bicycle_bell.mp3"));
    updateEntry(catalog.sounds, "bicycle_bell", {
      path: "res://assets/audio/bicycle_bell.wav",
      mode: "oneshot",
      license: "CC0",
      attribution: "Bicycle bell — 4 quick dings (BigSoundBank #0974 / StimPad edit)",
    });
    console.log("bike quick4", fs.statSync(dest).size, "ding", ding.length, "total", multi.length);
  }

  // Smoke stays OK
  updateEntry(catalog.sounds, "smoke_alarm", {
    // ensure path still valid
    path: "res://assets/audio/smoke_alarm.wav",
  });

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
