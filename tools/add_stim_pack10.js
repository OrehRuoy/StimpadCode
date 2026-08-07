/**
 * Install 10 new stim sounds with carefully chosen commercial-safe sources.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const ART = path.join(ROOT, "assets", "art", "sounds");
const TMP = path.join(AUDIO, "_tmp_new10");
const SOUNDS = path.join(ROOT, "data", "sounds.json");
const CSV = path.join(ROOT, "data", "sound_art_map.csv");
const GEN_ART = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-Ultima-Desktop-StimPad",
  "assets"
);
const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return get(new URL(res.headers.location, url).href).then(resolve).catch(reject);
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "StimPad/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error("HTTP " + res.statusCode + " " + url));
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", reject);
  });
}

function run(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-1400));
}

function probe(f) {
  return Number(
    spawnSync(
      FFPROBE,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", f],
      { encoding: "utf8" }
    ).stdout.trim()
  );
}

async function fsPreview(id) {
  const html = await get("https://freesound.org/s/" + id + "/");
  const m = html.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  if (!m) throw new Error("no preview " + id);
  return `https://cdn.freesound.org/previews/${Math.floor(Number(id) / 1000)}/${m[1]}-hq.mp3`;
}

const ENTRIES = [
  {
    id: "keyboard_thock",
    name: "Thocky Keyboard",
    category: "Clicks",
    mode: "loop",
    duration: 60,
    animation: "tap_teal",
    license: "CC0",
    attribution:
      "Mechanical Keyboard Typing Bass Version (Freesound #450281 by stu556, CC0)",
    source: async (raw) => {
      await download(await fsPreview(450281), raw);
      // Deep thock loop — take a clean mid section and crossfade
      run([
        "-ss",
        "12",
        "-t",
        "24",
        "-i",
        raw,
        "-af",
        "highpass=f=60,loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:st=0:d=0.08,afade=t=out:st=23.7:d=0.3",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "keyboard_thock.wav"),
      ]);
    },
  },
  {
    id: "relay_click",
    name: "Relay Click",
    category: "Clicks",
    mode: "oneshot",
    duration: 0,
    animation: "click_white",
    license: "CC0",
    attribution:
      "Siemens contactor / overload relay clicks (Freesound #807384 by tt_runscript, CC0)",
    source: async (raw) => {
      await download(await fsPreview(807384), raw);
      // First ~8s = manual overload relay snaps (before loud contactor thunks)
      run([
        "-t",
        "8.2",
        "-i",
        raw,
        "-af",
        "highpass=f=120,loudnorm=I=-14:TP=-1.2:LRA=8,afade=t=in:st=0:d=0.01,afade=t=out:st=7.9:d=0.25",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "relay_click.wav"),
      ]);
    },
  },
  {
    id: "circuit_breaker",
    name: "Circuit Breaker",
    category: "Clicks",
    mode: "oneshot",
    duration: 0,
    animation: "click_white",
    license: "CC0",
    attribution:
      "Dual-pole household circuit breaker (Freesound #130153 by sribubba, CC0)",
    source: async (raw) => {
      await download(await fsPreview(130153), raw);
      run([
        "-i",
        raw,
        "-af",
        "loudnorm=I=-12:TP=-1:LRA=6,afade=t=in:st=0:d=0.005,afade=t=out:st=0.55:d=0.12",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "circuit_breaker.wav"),
      ]);
    },
  },
  {
    id: "rotary_selector",
    name: "Rotary Selector",
    category: "Clicks",
    mode: "oneshot",
    duration: 0,
    animation: "spin_teal",
    license: "CC0",
    attribution:
      "Rotary switch + relay (Freesound #112844 by xdrav, CC0)",
    source: async (raw) => {
      await download(await fsPreview(112844), raw);
      run([
        "-i",
        raw,
        "-af",
        "highpass=f=100,afftdn=nr=8:nf=-32,loudnorm=I=-14:TP=-1.2:LRA=8,afade=t=in:st=0:d=0.02,afade=t=out:st=3.1:d=0.25",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "rotary_selector.wav"),
      ]);
    },
  },
  {
    id: "magnetic_fidget",
    name: "Magnetic Fidget",
    category: "Clicks",
    mode: "oneshot",
    duration: 0,
    animation: "tap_teal",
    license: "CC0",
    attribution:
      "Ball of Whacks magnet clicks (Freesound #189315 by qubodup, CC0)",
    source: async (raw) => {
      await download(await fsPreview(189315), raw);
      run([
        "-ss",
        "2",
        "-t",
        "6.5",
        "-i",
        raw,
        "-af",
        "highpass=f=80,loudnorm=I=-14:TP=-1.2:LRA=8,afade=t=in:st=0:d=0.02,afade=t=out:st=6.2:d=0.25",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "magnetic_fidget.wav"),
      ]);
    },
  },
  {
    id: "magsafe_snap",
    name: "Magnetic Charger Snap",
    category: "Clicks",
    mode: "oneshot",
    duration: 0,
    animation: "click_white",
    license: "CC0",
    attribution: "Metal snap buttons (Freesound #459583 by vintage2005, CC0)",
    source: async (raw) => {
      await download(await fsPreview(459583), raw);
      // First clean snap pair
      run([
        "-t",
        "1.6",
        "-i",
        raw,
        "-af",
        "highpass=f=150,loudnorm=I=-12:TP=-1:LRA=6,afade=t=in:st=0:d=0.005,afade=t=out:st=1.35:d=0.2",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "magsafe_snap.wav"),
      ]);
    },
  },
  {
    id: "rain_metal_roof",
    name: "Rain on Metal Roof",
    category: "Water",
    mode: "loop",
    duration: 60,
    animation: "ripple_blue",
    license: "CC0",
    attribution: "Big rain on car roof (BigSoundBank #1294 by Joseph Sardin, CC0)",
    source: async (raw) => {
      await download("https://bigsoundbank.com/UPLOAD/mp3/1294.mp3", raw);
      run([
        "-i",
        raw,
        "-af",
        "highpass=f=80,loudnorm=I=-17:TP=-1.8:LRA=10,afade=t=in:st=0:d=0.4,afade=t=out:st=78:d=0.6",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "rain_metal_roof.wav"),
      ]);
    },
  },
  {
    id: "nails_glass",
    name: "Nails on Glass",
    category: "Clicks",
    mode: "oneshot",
    duration: 0,
    animation: "tap_teal",
    license: "CC0",
    attribution:
      "Glass tapped by fingernail (Freesound #51038 by RutgerMuller, CC0)",
    source: async (raw) => {
      await download(await fsPreview(51038), raw);
      run([
        "-i",
        raw,
        "-af",
        "highpass=f=200,loudnorm=I=-14:TP=-1.2:LRA=7,afade=t=in:st=0:d=0.01,afade=t=out:st=9.4:d=0.3",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "nails_glass.wav"),
      ]);
    },
  },
  {
    id: "nails_plastic",
    name: "Nails on Plastic",
    category: "Clicks",
    mode: "oneshot",
    duration: 0,
    animation: "tap_teal",
    license: "CC BY",
    attribution:
      "Tapping on hard plastic / fingernail (Freesound #445147 by Benjamin152, CC BY)",
    source: async (raw) => {
      await download(await fsPreview(445147), raw);
      run([
        "-i",
        raw,
        "-af",
        "highpass=f=150,loudnorm=I=-14:TP=-1.2:LRA=7,afade=t=in:st=0:d=0.01,afade=t=out:st=10.2:d=0.3",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "nails_plastic.wav"),
      ]);
    },
  },
  {
    id: "nails_wood",
    name: "Nails on Wood",
    category: "Clicks",
    mode: "oneshot",
    duration: 0,
    animation: "tap_teal",
    license: "CC0",
    attribution:
      "Fingernails tapping wooden desk (Freesound #445529 by 180007, CC0)",
    source: async (raw) => {
      await download(await fsPreview(445529), raw);
      run([
        "-i",
        raw,
        "-af",
        "highpass=f=100,loudnorm=I=-14:TP=-1.2:LRA=7,afade=t=in:st=0:d=0.01,afade=t=out:st=5.5:d=0.3",
        "-ac",
        "1",
        "-ar",
        "44100",
        path.join(AUDIO, "nails_wood.wav"),
      ]);
    },
  },
];

function copyArt(id) {
  const candidates = [
    path.join(GEN_ART, id + ".png"),
    path.join(ROOT, "assets", id + ".png"),
  ];
  const src = candidates.find((p) => fs.existsSync(p));
  if (!src) throw new Error("Missing generated art for " + id);
  fs.copyFileSync(src, path.join(ART, id + ".png"));
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS, "utf8"));
  const existing = new Set(catalog.sounds.map((s) => s.id));

  for (const e of ENTRIES) {
    console.log("==>", e.id);
    copyArt(e.id);
    const raw = path.join(TMP, e.id + "_raw.mp3");
    await e.source(raw);
    const out = path.join(AUDIO, e.id + ".wav");
    console.log("   audio", probe(out).toFixed(2) + "s");
    for (const ext of ["mp3", "ogg"]) {
      const p = path.join(AUDIO, e.id + "." + ext);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (!existing.has(e.id)) {
      catalog.sounds.push({
        id: e.id,
        name: e.name,
        category: e.category,
        tier: "plus",
        mode: e.mode,
        path: "res://assets/audio/" + e.id + ".wav",
        art: "res://assets/art/sounds/" + e.id + ".png",
        animation: e.animation,
        default_duration_sec: e.duration,
        license: e.license,
        attribution: e.attribution,
        mixkit_id: 0,
        mixkit_title: "",
        mixkit_url: "",
      });
      existing.add(e.id);
    } else {
      const s = catalog.sounds.find((x) => x.id === e.id);
      Object.assign(s, {
        name: e.name,
        category: e.category,
        tier: "plus",
        mode: e.mode,
        path: "res://assets/audio/" + e.id + ".wav",
        art: "res://assets/art/sounds/" + e.id + ".png",
        animation: e.animation,
        default_duration_sec: e.duration,
        license: e.license,
        attribution: e.attribution,
      });
    }
  }

  // Keep Clicks together: sort sounds by preferred category then name
  const preferred = [
    "Alarms",
    "Bells",
    "Household",
    "Clicks",
    "Vehicles",
    "Water",
    "Noise",
    "Nature",
    "Animals",
    "Tools",
    "Retro",
    "Misc",
  ];
  catalog.sounds.sort((a, b) => {
    const ia = preferred.indexOf(a.category);
    const ib = preferred.indexOf(b.category);
    const ca = ia < 0 ? 99 : ia;
    const cb = ib < 0 ? 99 : ib;
    if (ca !== cb) return ca - cb;
    return String(a.name).localeCompare(String(b.name));
  });

  fs.writeFileSync(SOUNDS, JSON.stringify(catalog, null, 2) + "\n");

  // Append CSV rows if missing
  let csv = fs.readFileSync(CSV, "utf8");
  for (const e of ENTRIES) {
    if (!csv.includes(e.id + ",")) {
      csv += `${e.id},"${e.name}",${e.id}.wav,${e.id}.png,plus,${e.category}\n`;
    }
  }
  fs.writeFileSync(CSV, csv);

  console.log("Done. Total sounds:", catalog.sounds.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
