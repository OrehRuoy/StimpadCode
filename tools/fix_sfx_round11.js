/**
 * Round 11: trim school bell dead air, dry car horn, single steam pass,
 * clean leaky faucet drip, long thunderstorm (no short repeat).
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix11");

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

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  // 1) School Hall Bell — strip leading/trailing dead air, keep continuous ring
  {
    const id = "school_bell";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/217/217486_4017029-hq.mp3";
    const raw = path.join(TMP, "school.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const trimmed = path.join(TMP, "school_trim.wav");
    // Drop quiet lead-in/tail, keep the ringing body
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-32dB:detection=peak," +
        "areverse,silenceremove=start_periods=1:start_duration=0.08:start_threshold=-35dB:detection=peak,areverse," +
        "afade=t=in:st=0:d=0.02,afade=t=out:st=0:d=0",
      "-ac",
      "1",
      "-ar",
      "44100",
      trimmed,
    ]);
    // Fix trailing fade properly after we know duration
    const td = probe(trimmed);
    console.log("  trimmed", td.toFixed(2) + "s");
    const body = path.join(TMP, "school_body.wav");
    const fadeOutAt = Math.max(td - 0.35, td * 0.85);
    runFfmpeg([
      "-i",
      trimmed,
      "-af",
      `afade=t=in:st=0:d=0.02,afade=t=out:st=${fadeOutAt.toFixed(3)}:d=0.32,loudnorm=I=-11:TP=-1.2:LRA=9`,
      "-ac",
      "1",
      "-ar",
      "44100",
      body,
    ]);
    // Mild stretch for a bit more ring without inventing a second hit
    const out = path.join(AUDIO, "school_bell.wav");
    const bd = probe(body);
    const rate = bd > 7.5 ? 1.0 : 0.88;
    runFfmpeg([
      "-i",
      body,
      "-af",
      `asetrate=44100*${rate},aresample=44100,loudnorm=I=-11:TP=-1.2:LRA=9`,
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
        note: "School hall electric bell, trimmed (Freesound #217486, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 2) Car Horn — dry recent car horn (not parking-garage AMG), held
  {
    const id = "car_horn";
    console.log("==>", id);
    const raw = path.join(TMP, "car_bsb.mp3");
    await downloadBsb(258, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    // Stretch a clean dry honk into a sustained hold (~3s)
    const held = path.join(TMP, "car_held.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.02",
      "-af",
      "highpass=f=120,lowpass=f=6500,asetrate=44100*0.55,aresample=44100," +
        "afade=t=in:st=0:d=0.015,afade=t=out:st=2.7:d=0.35,loudnorm=I=-9:TP=-1.0:LRA=6",
      "-t",
      "3.1",
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
        bsb: 258,
        title: "Recent car horn held",
        note: "Dry recent car horn held blast (BigSoundBank #0258, CC0)",
        mode: "oneshot",
        name: "Car Horn",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 3) Steam Train — single real Molli recording (no layered whistle)
  {
    const id = "steam_train";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/277/277496_5339600-hq.mp3";
    const raw = path.join(TMP, "molli.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    // Skip quiet lead-in; take continuous pass with built-in whistle
    const scene = path.join(TMP, "steam_scene.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "2.2",
      "-t",
      "38",
      "-af",
      "highpass=f=40,afade=t=in:st=0:d=0.35,afade=t=out:st=37.2:d=0.7,loudnorm=I=-14:TP=-1.5:LRA=12",
      "-ac",
      "1",
      "-ar",
      "44100",
      scene,
    ]);
    const out = path.join(AUDIO, "steam_train.wav");
    // Mild extend so Godot loop seam is farther apart — crossfade-friendly ends
    streamLoop(
      scene,
      out,
      45,
      "afade=t=in:st=0:d=0.4,afade=t=out:st=44.4:d=0.55,loudnorm=I=-14:TP=-1.5:LRA=12"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 277496,
        title: "Steam-Train Molli with whistle",
        note: "Steam locomotive Molli pass with whistle (Freesound #277496, CC0)",
        url,
        mode: "loop",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 4) Faucet drip — leaky faucet into pan; gate out room rumble
  {
    const id = "tap_drip";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/562/562283_4257513-hq.mp3";
    const raw = path.join(TMP, "drip.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    // Isolate drip plinks; cut low rumble / room wash
    const clean = path.join(TMP, "drip_clean.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.15",
      "-t",
      "17",
      "-af",
      "highpass=f=350,lowpass=f=7000," +
        "agate=threshold=0.035:ratio=8:attack=5:release=120:makeup=2," +
        "loudnorm=I=-16:TP=-2.0:LRA=10",
      "-ac",
      "1",
      "-ar",
      "44100",
      clean,
    ]);
    const out = path.join(AUDIO, "tap_drip.wav");
    streamLoop(
      clean,
      out,
      34,
      "afade=t=in:st=0:d=0.12,afade=t=out:st=33.5:d=0.4,loudnorm=I=-16:TP=-2.0:LRA=10"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 562283,
        title: "Water Drop Faucet / leaky faucet",
        note: "Leaky faucet dripping into pan (Freesound #562283, CC0)",
        url,
        mode: "loop",
        name: "Faucet Water Drip",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 5) Thunder Storm — full ~53s rain bed + irregular loud cracks (no short 18s loop)
  {
    const id = "thunder";
    console.log("==>", id);
    const rainUrl = "https://assets.mixkit.co/active_storage/sfx/2402/2402-preview.mp3";
    const boomUrl = "https://assets.mixkit.co/active_storage/sfx/1300/1300-preview.mp3";
    const rainRaw = path.join(TMP, "tstorm_rain.mp3");
    const boomRaw = path.join(TMP, "tstorm_boom.mp3");
    await download(rainUrl, rainRaw);
    await download(boomUrl, boomRaw);
    const rainDur = probe(rainRaw);
    console.log("  rain", rainDur.toFixed(2) + "s", "boom", probe(boomRaw).toFixed(2) + "s");

    const rainBed = path.join(TMP, "rain_bed.wav");
    runFfmpeg([
      "-i",
      rainRaw,
      "-af",
      "loudnorm=I=-17:TP=-2.0:LRA=9,volume=1.05",
      "-ac",
      "1",
      "-ar",
      "44100",
      rainBed,
    ]);
    const boom = path.join(TMP, "boom.wav");
    runFfmpeg([
      "-i",
      boomRaw,
      "-af",
      "loudnorm=I=-7:TP=-0.6:LRA=7,volume=1.55",
      "-ac",
      "1",
      "-ar",
      "44100",
      boom,
    ]);

    // One long scene (~52s): rain whole way, thunder at irregular times
    const scene = path.join(TMP, "tstorm_scene.wav");
    const delays = [2500, 11000, 19500, 31000, 42000];
    const vols = [1.35, 1.55, 1.25, 1.65, 1.4];
    const boomInputs = delays.map(() => ["-i", boom]).flat();
    const boomFilters = delays
      .map(
        (d, i) =>
          `[${i + 1}:a]adelay=${d}|${d},volume=${vols[i]}[b${i}]`
      )
      .join(";");
    const mixLabels = delays.map((_, i) => `[b${i}]`).join("");
    runFfmpeg([
      "-i",
      rainBed,
      ...boomInputs,
      "-filter_complex",
      `[0:a]volume=1.05[r];${boomFilters};[r]${mixLabels}amix=inputs=${
        1 + delays.length
      }:duration=first:dropout_transition=2,loudnorm=I=-11:TP=-0.8:LRA=12[out]`,
      "-map",
      "[out]",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-t",
      String(Math.min(rainDur, 52)),
      scene,
    ]);

    const out = path.join(AUDIO, "thunder.wav");
    const sd = probe(scene);
    const fadeAt = Math.max(sd - 0.8, sd * 0.95);
    runFfmpeg([
      "-i",
      scene,
      "-af",
      `afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeAt.toFixed(2)}:d=0.7,loudnorm=I=-11:TP=-0.8:LRA=12`,
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
        mixkit: 2402,
        mixkit_title: "Thunderstorm and rain",
        mixkit_url: rainUrl,
        title: "Long thunderstorm with loud cracks",
        note: "Thunderstorm rain with irregular loud thunder (Mixkit #2402 + #1300)",
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
  try {
    fs.rmSync(path.join(AUDIO, "_tmp_fix11_probe"), { recursive: true, force: true });
  } catch (_) {}
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
