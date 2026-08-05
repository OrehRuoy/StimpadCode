/**
 * Replace mismatched Alarms/Bells audio with CC0 BigSoundBank recordings
 * (+ accurate generated smoke-detector T3 pattern).
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const SR = 44100;

const BSB = {
  ambulance_siren: {
    id: "1463",
    title: "Ambulance 3-ton siren (CC0 BigSoundBank #1463)",
    mode: "loop",
  },
  fire_truck_siren: {
    id: "2731",
    title: "Civil security truck siren (CC0 BigSoundBank #2731)",
    mode: "loop",
  },
  tornado_siren: {
    id: "3259",
    title: "National alert / civil defense siren (CC0 BigSoundBank #3259)",
    mode: "loop",
  },
  alarm_clock: {
    id: "2659",
    title: "Mechanical alarm clock ring (CC0 BigSoundBank #2659)",
    mode: "oneshot",
  },
  bicycle_bell: {
    id: "0974",
    title: "Bicycle bell #3 (CC0 BigSoundBank #0974)",
    mode: "oneshot",
  },
  fire_whistle: {
    id: "1017",
    title: "Plastic whistle (CC0 BigSoundBank #1017)",
    mode: "oneshot",
  },
};

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

/** NFPA-style smoke detector temporal-3: beep-beep-beep, pause, repeat. */
function genSmokeDetector() {
  const dur = 6.0;
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  const beepLen = 0.1;
  const gap = 0.1;
  const groupGap = 0.7;
  const pattern = [];
  let t = 0.15;
  while (t < dur - 1.0) {
    for (let b = 0; b < 3; b++) {
      pattern.push([t, t + beepLen]);
      t += beepLen + gap;
    }
    t += groupGap;
  }
  for (let i = 0; i < n; i++) {
    const tt = i / SR;
    let on = false;
    for (const [a, b] of pattern) {
      if (tt >= a && tt < b) {
        on = true;
        break;
      }
    }
    if (!on) continue;
    const local = tt % 1;
    const env = Math.min(1, (tt - Math.floor(tt / 0.1) * 0.1) / 0.008);
    // ~3100 Hz piercing piezo + slight harmonics
    out[i] =
      (Math.sin(2 * Math.PI * 3100 * tt) * 0.55 +
        Math.sin(2 * Math.PI * 6200 * tt) * 0.18) *
      env *
      0.9;
  }
  return out;
}

function updateEntry(sounds, id, patch) {
  const s = sounds.find((x) => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
}

function upsertManifest(manifest, entry) {
  const i = manifest.findIndex((m) => m.id === entry.id);
  if (i >= 0) manifest[i] = entry;
  else manifest.push(entry);
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  let manifest = [];
  if (fs.existsSync(MANIFEST)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    } catch {
      manifest = [];
    }
  }
  fs.mkdirSync(AUDIO, { recursive: true });

  for (const [id, meta] of Object.entries(BSB)) {
    const url = `https://bigsoundbank.com/UPLOAD/mp3/${meta.id}.mp3`;
    const dest = path.join(AUDIO, `${id}.mp3`);
    console.log("download", id, url);
    await download(url, dest);
    // remove stale wav if switching from generated
    const wav = path.join(AUDIO, `${id}.wav`);
    if (fs.existsSync(wav)) fs.unlinkSync(wav);
    for (const ext of [".wav.import", ".mp3.import"]) {
      const p = path.join(AUDIO, id + ext);
      // keep imports; Godot regenerates
    }
    updateEntry(catalog.sounds, id, {
      path: `res://assets/audio/${id}.mp3`,
      license: "CC0",
      attribution: meta.title,
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
      mode: meta.mode,
      default_duration_sec: meta.mode === "loop" ? 60 : 0,
    });
    // Rename display for fire whistle clarity
    if (id === "fire_whistle") {
      updateEntry(catalog.sounds, id, {
        name: "Referee Whistle",
      });
    }
    if (id === "alarm_clock") {
      updateEntry(catalog.sounds, id, {
        name: "Ringing Alarm Clock",
      });
    }
    upsertManifest(manifest, {
      id,
      source: "bigsoundbank",
      bsb_id: meta.id,
      title: meta.title,
      url,
    });
    console.log("ok", id, fs.statSync(dest).size);
  }

  // Smoke detector: accurate T3 pattern
  const smokePath = path.join(AUDIO, "smoke_alarm.wav");
  writeWav(smokePath, genSmokeDetector());
  const smokeMp3 = path.join(AUDIO, "smoke_alarm.mp3");
  if (fs.existsSync(smokeMp3)) fs.unlinkSync(smokeMp3);
  updateEntry(catalog.sounds, "smoke_alarm", {
    path: "res://assets/audio/smoke_alarm.wav",
    license: "CC0",
    attribution: "Smoke detector Temporal-3 beep pattern (StimPad CC0)",
    mixkit_id: 0,
    mixkit_title: "",
    mixkit_url: "",
    mode: "loop",
    default_duration_sec: 60,
  });
  upsertManifest(manifest, {
    id: "smoke_alarm",
    source: "generated",
    title: "Smoke detector Temporal-3 beep pattern (CC0)",
  });
  console.log("generated smoke_alarm.wav");

  // Leave police_siren as Mixkit (user said OK)
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log("catalog updated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
