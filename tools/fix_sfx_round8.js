/**
 * Critical audio QA: school bell, long car horn, diesel horn, steam chug+whistle.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix8");

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
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-900));
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
  if (meta.name) sound.name = meta.name;
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
  } else {
    manifest.push({
      id,
      source: "freesound",
      freesound_id: String(meta.freesound),
      title: meta.title,
      url: meta.url,
    });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

function streamLoop(src, dest, seconds, af) {
  runFfmpeg([
    "-stream_loop",
    "-1",
    "-i",
    src,
    "-t",
    String(seconds),
    "-af",
    af,
    "-ac",
    "1",
    "-ar",
    "44100",
    dest,
  ]);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  // 1) School hall bell — real German high-school electric hall bell (classic ringing)
  {
    const id = "school_bell";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/243/243437_2304639-hq.mp3";
    const raw = path.join(TMP, "school.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const out = path.join(AUDIO, "school_bell.wav");
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "afade=t=in:st=0:d=0.02,afade=t=out:st=4.8:d=0.4,loudnorm=I=-11:TP=-1.2:LRA=9",
      "-t",
      "5.5",
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
        freesound: 243437,
        title: "Schoolbell (German high school)",
        note: "Real high-school hall bell (Freesound #243437, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 2) Car horn — longer held/double honk (Mixkit classic double + stretch sustain)
  {
    const id = "car_horn";
    console.log("==>", id);
    // Mixkit 719 = Car double horn; also pull 720 truck for longer if needed
    const urlA = "https://assets.mixkit.co/active_storage/sfx/719/719-preview.mp3";
    const urlB = "https://assets.mixkit.co/active_storage/sfx/1565/1565-preview.mp3";
    const a = path.join(TMP, "horn_a.mp3");
    const b = path.join(TMP, "horn_b.mp3");
    await download(urlA, a);
    await download(urlB, b);
    console.log("  719", probe(a).toFixed(2) + "s", "1565", probe(b).toFixed(2) + "s");
    // Prefer longer of the two; if short, time-stretch slightly and double for a held honk.
    const src = probe(a) >= probe(b) ? a : b;
    const mixkit = probe(a) >= probe(b) ? 719 : 1565;
    const held = path.join(TMP, "horn_held.wav");
    // Slow a bit then append a second peal for ~2.5–3.5s drawn-out horn.
    runFfmpeg([
      "-i",
      src,
      "-af",
      "asetrate=44100*0.82,aresample=44100",
      "-ac",
      "1",
      held,
    ]);
    const gap = path.join(TMP, "horn_gap.wav");
    runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.08", gap]);
    const list = path.join(TMP, "horn.txt");
    const hp = held.replace(/\\/g, "/");
    const gp = gap.replace(/\\/g, "/");
    fs.writeFileSync(list, [`file '${hp}'`, `file '${gp}'`, `file '${hp}'`].join("\n"));
    const concat = path.join(TMP, "horn_concat.wav");
    runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat]);
    const out = path.join(AUDIO, "car_horn.mp3");
    runFfmpeg([
      "-i",
      concat,
      "-af",
      "afade=t=in:st=0:d=0.01,afade=t=out:st=2.8:d=0.35,loudnorm=I=-10:TP=-1.0:LRA=7",
      "-t",
      "3.3",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-b:a",
      "192k",
      out,
    ]);
    clearOther(id, "mp3");
    updateCatalog(
      id,
      {
        mixkit,
        mixkit_title: mixkit === 719 ? "Car double horn" : "Classic car horn",
        mixkit_url: `https://assets.mixkit.co/active_storage/sfx/${mixkit}/${mixkit}-preview.mp3`,
        title: "Drawn-out car horn",
        note: `Drawn-out car horn (Mixkit #${mixkit})`,
        mode: "oneshot",
        name: "Car Horn",
        license: "Mixkit License",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 3) Diesel train horn — stationary diesel blasting its horn (not engine-only)
  {
    const id = "train_horn";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/278/278176_1728127-hq.mp3";
    const raw = path.join(TMP, "diesel_horn.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const out = path.join(AUDIO, "train_horn.mp3");
    // Take a clear horn blast region from the 20s clip (skip quiet lead-in).
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.3",
      "-t",
      "6.5",
      "-af",
      "highpass=f=120,afade=t=in:st=0:d=0.03,afade=t=out:st=5.9:d=0.45,loudnorm=I=-9:TP=-1.0:LRA=8",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-b:a",
      "192k",
      out,
    ]);
    clearOther(id, "mp3");
    updateCatalog(
      id,
      {
        freesound: 278176,
        title: "Diesel locomotive horn blast",
        note: "Stationary diesel locomotive horn blast (Freesound #278176, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 4) Steam train — Molli steam train with whistle + chug (realistic)
  {
    const id = "steam_train";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/277/277496_5339600-hq.mp3";
    const raw = path.join(TMP, "steam_molli.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    // Take a mid section that includes chug + whistle energy.
    const steady = path.join(TMP, "steam_steady.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "4",
      "-t",
      "22",
      "-af",
      "highpass=f=40",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    const out = path.join(AUDIO, "steam_train.wav");
    streamLoop(
      steady,
      out,
      32,
      "afade=t=in:st=0:d=0.35,afade=t=out:st=31.4:d=0.55,loudnorm=I=-13:TP=-1.5:LRA=11"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 277496,
        title: "Steam-Train Molli with whistle",
        note: "Steam train chugging with whistle (Freesound #277496, CC0)",
        url,
        mode: "loop",
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
