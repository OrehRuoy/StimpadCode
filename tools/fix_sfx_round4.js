/**
 * Fix whistle (long referee blow), school bell, steady desk fan, vacuum, toaster.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix4");

const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");

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

async function downloadBsb(id, dest) {
  const n = String(id);
  const urls = [
    `https://bigsoundbank.com/UPLOAD/mp3/${n.padStart(4, "0")}.mp3`,
    `https://bigsoundbank.com/UPLOAD/mp3/${n}.mp3`,
  ];
  let last;
  for (const url of urls) {
    try {
      await download(url, dest);
      if (fs.statSync(dest).size > 1000) return url;
      fs.unlinkSync(dest);
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("bsb " + id);
}

function runFfmpeg(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-600));
}

function probe(file) {
  const r = spawnSync(
    FFPROBE,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", file],
    { encoding: "utf8" }
  );
  return Number(r.stdout.trim()) || 0;
}

function clearOther(id, keepExt) {
  for (const ext of ["mp3", "wav", "ogg"]) {
    if (ext === keepExt) continue;
    const p = path.join(AUDIO, `${id}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    if (fs.existsSync(p + ".import")) fs.unlinkSync(p + ".import");
  }
}

function updateCatalog(id, meta, relPath) {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const sound = catalog.sounds.find((s) => s.id === id);
  if (!sound) throw new Error("missing " + id);
  sound.path = relPath;
  if (meta.mode) sound.mode = meta.mode;
  if (meta.mode === "loop") sound.default_duration_sec = 60;
  if (meta.mode === "oneshot") sound.default_duration_sec = 0;
  sound.license = meta.license || "CC0";
  sound.attribution = meta.note;
  sound.mixkit_id = meta.mixkit || 0;
  sound.mixkit_title = meta.mixkit_title || "";
  sound.mixkit_url = meta.mixkit_url || "";
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  let manifest = { sounds: [] };
  if (fs.existsSync(MANIFEST)) manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (!Array.isArray(manifest.sounds)) manifest.sounds = [];
  manifest.sounds = manifest.sounds.filter((s) => s.id !== id);
  if (meta.mixkit) {
    manifest.sounds.push({
      id,
      mixkit_id: meta.mixkit,
      title: meta.title,
      url: `https://assets.mixkit.co/active_storage/sfx/${meta.mixkit}/${meta.mixkit}-preview.mp3`,
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

  // Whistle: long referee-style blow from multi-whistle take (BSB 1105),
  // then sustain by looping the steady mid of the longest blow.
  {
    const id = "fire_whistle";
    console.log("==>", id);
    const raw = path.join(TMP, "whistle_raw.mp3");
    await downloadBsb(1105, raw);
    // Take a longer continuous region (later blows tend to be longer in this file).
    const blow = path.join(TMP, "whistle_blow.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "8.5",
      "-t",
      "4.5",
      "-af",
      "loudnorm=I=-9:TP=-1.0:LRA=7",
      "-ac",
      "1",
      "-ar",
      "44100",
      blow,
    ]);
    // Extend to ~6s by repeating the strongest steady portion (skip attack/release edges).
    const mid = path.join(TMP, "whistle_mid.wav");
    runFfmpeg(["-i", blow, "-ss", "0.35", "-t", "2.8", mid]);
    const list = path.join(TMP, "whistle.txt");
    fs.writeFileSync(
      list,
      [`file '${blow.replace(/\\/g, "/")}'`, `file '${mid.replace(/\\/g, "/")}'`, `file '${mid.replace(/\\/g, "/")}'`].join(
        "\n"
      )
    );
    const concat = path.join(TMP, "whistle_long.wav");
    runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat]);
    const out = path.join(AUDIO, "fire_whistle.wav");
    runFfmpeg([
      "-i",
      concat,
      "-t",
      "7.5",
      "-af",
      "afade=t=in:st=0:d=0.03,afade=t=out:st=7.1:d=0.35,loudnorm=I=-9:TP=-1.0:LRA=7",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        bsb: 1105,
        title: "Long plastic referee whistle",
        mode: "oneshot",
        note: "Long loud plastic whistle blow (BSB #1105 edit)",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // School bell: Mixkit classic school bell ring
  {
    const id = "school_bell";
    console.log("==>", id);
    const raw = path.join(TMP, "school_raw.mp3");
    await download(
      "https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3",
      raw
    );
    const out = path.join(AUDIO, "school_bell.mp3");
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "loudnorm=I=-11:TP=-1.5:LRA=11",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      out,
    ]);
    clearOther(id, "mp3");
    updateCatalog(
      id,
      {
        mixkit: 933,
        mixkit_title: "School bell ring",
        title: "School bell ring",
        mode: "oneshot",
        license: "Mixkit License",
        note: "School bell ring (Mixkit #933)",
        mixkit_url: "https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Desk fan: Mixkit electric fan — steady mid, seamless loop (no speed changes)
  {
    const id = "fan_hum";
    console.log("==>", id);
    const raw = path.join(TMP, "fan_raw.mp3");
    await download(
      "https://assets.mixkit.co/active_storage/sfx/1704/1704-preview.mp3",
      raw
    );
    const out = path.join(AUDIO, "fan_hum.wav");
    // Steady interior slice; crossfade loop for constant hum.
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "1.2",
      "-t",
      "6.0",
      "-af",
      "afade=t=in:st=0:d=0.08,afade=t=out:st=5.85:d=0.15,loudnorm=I=-13:TP=-1.5:LRA=8",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        mixkit: 1704,
        mixkit_title: "Electric fan blowing",
        title: "Electric fan blowing",
        mode: "loop",
        license: "Mixkit License",
        note: "Steady electric desk fan (Mixkit #1704)",
        mixkit_url: "https://assets.mixkit.co/active_storage/sfx/1704/1704-preview.mp3",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Vacuum: carpet vacuum mid steady run (BSB 2695)
  {
    const id = "vacuum";
    console.log("==>", id);
    const raw = path.join(TMP, "vac_raw.mp3");
    await downloadBsb(2695, raw);
    const out = path.join(AUDIO, "vacuum.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "35",
      "-t",
      "28",
      "-af",
      "loudnorm=I=-11:TP=-1.5:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        bsb: 2695,
        title: "Carpet vacuum cleaner",
        mode: "loop",
        note: "Upright/carpet vacuum cleaning (BSB #2695)",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Toaster: pop with toast (BSB 0442) — isolate one pop
  {
    const id = "toaster_pop";
    console.log("==>", id);
    const raw = path.join(TMP, "toast_raw.mp3");
    await downloadBsb(442, raw);
    const out = path.join(AUDIO, "toaster_pop.mp3");
    // File has multiple load+pop cycles; grab a clean pop event.
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "2.6",
      "-t",
      "1.4",
      "-af",
      "loudnorm=I=-11:TP=-1.5:LRA=11",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      out,
    ]);
    clearOther(id, "mp3");
    updateCatalog(
      id,
      {
        bsb: 442,
        title: "Toaster pop",
        mode: "oneshot",
        note: "Toaster toast pop-up (BSB #0442)",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
