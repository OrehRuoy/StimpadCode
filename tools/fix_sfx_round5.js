/**
 * Replace arcade coin drop + quieter realistic fridge hum.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix5");

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

function runFfmpeg(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-800));
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

  let manifest = [];
  if (fs.existsSync(MANIFEST)) {
    const raw = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    manifest = Array.isArray(raw) ? raw : raw.sounds || [];
  }
  manifest = manifest.filter((s) => s.id !== id);
  if (meta.mixkit) {
    manifest.push({
      id,
      mixkit_id: meta.mixkit,
      title: meta.title,
      url: `https://assets.mixkit.co/active_storage/sfx/${meta.mixkit}/${meta.mixkit}-preview.mp3`,
    });
  } else if (meta.source === "freesound") {
    manifest.push({
      id,
      source: "freesound",
      freesound_id: String(meta.freesound),
      title: meta.title,
      url: meta.url,
    });
  } else {
    manifest.push({
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

  // 1) Arcade coin — real coin into a jukebox/slot + fall into hopper (CC0)
  {
    const id = "coin_drop";
    console.log("==>", id);
    const raw = path.join(TMP, "coin_raw.mp3");
    const url = "https://cdn.freesound.org/previews/637/637369_612689-hq.mp3";
    await download(url, raw);
    const out = path.join(AUDIO, "coin_drop.mp3");
    // Keep the slot+fall; trim silence pads and normalize moderately.
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-40dB,afade=t=in:st=0:d=0.01,afade=t=out:st=1.8:d=0.15,loudnorm=I=-12:TP=-1.5:LRA=11",
      "-t",
      "2.1",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-b:a",
      "192k",
      out,
    ]);
    clearOther(id, "mp3");
    updateCatalog(
      id,
      {
        source: "freesound",
        freesound: 637369,
        title: "Coin in jukebox slot + fall",
        note: "Coin into machine slot then fall (Freesound #637369, CC0)",
        url,
        mode: "oneshot",
        license: "CC0",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 2) Fridge — quiet close-mic mini-fridge hum (CC0), deliberately soft master
  {
    const id = "fridge_hum";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/653/653454_5672451-hq.mp3";
    const raw = path.join(TMP, "fridge_raw.mp3");
    await download(url, raw);
    const dur = probe(raw);
    console.log("  raw dur", dur.toFixed(2) + "s");

    const list = path.join(TMP, "fridge.txt");
    const reps = Math.max(3, Math.ceil(34 / Math.max(dur, 0.5)));
    fs.writeFileSync(
      list,
      Array(reps)
        .fill(`file '${raw.replace(/\\/g, "/")}'`)
        .join("\n")
    );
    const concat = path.join(TMP, "fridge_concat.wav");
    runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat]);

    const out = path.join(AUDIO, "fridge_hum.wav");
    // -24 LUFS: fridge should be soft background (previous -14 felt too loud).
    runFfmpeg([
      "-i",
      concat,
      "-t",
      "32",
      "-af",
      "highpass=f=35,lowpass=f=3500,afade=t=in:st=0:d=0.35,afade=t=out:st=31.5:d=0.5,loudnorm=I=-24:TP=-2.5:LRA=7",
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
        source: "freesound",
        freesound: 653454,
        title: "Mini-fridge hum loop (close)",
        note: "Quiet close-mic mini-fridge hum (Freesound #653454, CC0)",
        url,
        mode: "loop",
        license: "CC0",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (_) {}
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
