/**
 * Fix loop lengths + school bell + longer whistle/train horn.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix7b");

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

  // Longer whistle: double peal with sustain (drawn-out referee feel)
  {
    const id = "fire_whistle";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/218/218318_1480854-hq.mp3";
    const raw = path.join(TMP, "whistle.mp3");
    await download(url, raw);
    const peal = path.join(TMP, "whistle_peal.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.05",
      "-t",
      "1.35",
      "-af",
      "highpass=f=550",
      "-ac",
      "1",
      "-ar",
      "44100",
      peal,
    ]);
    // Slow the peal ~1.55x with asetrate trick then restore rate (keeps timbre better for whistle).
    const slow = path.join(TMP, "whistle_slow.wav");
    runFfmpeg([
      "-i",
      peal,
      "-af",
      "asetrate=44100*0.72,aresample=44100,atempo=1.05",
      slow,
    ]);
    const out = path.join(AUDIO, "fire_whistle.wav");
    runFfmpeg([
      "-i",
      slow,
      "-af",
      "afade=t=in:st=0:d=0.02,afade=t=out:st=2.6:d=0.4,loudnorm=I=-10:TP=-1.0:LRA=7",
      "-t",
      "3.1",
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
        freesound: 218318,
        title: "Drawn-out whistle blow",
        note: "Drawn-out whistle blow (Freesound #218318, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Vintage school rings (classic school bell character, not fire-alarm tone)
  {
    const id = "school_bell";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/509/509144_10725617-hq.mp3";
    const raw = path.join(TMP, "school.mp3");
    await download(url, raw);
    const out = path.join(AUDIO, "school_bell.wav");
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "afade=t=in:st=0:d=0.02,afade=t=out:st=5.5:d=0.4,loudnorm=I=-11:TP=-1.2:LRA=9",
      "-t",
      "6.2",
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
        freesound: 509144,
        title: "Vintage School Rings",
        note: "Vintage school bell rings (Freesound #509144, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Desk fan — steady mid section, quieter, properly looped
  {
    const id = "fan_hum";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/573/573692_12956274-hq.mp3";
    const raw = path.join(TMP, "fan.mp3");
    await download(url, raw);
    const steady = path.join(TMP, "fan_steady.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "8",
      "-t",
      "10",
      "-af",
      "highpass=f=80,lowpass=f=6500",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    const out = path.join(AUDIO, "fan_hum.wav");
    streamLoop(
      steady,
      out,
      28,
      "afade=t=in:st=0:d=0.5,afade=t=out:st=27.4:d=0.55,loudnorm=I=-20:TP=-2.5:LRA=7"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 573692,
        title: "Desk Fan",
        note: "Desk fan running (Freesound #573692, CC0)",
        url,
        mode: "loop",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Longer diesel horn from freight pass recording (extract horn blast)
  {
    const id = "train_horn";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/714/714978_1661766-hq.mp3";
    const raw = path.join(TMP, "freight.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const out = path.join(AUDIO, "train_horn.mp3");
    // Take an early section that typically has the horn; trim/normalize.
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "2.5",
      "-t",
      "4.5",
      "-af",
      "highpass=f=80,afade=t=in:st=0:d=0.05,afade=t=out:st=4.0:d=0.4,loudnorm=I=-10:TP=-1.0:LRA=8",
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
        freesound: 714978,
        title: "Freight train horn (desert pass)",
        note: "Diesel/freight train horn (Freesound #714978, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Motorcycle loop fix
  {
    const id = "motorcycle_idle";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/166/166101_2214631-hq.mp3";
    const raw = path.join(TMP, "moto.mp3");
    await download(url, raw);
    const steady = path.join(TMP, "moto_steady.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "2",
      "-t",
      "12",
      "-af",
      "highpass=f=40",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    const out = path.join(AUDIO, "motorcycle_idle.wav");
    streamLoop(
      steady,
      out,
      30,
      "afade=t=in:st=0:d=0.2,afade=t=out:st=29.5:d=0.45,loudnorm=I=-11:TP=-1.2:LRA=10"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 166101,
        title: "Harley idle revs",
        note: "Loud motorcycle idle/revs (Freesound #166101, CC0)",
        url,
        mode: "loop",
        name: "Motorcycle Idle",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Steam train loop fix
  {
    const id = "steam_train";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/470/470646_1971023-hq.mp3";
    const raw = path.join(TMP, "steam.mp3");
    await download(url, raw);
    const steady = path.join(TMP, "steam_steady.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "2",
      "-t",
      "14",
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
      30,
      "afade=t=in:st=0:d=0.3,afade=t=out:st=29.5:d=0.45,loudnorm=I=-14:TP=-1.5:LRA=11"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 470646,
        title: "Steam Train Engine Pass",
        note: "Steam train engine pass-by (Freesound #470646, CC0)",
        url,
        mode: "loop",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Subway loop fix
  {
    const id = "subway_rumble";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/636/636068_10150854-hq.mp3";
    const raw = path.join(TMP, "sub.mp3");
    await download(url, raw);
    const steady = path.join(TMP, "sub_steady.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "3",
      "-t",
      "14",
      "-af",
      "highpass=f=35,lowpass=f=9000",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    const out = path.join(AUDIO, "subway_rumble.wav");
    streamLoop(
      steady,
      out,
      30,
      "afade=t=in:st=0:d=0.35,afade=t=out:st=29.5:d=0.45,loudnorm=I=-14:TP=-1.5:LRA=11"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 636068,
        title: "Subway trains",
        note: "Subway trains pass (Freesound #636068, CC0)",
        url,
        mode: "loop",
        name: "Subway Train Pass",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Ensure rename for car horn / helicopter stuck from round7
  {
    const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
    const car = catalog.sounds.find((s) => s.id === "car_horn");
    if (car) car.name = "Car Horn";
    const heli = catalog.sounds.find((s) => s.id === "helicopter");
    if (heli) heli.name = "Helicopter";
    const moto = catalog.sounds.find((s) => s.id === "motorcycle_idle");
    if (moto) moto.name = "Motorcycle Idle";
    fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
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
