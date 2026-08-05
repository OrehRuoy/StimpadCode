/**
 * Round-2 audio fixes using Wikimedia + synthesis + looping.
 * Sources: Wikimedia Commons (CC BY / CC BY-SA), StimPad synthesis (CC0).
 */
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const SR = 44100;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    lib
      .get(url, { headers: { "User-Agent": "StimPad/1.0 (audio fix)" } }, (res) => {
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
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("not wav " + filePath);
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
  if (dataOffset < 0) throw new Error("no data " + filePath);
  const samples = [];
  if (bits === 16) {
    const n = Math.floor(dataSize / 2);
    for (let i = 0; i < n; i += channels) {
      let sum = 0;
      for (let c = 0; c < channels; c++) {
        sum += buf.readInt16LE(dataOffset + (i + c) * 2) / 32768;
      }
      samples.push(sum / channels);
    }
  } else {
    throw new Error("unsupported bits " + bits);
  }
  // resample if needed
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

/** Classic US ambulance yelp: rapid hi/lo sweep (~3–5 Hz cycle). */
function genUsAmbulanceYelp(durSec = 8) {
  const n = Math.floor(SR * durSec);
  const out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // yelp: triangle LFO between ~600–1600 Hz, ~4.5 cycles/sec
    const lfo = (t * 4.5) % 1;
    const tri = lfo < 0.5 ? lfo * 2 : 2 - lfo * 2;
    const freq = 650 + tri * 1050;
    phase += (2 * Math.PI * freq) / SR;
    const tone = Math.sin(phase);
    // slight grit
    const harm = Math.sin(phase * 2) * 0.12;
    const env = Math.min(1, t / 0.02) * Math.min(1, (durSec - t) / 0.05);
    out[i] = (tone * 0.72 + harm) * env * 0.9;
  }
  return out;
}

/** Improved smoke detector Temporal-3 piezo. */
function genSmokeT3(durSec = 8) {
  const n = Math.floor(SR * durSec);
  const out = new Float64Array(n);
  const beep = 0.5; // longer, more recognizable
  const gap = 0.5;
  const pause = 1.5;
  let t0 = 0.2;
  const windows = [];
  while (t0 < durSec - 1) {
    for (let k = 0; k < 3; k++) {
      windows.push([t0, t0 + beep]);
      t0 += beep + gap;
    }
    t0 += pause;
  }
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let active = false;
    let local = 0;
    for (const [a, b] of windows) {
      if (t >= a && t < b) {
        active = true;
        local = t - a;
        break;
      }
    }
    if (!active) continue;
    const env = Math.min(1, local / 0.01) * Math.min(1, (beep - local) / 0.02);
    // square-ish piezo ~3.2kHz
    const sq = Math.sign(Math.sin(2 * Math.PI * 3200 * t));
    const fund = Math.sin(2 * Math.PI * 3200 * t);
    out[i] = (fund * 0.55 + sq * 0.25) * env * 0.85;
  }
  return out;
}

function concatWithGaps(clips, gapSec, repeats) {
  const gapN = Math.floor(SR * gapSec);
  const out = [];
  for (let r = 0; r < repeats; r++) {
    for (const clip of clips) {
      for (const s of clip) out.push(s);
      for (let g = 0; g < gapN; g++) out.push(0);
    }
  }
  return out;
}

function extendByRepeat(samples, times, gapSec = 0.15) {
  return concatWithGaps([samples], gapSec, times);
}

function updateEntry(sounds, id, patch) {
  const s = sounds.find((x) => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
}

function ffmpegToWav(src, destWav) {
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", src, "-ac", "1", "-ar", String(SR), destWav],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    throw new Error("ffmpeg failed: " + (r.stderr || r.stdout || ""));
  }
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  fs.mkdirSync(AUDIO, { recursive: true });
  const tmp = path.join(AUDIO, "_tmp");
  fs.mkdirSync(tmp, { recursive: true });

  // --- Ambulance: synthesized US yelp (CC0) — much closer to expected sound ---
  {
    const samples = genUsAmbulanceYelp(10);
    const dest = path.join(AUDIO, "ambulance_siren.wav");
    writeWav(dest, samples);
    const mp3 = path.join(AUDIO, "ambulance_siren.mp3");
    if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
    updateEntry(catalog.sounds, "ambulance_siren", {
      path: "res://assets/audio/ambulance_siren.wav",
      license: "CC0",
      attribution: "US ambulance yelp siren synthesis (StimPad CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
      mode: "loop",
      default_duration_sec: 60,
      name: "Ambulance Yelp Siren",
    });
    console.log("wrote ambulance yelp wav");
  }

  // --- Fire engine: Wikimedia WWS Fireenginesiren (CC BY 4.0) ---
  {
    const oggUrl =
      "https://upload.wikimedia.org/wikipedia/commons/4/4d/WWS_Fireenginesiren.ogg";
    const ogg = path.join(tmp, "fire.ogg");
    const wav = path.join(AUDIO, "fire_truck_siren.wav");
    try {
      await download(oggUrl, ogg);
      ffmpegToWav(ogg, wav);
      const mp3 = path.join(AUDIO, "fire_truck_siren.mp3");
      if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
      updateEntry(catalog.sounds, "fire_truck_siren", {
        path: "res://assets/audio/fire_truck_siren.wav",
        license: "CC BY 4.0",
        attribution: "Work With Sounds — Fire engine Martinshorn (Wikimedia)",
        mixkit_id: 0,
        mixkit_title: "",
        mixkit_url: "",
        mode: "loop",
        default_duration_sec: 60,
      });
      console.log("wrote fire_truck_siren from Wikimedia");
    } catch (e) {
      console.warn("fire truck download/convert failed:", e.message);
      // fallback: synthesize US fire wail (slow hi-lo)
      const n = Math.floor(SR * 10);
      const out = new Float64Array(n);
      let phase = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const lfo = (Math.sin(2 * Math.PI * 0.35 * t) + 1) * 0.5;
        const freq = 500 + lfo * 900;
        phase += (2 * Math.PI * freq) / SR;
        out[i] = Math.sin(phase) * 0.7;
      }
      writeWav(wav, out);
      updateEntry(catalog.sounds, "fire_truck_siren", {
        path: "res://assets/audio/fire_truck_siren.wav",
        license: "CC0",
        attribution: "Fire engine wail synthesis (StimPad CC0)",
        mode: "loop",
        default_duration_sec: 60,
      });
      console.log("wrote fire_truck fallback synth");
    }
  }

  // --- Alarm clock: extend existing ring by repeating ---
  {
    const srcMp3 = path.join(AUDIO, "alarm_clock.mp3");
    const tmpWav = path.join(tmp, "alarm.wav");
    ffmpegToWav(srcMp3, tmpWav);
    const samples = readWavMono(tmpWav);
    // trim trailing silence fade
    let end = samples.length - 1;
    while (end > 0 && Math.abs(samples[end]) < 0.01) end--;
    const trimmed = samples.slice(0, end + 1);
    const extended = extendByRepeat(trimmed, 4, 0.08);
    const dest = path.join(AUDIO, "alarm_clock.wav");
    writeWav(dest, extended);
    if (fs.existsSync(srcMp3)) fs.unlinkSync(srcMp3);
    updateEntry(catalog.sounds, "alarm_clock", {
      path: "res://assets/audio/alarm_clock.wav",
      mode: "oneshot",
      default_duration_sec: 0,
      name: "Ringing Alarm Clock",
      license: "CC0",
      attribution: "Mechanical alarm clock ring extended (BigSoundBank #2659 / StimPad)",
    });
    console.log("extended alarm_clock");
  }

  // --- Bike bell: ring several times ---
  {
    const srcMp3 = path.join(AUDIO, "bicycle_bell.mp3");
    const tmpWav = path.join(tmp, "bike.wav");
    ffmpegToWav(srcMp3, tmpWav);
    let samples = readWavMono(tmpWav);
    // Keep first ~1.2s ding if long recording has many already; else repeat
    const maxKeep = Math.floor(SR * 1.4);
    if (samples.length > maxKeep * 3) {
      // already multi — take a clear single ding window then repeat
      samples = samples.slice(0, maxKeep);
    } else if (samples.length > maxKeep) {
      samples = samples.slice(0, maxKeep);
    }
    const multi = extendByRepeat(samples, 4, 0.22);
    const dest = path.join(AUDIO, "bicycle_bell.wav");
    writeWav(dest, multi);
    if (fs.existsSync(srcMp3)) fs.unlinkSync(srcMp3);
    updateEntry(catalog.sounds, "bicycle_bell", {
      path: "res://assets/audio/bicycle_bell.wav",
      mode: "oneshot",
      name: "Bike Handlebar Bell",
      license: "CC0",
      attribution: "Bicycle bell multi-ring (BigSoundBank #0974 / StimPad edit)",
    });
    console.log("multi-ring bicycle_bell");
  }

  // --- Smoke detector improved T3 ---
  {
    const dest = path.join(AUDIO, "smoke_alarm.wav");
    writeWav(dest, genSmokeT3(10));
    const mp3 = path.join(AUDIO, "smoke_alarm.mp3");
    if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
    updateEntry(catalog.sounds, "smoke_alarm", {
      path: "res://assets/audio/smoke_alarm.wav",
      license: "CC0",
      attribution: "Smoke detector Temporal-3 piezo pattern (StimPad CC0)",
      mode: "loop",
      default_duration_sec: 60,
    });
    console.log("improved smoke_alarm");
  }

  // --- Whistle rename ---
  updateEntry(catalog.sounds, "fire_whistle", {
    name: "Whistle",
  });

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
  console.log("catalog updated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
