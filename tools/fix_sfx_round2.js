/**
 * Round-2 SFX + display-name fixes (CC0 BigSoundBank / Mixkit).
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix2");

const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");

const REPLACEMENTS = {
  fire_whistle: {
    bsb: 1017,
    title: "Plastic whistle sustained blow",
    ext: "wav",
    // Keep a continuous blow stretch; mode becomes loop in catalog.
    trim: { start: 1.2, dur: 8 },
    loudness: -11,
    mode: "loop",
    name: "Whistle",
    note: "Sustained plastic whistle blow (BSB #1017)",
  },
  school_bell: {
    // Industrial electric bell — closest free match to modern hallway box bells.
    bsb: 1269,
    title: "Industrial / school electric bell",
    ext: "wav",
    loudness: -11,
    mode: "oneshot",
    name: "School Hall Bell",
    note: "Industrial electric hallway-style bell (BSB #1269)",
  },
  fan_hum: {
    bsb: 78,
    title: "Electric desk fan speed 2",
    ext: "wav",
    // Short but real desk fan — extend by seamless loop to ~28s.
    loop_extend_sec: 28,
    loudness: -13,
    mode: "loop",
    name: "Desk Fan",
    note: "Electric desk fan (BSB #0078)",
  },
  vacuum: {
    bsb: 722,
    title: "Philips bag vacuum cleaning",
    ext: "wav",
    trim: { start: 2, dur: 24 },
    loudness: -11,
    mode: "loop",
    name: "Upright Vacuum",
    note: "Philips bag vacuum at max power (BSB #0722)",
  },
  toaster_pop: {
    bsb: 55,
    title: "Electric toaster pop",
    ext: "mp3",
    // Empty toaster pops — extract one clean pop near start.
    trim: { start: 0.1, dur: 2.2 },
    loudness: -12,
    mode: "oneshot",
    name: "Toaster",
    note: "Electric toaster pop (BSB #0055)",
  },
  ac_hum: {
    bsb: 1471,
    title: "Mobile / window-style AC",
    ext: "wav",
    trim: { start: 5, dur: 50 },
    loudness: -10,
    mode: "loop",
    name: "Window AC",
    note: "Louder mobile/window-style AC unit (BSB #1471)",
  },
  pen_click: {
    bsb: 810,
    title: "Retractable ballpoint pen clicks",
    ext: "mp3",
    trim: { start: 0.2, dur: 1.6 },
    loudness: -12,
    mode: "oneshot",
    name: "Ballpoint Pen Click",
    note: "Retractable ballpoint pen click (BSB #0810)",
  },
  camera_shutter: {
    bsb: 2394,
    title: "Nikon D70S SLR shutter",
    ext: "mp3",
    loudness: -11,
    mode: "oneshot",
    name: "Camera Shutter Click",
    note: "DSLR shutter (Nikon D70S, BSB #2394)",
  },
  bubble_wrap: {
    bsb: 462,
    title: "Bubble wrap breakouts",
    ext: "mp3",
    loudness: -12,
    mode: "oneshot",
    name: "Bubble Wrap",
    note: "Real bubble wrap pops (BSB #0462)",
  },
  fidget_click: {
    bsb: 1824,
    title: "Ratchet / clicker tensioner",
    ext: "mp3",
    trim: { start: 0.3, dur: 2.5 },
    loudness: -11,
    mode: "oneshot",
    name: "Fidget Clicker",
    note: "Tactile ratchet clicker (BSB #1824)",
  },
  zipper: {
    bsb: 14,
    title: "Jacket / K-way zipper pulls",
    ext: "mp3",
    trim: { start: 0.05, dur: 2.8 },
    loudness: -12,
    mode: "oneshot",
    name: "Jacket Zipper Pull",
    note: "Jacket zipper pull (BSB #0014)",
  },
  velcro: {
    bsb: 629,
    title: "Velcro fastener",
    ext: "mp3",
    trim: { start: 0.2, dur: 2.0 },
    loudness: -11,
    mode: "oneshot",
    name: "Velcro Rip",
    note: "Velcro fastener rip (BSB #0629)",
  },
  light_switch: {
    bsb: 26,
    title: "Home wall light switch",
    ext: "mp3",
    trim: { start: 0.1, dur: 1.8 },
    loudness: -12,
    mode: "oneshot",
    name: "Wall Light Switch",
    note: "Home wall light switch on/off (BSB #0026)",
  },
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "StimPad/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          download(res.headers.location, dest).then(resolve).catch(reject);
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

function bsbUrls(id) {
  const n = String(id);
  const padded = n.padStart(4, "0");
  return [
    `https://bigsoundbank.com/UPLOAD/mp3/${padded}.mp3`,
    `https://bigsoundbank.com/UPLOAD/mp3/${n}.mp3`,
  ];
}

async function downloadBsb(id, dest) {
  let lastErr;
  for (const url of bsbUrls(id)) {
    try {
      await download(url, dest);
      if (fs.statSync(dest).size > 1000) return url;
      fs.unlinkSync(dest);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("BSB fail " + id);
}

function runFfmpeg(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-600));
}

function probeDuration(file) {
  const r = spawnSync(
    FFPROBE,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", file],
    { encoding: "utf8" }
  );
  return Number(r.stdout.trim()) || 0;
}

function processAudio(src, dest, meta) {
  if (meta.loop_extend_sec) {
    // Build a longer loop by streaming the clip repeatedly, then loudnorm.
    const list = path.join(TMP, path.basename(dest) + ".txt");
    const reps = Math.max(2, Math.ceil(meta.loop_extend_sec / Math.max(0.5, probeDuration(src))) + 1);
    fs.writeFileSync(list, Array(reps).fill(`file '${src.replace(/\\/g, "/")}'`).join("\n"));
    const concatOut = path.join(TMP, path.basename(dest) + ".concat.wav");
    runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concatOut]);
    const args = ["-i", concatOut, "-t", String(meta.loop_extend_sec)];
    if (meta.loudness != null) args.push("-af", `loudnorm=I=${meta.loudness}:TP=-1.5:LRA=11`);
    if (dest.endsWith(".wav")) args.push("-ac", "1", "-ar", "44100", dest);
    else args.push("-codec:a", "libmp3lame", "-q:a", "2", dest);
    runFfmpeg(args);
    return;
  }
  const args = ["-i", src];
  if (meta.trim) args.push("-ss", String(meta.trim.start), "-t", String(meta.trim.dur));
  if (meta.loudness != null) args.push("-af", `loudnorm=I=${meta.loudness}:TP=-1.5:LRA=11`);
  if (dest.endsWith(".wav")) args.push("-ac", "1", "-ar", "44100", dest);
  else args.push("-codec:a", "libmp3lame", "-q:a", "2", dest);
  runFfmpeg(args);
}

function clearOldVariants(id, keepExt) {
  for (const ext of ["mp3", "wav", "ogg"]) {
    if (ext === keepExt) continue;
    const p = path.join(AUDIO, `${id}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    const imp = p + ".import";
    if (fs.existsSync(imp)) fs.unlinkSync(imp);
  }
}

function updateCatalog(id, meta, relPath) {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const sound = catalog.sounds.find((s) => s.id === id);
  if (!sound) throw new Error("missing " + id);
  sound.path = relPath;
  if (meta.name) sound.name = meta.name;
  if (meta.mode) sound.mode = meta.mode;
  if (meta.mode === "loop") sound.default_duration_sec = 60;
  else sound.default_duration_sec = 0;
  sound.license = "CC0";
  sound.attribution = meta.note;
  sound.mixkit_id = 0;
  sound.mixkit_title = "";
  sound.mixkit_url = "";
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  let manifest = { sounds: [] };
  if (fs.existsSync(MANIFEST)) manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (!Array.isArray(manifest.sounds)) manifest.sounds = [];
  manifest.sounds = manifest.sounds.filter((s) => s.id !== id);
  manifest.sounds.push({
    id,
    source: "bigsoundbank",
    bsb_id: meta.bsb,
    title: meta.title,
    url: `https://bigsoundbank.com/UPLOAD/mp3/${String(meta.bsb).padStart(4, "0")}.mp3`,
  });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  for (const [id, meta] of Object.entries(REPLACEMENTS)) {
    console.log("\n==>", id);
    const raw = path.join(TMP, `${id}_raw.mp3`);
    const out = path.join(AUDIO, `${id}.${meta.ext}`);
    const url = await downloadBsb(meta.bsb, raw);
    console.log(" ", url, "dur", probeDuration(raw).toFixed(2));
    processAudio(raw, out, meta);
    console.log("  out", path.basename(out), probeDuration(out).toFixed(2) + "s");
    clearOldVariants(id, meta.ext);
    updateCatalog(id, meta, `res://assets/audio/${id}.${meta.ext}`);
  }
  console.log("\nDone", Object.keys(REPLACEMENTS).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
