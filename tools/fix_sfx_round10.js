/**
 * Round 10: school longer, real car horn, diesel crossing horn, steam,
 * shower, drip, louder thunderstorm loop + renames.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix10");

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
  for (const url of [
    `https://bigsoundbank.com/UPLOAD/mp3/${n.padStart(4, "0")}.mp3`,
    `https://bigsoundbank.com/UPLOAD/mp3/${n}.mp3`,
  ]) {
    try {
      await download(url, dest);
      if (fs.statSync(dest).size > 1000) return url;
      fs.unlinkSync(dest);
    } catch (_) {}
  }
  throw new Error("bsb " + id);
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

function renameOnly(id, name) {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const sound = catalog.sounds.find((s) => s.id === id);
  if (!sound) throw new Error("missing " + id);
  sound.name = name;
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
  console.log("rename", id, "->", name);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  // Renames first
  renameOnly("ocean_waves", "Ocean Waves");
  renameOnly("rain", "Rain");
  renameOnly("flowing_water", "Flowing Stream");

  // 1) School bell — longer continuous ring (take longer continuous region, slight sustain stretch)
  {
    const id = "school_bell";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/217/217486_4017029-hq.mp3";
    const raw = path.join(TMP, "school.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    // Take continuous bell portion and gently time-stretch for longer ring without hard replay seam
    const cut = path.join(TMP, "school_cut.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.05",
      "-t",
      "6.5",
      "-af",
      "highpass=f=200",
      "-ac",
      "1",
      "-ar",
      "44100",
      cut,
    ]);
    const out = path.join(AUDIO, "school_bell.wav");
    runFfmpeg([
      "-i",
      cut,
      "-af",
      "asetrate=44100*0.78,aresample=44100,afade=t=in:st=0:d=0.03,afade=t=out:st=7.8:d=0.55,loudnorm=I=-11:TP=-1.2:LRA=9",
      "-t",
      "8.5",
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
        title: "Long school hall electric bell",
        note: "Long continuous school hall electric bell (Freesound #217486, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 2) Real car horn held — Alfa Romeo MiTo real horn, held/stretched
  {
    const id = "car_horn";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/457/457425_5613947-hq.mp3";
    const raw = path.join(TMP, "car.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    // Also try AMG and pick longer/better
    const amgUrl = "https://cdn.freesound.org/previews/505/505322_7236652-hq.mp3";
    const amg = path.join(TMP, "amg.mp3");
    await download(amgUrl, amg);
    console.log("  amg", probe(amg).toFixed(2) + "s");
    const src = probe(amg) >= 1.5 ? amg : raw;
    const used = src === amg ? 505322 : 457425;
    const usedUrl = src === amg ? amgUrl : url;
    const held = path.join(TMP, "car_held.wav");
    // Stretch a real honk into a sustained mad hold
    runFfmpeg([
      "-i",
      src,
      "-ss",
      "0.05",
      "-t",
      "2.2",
      "-af",
      "asetrate=44100*0.72,aresample=44100,afade=t=in:st=0:d=0.02,afade=t=out:st=2.7:d=0.35,loudnorm=I=-9:TP=-1.0:LRA=6",
      "-t",
      "3.2",
      "-ac",
      "1",
      "-ar",
      "44100",
      held,
    ]);
    const out = path.join(AUDIO, "car_horn.mp3");
    runFfmpeg(["-i", held, "-b:a", "192k", out]);
    clearOther(id, "mp3");
    updateCatalog(
      id,
      {
        freesound: used,
        title: "Real car horn held blast",
        note: `Real car horn held blast (Freesound #${used}, CC0)`,
        url: usedUrl,
        mode: "oneshot",
        name: "Car Horn",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 3) Diesel crossing horn — train at crossing blowing horn (real recording)
  {
    const id = "train_horn";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/591/591808_6456158-hq.mp3";
    const raw = path.join(TMP, "crossing.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const out = path.join(AUDIO, "train_horn.mp3");
    // Focus on the horn blasts (crossing pattern), keep some motion context lightly
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.5",
      "-t",
      "12",
      "-af",
      "highpass=f=80,afade=t=in:st=0:d=0.05,afade=t=out:st=11.2:d=0.6,loudnorm=I=-10:TP=-1.2:LRA=9",
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
        freesound: 591808,
        title: "Train horn at railroad crossing",
        note: "Diesel train horn at railroad crossing (Freesound #591808, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 4) Steam — Big Boy / real steam excursion pass with whistle character
  {
    const id = "steam_train";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/746/746322_975985-hq.mp3";
    const raw = path.join(TMP, "bigboy.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const steady = path.join(TMP, "steam_steady.wav");
    // Take a lively mid section with chug energy
    const dur = probe(raw);
    const ss = dur > 20 ? "3" : "0.5";
    const t = dur > 20 ? "18" : String(Math.max(dur - 1, 8));
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      ss,
      "-t",
      t,
      "-af",
      "highpass=f=35",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    // Add clear toot-toot whistle on top from BSB whistling train
    const tootRaw = path.join(TMP, "toot.mp3");
    await downloadBsb(226, tootRaw);
    const toot1 = path.join(TMP, "toot1.wav");
    runFfmpeg([
      "-i",
      tootRaw,
      "-t",
      "1.5",
      "-af",
      "afade=t=in:st=0:d=0.02,afade=t=out:st=1.2:d=0.25,loudnorm=I=-10:TP=-1.0:LRA=6",
      "-ac",
      "1",
      "-ar",
      "44100",
      toot1,
    ]);
    const gap = path.join(TMP, "gap.wav");
    runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.25", gap]);
    const toots = path.join(TMP, "toots.wav");
    const list = path.join(TMP, "toots.txt");
    fs.writeFileSync(
      list,
      [`file '${toot1.replace(/\\/g, "/")}'`, `file '${gap.replace(/\\/g, "/")}'`, `file '${toot1.replace(/\\/g, "/")}'`].join(
        "\n"
      )
    );
    runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", toots]);
    const scene = path.join(TMP, "steam_scene.wav");
    runFfmpeg([
      "-i",
      steady,
      "-i",
      toots,
      "-filter_complex",
      "[1:a]adelay=4500|4500,volume=1.2[t];[0:a]volume=1.0[c];[c][t]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-13:TP=-1.5:LRA=11[out]",
      "-map",
      "[out]",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-t",
      "16",
      scene,
    ]);
    const out = path.join(AUDIO, "steam_train.wav");
    streamLoop(
      scene,
      out,
      30,
      "afade=t=in:st=0:d=0.3,afade=t=out:st=29.4:d=0.5,loudnorm=I=-13:TP=-1.5:LRA=11"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 746322,
        title: "Steam Big Boy pass + whistle toots",
        note: "Steam locomotive pass with whistle toots (Freesound #746322 + BSB #0226, CC0)",
        url,
        mode: "loop",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 5) Shower — real bathroom shower running
  {
    const id = "shower";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/802/802544_14426029-hq.mp3";
    const raw = path.join(TMP, "shower.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const steady = path.join(TMP, "shower_steady.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "1",
      "-t",
      "10",
      "-af",
      "highpass=f=80,lowpass=f=10000",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    const out = path.join(AUDIO, "shower.wav");
    streamLoop(
      steady,
      out,
      28,
      "afade=t=in:st=0:d=0.3,afade=t=out:st=27.5:d=0.45,loudnorm=I=-16:TP=-2.0:LRA=8"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 802544,
        title: "Shower Running",
        note: "Bathroom shower running (Freesound #802544, CC0)",
        url,
        mode: "loop",
        name: "Bathroom Shower Spray",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 6) Faucet drip — real water dripping in faucet/sink
  {
    const id = "tap_drip";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/219/219373_4037654-hq.mp3";
    const raw = path.join(TMP, "drip.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const steady = path.join(TMP, "drip_steady.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.2",
      "-t",
      "8",
      "-af",
      "highpass=f=200,lowpass=f=8000",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    const out = path.join(AUDIO, "tap_drip.wav");
    streamLoop(
      steady,
      out,
      24,
      "afade=t=in:st=0:d=0.15,afade=t=out:st=23.5:d=0.4,loudnorm=I=-16:TP=-2.0:LRA=11"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 219373,
        title: "Water dripping in faucet",
        note: "Faucet water drip (Freesound #219373, CC0)",
        url,
        mode: "loop",
        name: "Faucet Water Drip",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 7) Thunder Storm — rain bed + louder thunder, as LOOP
  {
    const id = "thunder";
    console.log("==>", id);
    const rainUrl = "https://assets.mixkit.co/active_storage/sfx/2402/2402-preview.mp3";
    const boomUrl = "https://assets.mixkit.co/active_storage/sfx/1300/1300-preview.mp3";
    const rainRaw = path.join(TMP, "tstorm_rain.mp3");
    const boomRaw = path.join(TMP, "tstorm_boom.mp3");
    await download(rainUrl, rainRaw);
    await download(boomUrl, boomRaw);
    console.log("  rain", probe(rainRaw).toFixed(2) + "s", "boom", probe(boomRaw).toFixed(2) + "s");
    const rainLoop = path.join(TMP, "rain_bed.wav");
    runFfmpeg([
      "-i",
      rainRaw,
      "-af",
      "loudnorm=I=-18:TP=-2.0:LRA=8",
      "-ac",
      "1",
      "-ar",
      "44100",
      rainLoop,
    ]);
    const boom = path.join(TMP, "boom.wav");
    runFfmpeg([
      "-i",
      boomRaw,
      "-af",
      "loudnorm=I=-8:TP=-0.8:LRA=7,volume=1.35",
      "-ac",
      "1",
      "-ar",
      "44100",
      boom,
    ]);
    // Scene: rain continuous, thunder at ~2s and ~10s
    const scene = path.join(TMP, "tstorm_scene.wav");
    runFfmpeg([
      "-stream_loop",
      "-1",
      "-i",
      rainLoop,
      "-i",
      boom,
      "-i",
      boom,
      "-filter_complex",
      "[0:a]atrim=0:18,asetpts=PTS-STARTPTS,volume=1.0[r];" +
        "[1:a]adelay=1800|1800,volume=1.4[b1];" +
        "[2:a]adelay=9500|9500,volume=1.5[b2];" +
        "[r][b1][b2]amix=inputs=3:duration=first:dropout_transition=0,loudnorm=I=-12:TP=-1.0:LRA=11[out]",
      "-map",
      "[out]",
      "-ac",
      "1",
      "-ar",
      "44100",
      scene,
    ]);
    const out = path.join(AUDIO, "thunder.wav");
    streamLoop(
      scene,
      out,
      36,
      "afade=t=in:st=0:d=0.4,afade=t=out:st=35.4:d=0.55,loudnorm=I=-12:TP=-1.0:LRA=11"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        mixkit: 2402,
        mixkit_title: "Thunderstorm and rain loop",
        mixkit_url: rainUrl,
        title: "Thunderstorm with loud thunder cracks",
        note: "Thunderstorm rain with loud thunder (Mixkit #2402 + #1300)",
        mode: "loop",
        name: "Thunder Storm",
        license: "Mixkit License",
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
