/**
 * Round 7: whistle (longer), school bell, desk fan, vehicles.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix7");

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

function loopTo(src, dest, seconds, af) {
  const dur = probe(src);
  const list = path.join(TMP, path.basename(dest) + ".txt");
  const reps = Math.max(2, Math.ceil((seconds + 2) / Math.max(dur, 0.4)));
  fs.writeFileSync(
    list,
    Array(reps)
      .fill(`file '${src.replace(/\\/g, "/")}'`)
      .join("\n")
  );
  const concat = path.join(TMP, path.basename(dest) + "_concat.wav");
  runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat]);
  runFfmpeg(["-i", concat, "-t", String(seconds), "-af", af, "-ac", "1", "-ar", "44100", dest]);
}

async function installFs(id, opts) {
  console.log("==>", id);
  const raw = path.join(TMP, id + "_raw.mp3");
  await download(opts.url, raw);
  console.log("  raw", probe(raw).toFixed(2) + "s");
  const ext = opts.ext || "wav";
  const out = path.join(AUDIO, `${id}.${ext}`);
  if (opts.loop) {
    const steady = path.join(TMP, id + "_steady.wav");
    const args = ["-i", raw];
    if (opts.ss) args.push("-ss", String(opts.ss));
    if (opts.t) args.push("-t", String(opts.t));
    args.push("-af", opts.pre_af || "anull", "-ac", "1", "-ar", "44100", steady);
    runFfmpeg(args);
    loopTo(steady, out, opts.loop_sec || 28, opts.af);
  } else {
    const args = ["-i", raw];
    if (opts.ss) args.push("-ss", String(opts.ss));
    if (opts.t) args.push("-t", String(opts.t));
    args.push("-af", opts.af, "-ac", "1", "-ar", "44100");
    if (ext === "mp3") args.push("-b:a", "192k");
    args.push(out);
    runFfmpeg(args);
  }
  clearOther(id, ext);
  updateCatalog(
    id,
    {
      freesound: opts.freesound,
      title: opts.title,
      note: opts.note,
      url: opts.url,
      mode: opts.mode,
      name: opts.name,
      license: "CC0",
    },
    `res://assets/audio/${id}.${ext}`
  );
  console.log("  out", probe(out).toFixed(2) + "s");
}

async function installMix(id, opts) {
  console.log("==>", id, "(mixkit)");
  const url = `https://assets.mixkit.co/active_storage/sfx/${opts.mixkit}/${opts.mixkit}-preview.mp3`;
  const raw = path.join(TMP, id + "_raw.mp3");
  await download(url, raw);
  const ext = opts.ext || "mp3";
  const out = path.join(AUDIO, `${id}.${ext}`);
  if (opts.loop) {
    const steady = path.join(TMP, id + "_steady.wav");
    runFfmpeg([
      "-i",
      raw,
      ...(opts.ss ? ["-ss", String(opts.ss)] : []),
      ...(opts.t ? ["-t", String(opts.t)] : []),
      "-af",
      opts.pre_af || "anull",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    const wavOut = path.join(AUDIO, `${id}.wav`);
    loopTo(steady, wavOut, opts.loop_sec || 28, opts.af);
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        mixkit: opts.mixkit,
        mixkit_title: opts.title,
        mixkit_url: url,
        title: opts.title,
        note: opts.note,
        mode: "loop",
        name: opts.name,
        license: "Mixkit License",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(wavOut).toFixed(2) + "s");
  } else {
    runFfmpeg([
      "-i",
      raw,
      ...(opts.ss ? ["-ss", String(opts.ss)] : []),
      ...(opts.t ? ["-t", String(opts.t)] : []),
      "-af",
      opts.af,
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
        mixkit: opts.mixkit,
        mixkit_title: opts.title,
        mixkit_url: url,
        title: opts.title,
        note: opts.note,
        mode: "oneshot",
        name: opts.name,
        license: "Mixkit License",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  // Longer drawn-out referee whistle: stretch a clean peal without weird chirps.
  {
    const id = "fire_whistle";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/218/218318_1480854-hq.mp3";
    const raw = path.join(TMP, "whistle.mp3");
    await download(url, raw);
    const out = path.join(AUDIO, "fire_whistle.wav");
    // Take the blow, time-stretch ~1.7x (pitch preserved via atempo chain).
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.04",
      "-t",
      "1.6",
      "-af",
      "highpass=f=600,atempo=0.8,atempo=0.85,afade=t=in:st=0:d=0.02,afade=t=out:st=2.2:d=0.35,loudnorm=I=-10:TP=-1.0:LRA=7",
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
        title: "Long referee-style whistle blow",
        note: "Drawn-out whistle blow (Freesound #218318, CC0, time-stretched)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // School bell — set below after inspect; placeholder uses classic ring if available.
  // Will be overwritten by installFs call with chosen ID.

  // Desk fan — clean desk fan, skip startup
  await installFs("fan_hum", {
    url: "https://cdn.freesound.org/previews/573/573692_12956274-hq.mp3",
    freesound: 573692,
    title: "Desk Fan",
    note: "Desk fan running (Freesound #573692, CC0)",
    mode: "loop",
    ss: 1.5,
    t: 8,
    pre_af: "highpass=f=70,lowpass=f=7000",
    af: "afade=t=in:st=0:d=0.4,afade=t=out:st=27.5:d=0.45,loudnorm=I=-20:TP=-2.5:LRA=7",
    loop_sec: 28,
  });

  // Car Horn
  await installMix("car_horn", {
    mixkit: 1565,
    title: "Classic car horn",
    note: "Classic car horn (Mixkit #1565)",
    name: "Car Horn",
    af: "afade=t=in:st=0:d=0.01,afade=t=out:st=1.1:d=0.15,loudnorm=I=-10:TP=-1.0:LRA=6",
    t: 1.4,
  });

  // Diesel train horn
  await installFs("train_horn", {
    url: "https://cdn.freesound.org/previews/662/662553_14219512-hq.mp3",
    freesound: 662553,
    title: "Diesel Locomotive Horn 2300 Class",
    note: "Diesel locomotive horn (Freesound #662553, CC0)",
    mode: "oneshot",
    ext: "mp3",
    af: "afade=t=in:st=0:d=0.02,afade=t=out:st=3.8:d=0.35,loudnorm=I=-11:TP=-1.2:LRA=8",
    t: 4.3,
  });

  // Helicopter propellers
  await installMix("helicopter", {
    mixkit: 2704,
    title: "Helicopter propellers in the sky",
    note: "Helicopter propellers (Mixkit #2704)",
    name: "Helicopter",
    mode: "loop",
    loop: true,
    ss: 0.5,
    t: 8,
    pre_af: "highpass=f=40",
    af: "afade=t=in:st=0:d=0.3,afade=t=out:st=27.5:d=0.45,loudnorm=I=-14:TP=-1.5:LRA=9",
    loop_sec: 28,
  });

  // Motorcycle — loud Harley idle/revs, looped
  await installFs("motorcycle_idle", {
    url: "https://cdn.freesound.org/previews/166/166101_2214631-hq.mp3",
    freesound: 166101,
    title: "Harley idle revs",
    note: "Loud motorcycle idle/revs (Freesound #166101, CC0)",
    name: "Motorcycle Idle",
    mode: "loop",
    ss: 0.3,
    t: 10,
    pre_af: "highpass=f=40",
    af: "afade=t=in:st=0:d=0.15,afade=t=out:st=29.5:d=0.4,loudnorm=I=-11:TP=-1.2:LRA=10",
    loop_sec: 30,
  });

  // Steam train pass
  await installFs("steam_train", {
    url: "https://cdn.freesound.org/previews/470/470646_1971023-hq.mp3",
    freesound: 470646,
    title: "Steam Train Engine Pass",
    note: "Steam train engine pass-by (Freesound #470646, CC0)",
    mode: "loop",
    ss: 0.5,
    t: 12,
    pre_af: "highpass=f=40",
    af: "afade=t=in:st=0:d=0.25,afade=t=out:st=29.5:d=0.45,loudnorm=I=-14:TP=-1.5:LRA=11",
    loop_sec: 30,
  });

  // Subway — NYC approach (trim speechy door announce if present — take rumble mid)
  await installFs("subway_rumble", {
    url: "https://cdn.freesound.org/previews/636/636068_10150854-hq.mp3",
    freesound: 636068,
    title: "Subway trains",
    note: "Subway trains pass (Freesound #636068, CC0)",
    name: "Subway Train Pass",
    mode: "loop",
    ss: 1.0,
    t: 12,
    pre_af: "highpass=f=35,lowpass=f=9000",
    af: "afade=t=in:st=0:d=0.3,afade=t=out:st=29.5:d=0.45,loudnorm=I=-14:TP=-1.5:LRA=11",
    loop_sec: 30,
  });

  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (_) {}
  console.log("\nDone (school bell next).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
