/**
 * Targeted SFX fixes: arcade coin slot, slower clock, doorbell, washer, fridge.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix3");

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
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-500));
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
  if (meta.bsb) {
    manifest.sounds.push({
      id,
      source: "bigsoundbank",
      bsb_id: meta.bsb,
      title: meta.title,
      url: `https://bigsoundbank.com/UPLOAD/mp3/${String(meta.bsb).padStart(4, "0")}.mp3`,
    });
  } else if (meta.freesound) {
    manifest.sounds.push({
      id,
      source: "freesound",
      freesound_id: meta.freesound,
      title: meta.title,
      url: meta.url,
    });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  // 1) Arcade coin into machine (CC0 Freesound #79699)
  {
    const id = "coin_drop";
    console.log("==>", id);
    const src = path.join(AUDIO, "_tmp_c", "arcade_coin_slot.mp3");
    const out = path.join(AUDIO, "coin_drop.mp3");
    runFfmpeg([
      "-i",
      src,
      "-af",
      "loudnorm=I=-11:TP=-1.5:LRA=11",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      out,
    ]);
    clearOther(id, "mp3");
    updateCatalog(id, {
      freesound: 79699,
      title: "Arcade coin slot insert",
      note: "Arcade machine coin slot insert (Freesound #79699, CC0)",
      url: "https://freesound.org/people/labailey/sounds/79699/",
    }, `res://assets/audio/${id}.mp3`);
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 2) Slow down wall clock tick-tock
  {
    const id = "clock_tick";
    console.log("==>", id);
    const raw = path.join(TMP, "clock_raw.mp3");
    await downloadBsb(2655, raw);
    const out = path.join(AUDIO, "clock_tick.mp3");
    // ~30% slower tick rate while keeping pitch.
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "atempo=0.72,loudnorm=I=-14:TP=-1.5:LRA=11",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      out,
    ]);
    clearOther(id, "mp3");
    updateCatalog(id, {
      bsb: 2655,
      title: "Tic tac mechanical alarm clock (slowed)",
      note: "Wall clock tick-tock slowed ~28% (BSB #2655 edit)",
    }, `res://assets/audio/${id}.mp3`);
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 3) Better home doorbell — large entrance chime
  {
    const id = "doorbell";
    console.log("==>", id);
    const raw = path.join(TMP, "doorbell_raw.mp3");
    await downloadBsb(2880, raw);
    const out = path.join(AUDIO, "doorbell.mp3");
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "loudnorm=I=-12:TP=-1.5:LRA=11",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      out,
    ]);
    clearOther(id, "mp3");
    updateCatalog(id, {
      bsb: 2880,
      title: "Large house entrance chime",
      note: "Large home entrance doorbell chime (BSB #2880)",
    }, `res://assets/audio/${id}.mp3`);
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 4) Washer — real laundry cycle (speech reduced)
  {
    const id = "washing_machine";
    console.log("==>", id);
    const raw = path.join(TMP, "washer_raw.mp3");
    await downloadBsb(423, raw);
    const out = path.join(AUDIO, "washing_machine.wav");
    // Mid spin/wash portion; denoise + band limit to reduce distant phone speech.
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "25",
      "-t",
      "45",
      "-af",
      "highpass=f=60,lowpass=f=5500,afftdn=nf=-25,loudnorm=I=-12:TP=-1.5:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    clearOther(id, "wav");
    updateCatalog(id, {
      bsb: 423,
      title: "Washing machine cleaning laundry",
      note: "Front-load washer laundry cycle (BSB #0423, speech-reduced edit)",
    }, `res://assets/audio/${id}.wav`);
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 5) Fridge — alternate BSB “refrigerator running”
  {
    const id = "fridge_hum";
    console.log("==>", id);
    const raw = path.join(TMP, "fridge_raw.mp3");
    await downloadBsb(34, raw);
    const out = path.join(AUDIO, "fridge_hum.wav");
    // Extend short clip by looping for a steadier hum bed.
    const list = path.join(TMP, "fridge.txt");
    const reps = 4;
    fs.writeFileSync(
      list,
      Array(reps)
        .fill(`file '${raw.replace(/\\/g, "/")}'`)
        .join("\n")
    );
    const concat = path.join(TMP, "fridge_concat.wav");
    runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat]);
    runFfmpeg([
      "-i",
      concat,
      "-t",
      "32",
      "-af",
      "loudnorm=I=-14:TP=-1.5:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    clearOther(id, "wav");
    updateCatalog(id, {
      bsb: 34,
      title: "Refrigerator running",
      note: "Refrigerator running hum (BSB #0034)",
    }, `res://assets/audio/${id}.wav`);
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
