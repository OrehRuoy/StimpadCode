/**
 * Replace mismatched StimPad SFX with realistic BigSoundBank / Mixkit sources.
 * Downloads, trims loopable middles where needed, loudness-normalizes, updates catalog.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(ROOT, "assets", "audio", "_tmp_fix");

const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");

/** Curated replacements (CC0 BigSoundBank unless mixkit). */
const REPLACEMENTS = {
  coin_drop: {
    bsb: 193,
    title: "Coins falling on floor",
    ext: "mp3",
    loudness: -12,
    note: "Louder multi-coin drop (BSB #0193)",
  },
  clock_tick: {
    bsb: 2655,
    title: "Tic tac mechanical alarm clock #2",
    ext: "mp3",
    note: "Clean close-up tick-tock loop (BSB #2655)",
  },
  alarm_clock: {
    bsb: 2814,
    title: "Mechanical alarm clock ringtone #11",
    ext: "wav",
    loudness: -11,
    note: "Longer mechanical ring, no early fade (BSB #2814)",
  },
  church_bell: {
    bsb: 135,
    title: "Church Bell",
    ext: "wav",
    loudness: -12,
    note: "Realistic outdoor church tower bell (BSB #0135)",
  },
  doorbell: {
    bsb: 160,
    title: "Electronic doorbell of a house",
    ext: "mp3",
    note: "Electronic wireless-style door chime (BSB #0160)",
  },
  wind_chimes: {
    bsb: 2687,
    title: "Cluster chimes in the wind",
    ext: "mp3",
    // Long recording — keep a loopable mid section with natural hits.
    trim: { start: 12, dur: 48 },
    note: "Metal chimes in wind, loopable mid excerpt (BSB #2687)",
  },
  hair_dryer: {
    bsb: 2680,
    title: "Hair dryer",
    ext: "wav",
    trim: { start: 4, dur: 18 },
    loudness: -12,
    note: "Real hair dryer mid-run (BSB #2680)",
  },
  dryer: {
    bsb: 106,
    title: "Washing machine in drying mode",
    ext: "wav",
    trim: { start: 35, dur: 55 },
    loudness: -13,
    note: "Clothes tumble dry mid-cycle (BSB #0106)",
  },
  dishwasher: {
    bsb: 1002,
    title: "Bosch dishwasher",
    ext: "wav",
    trim: { start: 5, dur: 45 },
    loudness: -13,
    note: "Bosch dishwasher cycle (BSB #1002)",
  },
  washing_machine: {
    mixkit: 1181,
    title: "Washing machine cycle",
    ext: "mp3",
    loudness: -13,
    note: "Washing machine cycle with water action (Mixkit #1181)",
  },
  blender: {
    // Hand mixer whisking batter — closest realistic kitchen motor+blade action on BSB.
    bsb: 1757,
    title: "Electric hand mixer whisking batter",
    ext: "wav",
    loudness: -11,
    note: "Kitchen mixer/blender-style motor + blades (BSB #1757)",
  },
  oven_ding: {
    bsb: 1631,
    title: "Microwave / oven bell ding",
    ext: "mp3",
    note: "Appliance timer ding (BSB #1631)",
  },
  lawn_mower: {
    bsb: 1071,
    title: "Thermal lawn mower",
    ext: "wav",
    trim: { start: 8, dur: 40 },
    loudness: -9,
    note: "Loud thermal lawn mower, no birds (BSB #1071)",
  },
  microwave_hum: {
    bsb: 2376,
    title: "Microwave oven running",
    ext: "wav",
    trim: { start: 1.5, dur: 12 },
    loudness: -13,
    note: "Microwave operating hum (BSB #2376)",
  },
  fridge_hum: {
    bsb: 1157,
    title: "Refrigerator engine hum",
    ext: "wav",
    loudness: -14,
    note: "Closed fridge compressor / engine hum (BSB #1157)",
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
      const st = fs.statSync(dest);
      if (st.size > 1000) return url;
      fs.unlinkSync(dest);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("BSB download failed " + id);
}

function runFfmpeg(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error("ffmpeg failed: " + (r.stderr || r.stdout || "").slice(-500));
  }
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
  const args = ["-i", src];
  const filters = [];
  if (meta.trim) {
    args.push("-ss", String(meta.trim.start), "-t", String(meta.trim.dur));
  }
  if (meta.loudness != null) {
    filters.push(`loudnorm=I=${meta.loudness}:TP=-1.5:LRA=11`);
  }
  if (filters.length) args.push("-af", filters.join(","));
  if (dest.endsWith(".wav")) {
    args.push("-ac", "1", "-ar", "44100", dest);
  } else {
    args.push("-codec:a", "libmp3lame", "-q:a", "2", dest);
  }
  runFfmpeg(args);
}

function clearOldVariants(id, keepExt) {
  for (const ext of ["mp3", "wav", "ogg"]) {
    if (ext === keepExt) continue;
    const p = path.join(AUDIO, `${id}.${ext}`);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log("  removed old", path.basename(p));
    }
    const imp = p + ".import";
    if (fs.existsSync(imp)) fs.unlinkSync(imp);
  }
}

function updateCatalog(id, meta, relPath) {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const sound = catalog.sounds.find((s) => s.id === id);
  if (!sound) throw new Error("missing sound " + id);
  sound.path = relPath;
  if (meta.mixkit) {
    sound.license = "Mixkit License";
    sound.attribution = `${meta.title} (Mixkit #${meta.mixkit})`;
    sound.mixkit_id = meta.mixkit;
    sound.mixkit_title = meta.title;
    sound.mixkit_url = `https://assets.mixkit.co/active_storage/sfx/${meta.mixkit}/${meta.mixkit}-preview.mp3`;
  } else {
    sound.license = "CC0";
    sound.attribution = meta.note;
    sound.mixkit_id = 0;
    sound.mixkit_title = "";
    sound.mixkit_url = "";
  }
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  let manifest = { sounds: [] };
  if (fs.existsSync(MANIFEST)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  }
  if (!Array.isArray(manifest.sounds)) manifest.sounds = [];
  manifest.sounds = manifest.sounds.filter((s) => s.id !== id);
  if (meta.mixkit) {
    manifest.sounds.push({
      id,
      mixkit_id: meta.mixkit,
      title: meta.title,
      url: sound.mixkit_url,
    });
  } else {
    manifest.sounds.push({
      id,
      source: "bigsoundbank",
      bsb_id: meta.bsb,
      title: meta.title,
      url: `https://bigsoundbank.com/UPLOAD/mp3/${String(meta.bsb).padStart(4, "0")}.mp3`,
    });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  for (const [id, meta] of Object.entries(REPLACEMENTS)) {
    console.log("\n==>", id);
    const raw = path.join(TMP, `${id}_raw.mp3`);
    const out = path.join(AUDIO, `${id}.${meta.ext}`);
    if (meta.mixkit) {
      const url = `https://assets.mixkit.co/active_storage/sfx/${meta.mixkit}/${meta.mixkit}-preview.mp3`;
      console.log("  mixkit", url);
      await download(url, raw);
    } else {
      const url = await downloadBsb(meta.bsb, raw);
      console.log("  bsb", url);
    }
    const dur = probeDuration(raw);
    console.log("  raw duration", dur.toFixed(2) + "s");
    processAudio(raw, out, meta);
    const od = probeDuration(out);
    console.log("  out", path.basename(out), od.toFixed(2) + "s", (fs.statSync(out).size / 1024).toFixed(0) + "KB");
    clearOldVariants(id, meta.ext);
    updateCatalog(id, meta, `res://assets/audio/${id}.${meta.ext}`);
  }
  console.log("\nDone. Replacements:", Object.keys(REPLACEMENTS).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
