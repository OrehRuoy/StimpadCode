/**
 * Fix school (US), angry held car horn, pure diesel horn, steam chug+toot.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix9");

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
  } else if (meta.bsb) {
    manifest.push({
      id,
      source: "bigsoundbank",
      bsb_id: String(meta.bsb),
      title: meta.title,
      url: `https://bigsoundbank.com/UPLOAD/mp3/${String(meta.bsb).padStart(4, "0")}.mp3`,
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

  // 1) American school / firehouse-style electric hall bell (classic US campus sound)
  {
    const id = "school_bell";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/217/217486_4017029-hq.mp3";
    const raw = path.join(TMP, "school_us.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const out = path.join(AUDIO, "school_bell.wav");
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "highpass=f=200,afade=t=in:st=0:d=0.02,afade=t=out:st=4.0:d=0.4,loudnorm=I=-11:TP=-1.2:LRA=8",
      "-t",
      "4.6",
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
        freesound: 217486,
        title: "Alarm bell in school hall",
        note: "School hall electric bell (Freesound #217486, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 2) Angry held car horn — long steady blast
  {
    const id = "car_horn";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/479/479976_2524442-hq.mp3";
    const raw = path.join(TMP, "horn_steady.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const out = path.join(AUDIO, "car_horn.mp3");
    // Take a continuous held blast (~3.5s) — mad-driver hold.
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.2",
      "-t",
      "3.6",
      "-af",
      "afade=t=in:st=0:d=0.02,afade=t=out:st=3.25:d=0.3,loudnorm=I=-9:TP=-1.0:LRA=6",
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
        freesound: 479976,
        title: "Steady car horn blast (held)",
        note: "Long held car horn blast (Freesound #479976, CC0)",
        url,
        mode: "oneshot",
        name: "Car Horn",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 3) Diesel train HORN only — pure diesel-electric horn blasts (not engine rumble)
  {
    const id = "train_horn";
    console.log("==>", id);
    // Close/pure diesel 2300-class horn (0.87s) + BSB stationary big horn
    const pure = path.join(TMP, "diesel_pure.mp3");
    await download("https://cdn.freesound.org/previews/662/662553_14219512-hq.mp3", pure);
    const bsb = path.join(TMP, "diesel_bsb.mp3");
    await downloadBsb(2847, bsb);
    console.log("  pure", probe(pure).toFixed(2) + "s", "bsb", probe(bsb).toFixed(2) + "s");

    const blast = path.join(TMP, "blast.wav");
    runFfmpeg([
      "-i",
      pure,
      "-af",
      "afade=t=in:st=0:d=0.005,afade=t=out:st=0.72:d=0.1,loudnorm=I=-8:TP=-0.8:LRA=5",
      "-ac",
      "1",
      "-ar",
      "44100",
      blast,
    ]);
    const longB = path.join(TMP, "longb.wav");
    // Hold/stretch slightly for longer blasts in the cadence
    runFfmpeg(["-i", blast, "-af", "asetrate=44100*0.88,aresample=44100,apad=pad_dur=0.15", longB]);
    const gap = path.join(TMP, "gap.wav");
    runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.16", gap]);
    const list = path.join(TMP, "hornpat.txt");
    const bp = blast.replace(/\\/g, "/");
    const lp = longB.replace(/\\/g, "/");
    const gp = gap.replace(/\\/g, "/");
    // Classic multi-blast horn: long, long, short, long
    fs.writeFileSync(
      list,
      [`file '${lp}'`, `file '${gp}'`, `file '${lp}'`, `file '${gp}'`, `file '${bp}'`, `file '${gp}'`, `file '${lp}'`].join(
        "\n"
      )
    );
    const concat = path.join(TMP, "diesel_pat.wav");
    runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat]);

    // Layer a bit of the big stationary BSB horn underneath for body (horn only, no motor)
    const out = path.join(AUDIO, "train_horn.mp3");
    runFfmpeg([
      "-i",
      concat,
      "-i",
      bsb,
      "-filter_complex",
      "[1:a]atrim=0:5.5,asetpts=PTS-STARTPTS,volume=0.45,afade=t=in:st=0:d=0.05,afade=t=out:st=5.0:d=0.4[b];" +
        "[0:a]volume=1.0[a];[a][b]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-9:TP=-1.0:LRA=7[out]",
      "-map",
      "[out]",
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
        freesound: 662553,
        title: "Diesel locomotive horn cadence",
        note: "Diesel locomotive horn blasts (Freesound #662553 + BSB #2847, CC0)",
        url: "https://cdn.freesound.org/previews/662/662553_14219512-hq.mp3",
        mode: "oneshot",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 4) Steam: chugga-chugga then toot-toot
  {
    const id = "steam_train";
    console.log("==>", id);
    const chugUrl = "https://cdn.freesound.org/previews/591/591974_6456158-hq.mp3";
    const chugRaw = path.join(TMP, "steam_chug.mp3");
    await download(chugUrl, chugRaw);
    console.log("  chug raw", probe(chugRaw).toFixed(2) + "s");

    // Steam whistle toots (BSB)
    const tootRaw = path.join(TMP, "steam_toot.mp3");
    await downloadBsb(226, tootRaw); // whistling train #2
    console.log("  toot raw", probe(tootRaw).toFixed(2) + "s");

    // Chug bed ~8s from mid of pass-by
    const chug = path.join(TMP, "chug.wav");
    runFfmpeg([
      "-i",
      chugRaw,
      "-ss",
      "2",
      "-t",
      "9",
      "-af",
      "highpass=f=40",
      "-ac",
      "1",
      "-ar",
      "44100",
      chug,
    ]);
    // Two short toots
    const toot1 = path.join(TMP, "toot1.wav");
    runFfmpeg([
      "-i",
      tootRaw,
      "-t",
      "1.4",
      "-af",
      "afade=t=in:st=0:d=0.02,afade=t=out:st=1.15:d=0.2,loudnorm=I=-10:TP=-1.0:LRA=6",
      "-ac",
      "1",
      "-ar",
      "44100",
      toot1,
    ]);
    const gap = path.join(TMP, "tootgap.wav");
    runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.22", gap]);
    const toots = path.join(TMP, "toots.wav");
    const listT = path.join(TMP, "toots.txt");
    const t1 = toot1.replace(/\\/g, "/");
    const g1 = gap.replace(/\\/g, "/");
    fs.writeFileSync(listT, [`file '${t1}'`, `file '${g1}'`, `file '${t1}'`].join("\n"));
    runFfmpeg(["-f", "concat", "-safe", "0", "-i", listT, "-c", "copy", toots]);

    // Mix: chug full length, toots start ~after 5s of chugging
    const scene = path.join(TMP, "steam_scene.wav");
    runFfmpeg([
      "-i",
      chug,
      "-i",
      toots,
      "-filter_complex",
      "[1:a]adelay=5200|5200,volume=1.15[t];[0:a]volume=1.0[c];[c][t]amix=inputs=2:duration=first:dropout_transition=0,afade=t=in:st=0:d=0.2,afade=t=out:st=8.4:d=0.5,loudnorm=I=-13:TP=-1.5:LRA=11[out]",
      "-map",
      "[out]",
      "-ac",
      "1",
      "-ar",
      "44100",
      scene,
    ]);

    const out = path.join(AUDIO, "steam_train.wav");
    streamLoop(
      scene,
      out,
      28,
      "afade=t=in:st=0:d=0.25,afade=t=out:st=27.5:d=0.45,loudnorm=I=-13:TP=-1.5:LRA=11"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 591974,
        title: "Steam pass-by chug + whistle toots",
        note: "Steam train chugging then whistle toots (Freesound #591974 + BSB #0226, CC0)",
        url: chugUrl,
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
