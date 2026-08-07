/**
 * Noise + nature SFX pass:
 * - Rename White Noise; lengthen white / pink / brown / TV static (~30s)
 * - Soften pink noise level
 * - Replace campfire with roaring BSB big fire; loudnorm
 * - Boost night crickets
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_noise_nature");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const CSV = path.join(ROOT, "data", "sound_art_map.csv");
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
          reject(new Error("HTTP " + res.statusCode + " " + url));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", reject);
  });
}

function run(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-900));
}

function probe(f) {
  return Number(
    spawnSync(
      FFPROBE,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", f],
      { encoding: "utf8" }
    ).stdout.trim()
  );
}

function maxVol(f) {
  const r = spawnSync(FFMPEG, ["-i", f, "-af", "volumedetect", "-f", "null", "-"], {
    encoding: "utf8",
  });
  const m = (r.stderr || "").match(/max_volume:\s*([-\d.]+)/);
  return m ? Number(m[1]) : null;
}

function extendLoop(src, dest, seconds, extraAf = "") {
  const af = [
    "afade=t=in:st=0:d=0.05",
    `afade=t=out:st=${(seconds - 0.4).toFixed(2)}:d=0.35`,
  ];
  if (extraAf) af.unshift(extraAf);
  run([
    "-stream_loop",
    "-1",
    "-i",
    src,
    "-t",
    String(seconds),
    "-af",
    af.join(","),
    "-ac",
    "1",
    "-ar",
    "44100",
    dest,
  ]);
}

function updateCatalogNames() {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const byId = {};
  for (const s of catalog.sounds) byId[s.id] = s;

  if (byId.white_noise) {
    byId.white_noise.name = "White Noise";
    byId.white_noise.path = "res://assets/audio/white_noise.wav";
    byId.white_noise.mode = "loop";
  }
  if (byId.pink_noise) {
    byId.pink_noise.name = "Pink Noise";
    byId.pink_noise.path = "res://assets/audio/pink_noise.wav";
  }
  if (byId.brown_noise) {
    byId.brown_noise.path = "res://assets/audio/brown_noise.wav";
  }
  if (byId.tv_static) {
    byId.tv_static.path = "res://assets/audio/tv_static.wav";
  }
  if (byId.campfire) {
    byId.campfire.path = "res://assets/audio/campfire.wav";
    byId.campfire.license = "CC0";
    byId.campfire.attribution = "Big branching fire (BigSoundBank #0988, CC0)";
  }
  if (byId.night_crickets) {
    byId.night_crickets.path = "res://assets/audio/night_crickets.wav";
  }
  if (byId.morning_birds) {
    // Mixed dawn chorus, not a single species.
    byId.morning_birds.name = "Dawn Bird Chorus";
  }

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  if (fs.existsSync(CSV)) {
    let csv = fs.readFileSync(CSV, "utf8");
    csv = csv.replace(/white_noise,"White Noise Hiss"/, 'white_noise,"White Noise"');
    csv = csv.replace(/pink_noise,"Pink Noise Soft"/, 'pink_noise,"Pink Noise"');
    csv = csv.replace(/morning_birds,"Morning Birdsong"/, 'morning_birds,"Dawn Bird Chorus"');
    csv = csv.replace(/campfire\.mp3/, "campfire.wav");
    csv = csv.replace(/night_crickets\.mp3/, "night_crickets.wav");
    fs.writeFileSync(CSV, csv);
  }
}

function updateManifest(entries) {
  let manifest = [];
  if (fs.existsSync(MANIFEST)) {
    const raw = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    manifest = Array.isArray(raw) ? raw : raw.sounds || [];
  }
  const drop = new Set(entries.map((e) => e.id));
  manifest = manifest.filter((s) => !drop.has(s.id));
  for (const e of entries) manifest.push(e);
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  // --- Lengthen noise loops (seamless enough for random noise) ---
  const noiseJobs = [
    {
      id: "white_noise",
      src: path.join(AUDIO, "white_noise.wav"),
      dest: path.join(AUDIO, "white_noise.wav"),
      af: "loudnorm=I=-16:TP=-1.5:LRA=7",
    },
    {
      id: "tv_static",
      src: path.join(AUDIO, "tv_static.wav"),
      dest: path.join(AUDIO, "tv_static.wav"),
      af: "loudnorm=I=-18:TP=-1.5:LRA=8",
    },
    {
      id: "brown_noise",
      src: path.join(AUDIO, "brown_noise.wav"),
      dest: path.join(AUDIO, "brown_noise.wav"),
      af: "loudnorm=I=-16:TP=-1.5:LRA=7",
    },
    {
      id: "pink_noise",
      src: path.join(AUDIO, "pink_noise.wav"),
      dest: path.join(AUDIO, "pink_noise.wav"),
      // Softer than white — user found prior level too loud for "soft"
      af: "volume=-8dB,loudnorm=I=-22:TP=-2.5:LRA=7",
    },
  ];

  for (const job of noiseJobs) {
    const bak = path.join(TMP, path.basename(job.src));
    fs.copyFileSync(job.src, bak);
    const outTmp = path.join(TMP, job.id + "_long.wav");
    extendLoop(bak, outTmp, 30, job.af);
    fs.copyFileSync(outTmp, job.dest);
    console.log(job.id, probe(job.dest).toFixed(2) + "s", "max", maxVol(job.dest));
  }

  // --- Campfire: roaring big fire (BSB 0988) ---
  const fireRaw = path.join(TMP, "fire0988.mp3");
  await download("https://bigsoundbank.com/UPLOAD/mp3/0988.mp3", fireRaw);
  console.log("fire raw", probe(fireRaw).toFixed(2) + "s", "max", maxVol(fireRaw));
  const fireOut = path.join(AUDIO, "campfire.wav");
  run([
    "-stream_loop",
    "-1",
    "-i",
    fireRaw,
    "-t",
    "45",
    "-af",
    "highpass=f=60,lowpass=f=12000,loudnorm=I=-14:TP=-1.0:LRA=11,afade=t=in:st=0:d=0.2,afade=t=out:st=44.5:d=0.45",
    "-ac",
    "1",
    "-ar",
    "44100",
    fireOut,
  ]);
  for (const ext of ["mp3", "ogg"]) {
    const p = path.join(AUDIO, `campfire.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  console.log("campfire", probe(fireOut).toFixed(2) + "s", "max", maxVol(fireOut));

  // --- Crickets: louder, keep character ---
  const crickSrc = path.join(AUDIO, "night_crickets.mp3");
  const crickBak = path.join(TMP, "crickets_src.mp3");
  fs.copyFileSync(crickSrc, crickBak);
  const crickOut = path.join(AUDIO, "night_crickets.wav");
  run([
    "-stream_loop",
    "-1",
    "-i",
    crickBak,
    "-t",
    "40",
    "-af",
    "volume=9dB,highpass=f=1200,loudnorm=I=-14:TP=-1.0:LRA=9,afade=t=in:st=0:d=0.15,afade=t=out:st=39.5:d=0.45",
    "-ac",
    "1",
    "-ar",
    "44100",
    crickOut,
  ]);
  for (const ext of ["mp3", "ogg"]) {
    const p = path.join(AUDIO, `night_crickets.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  console.log("night_crickets", probe(crickOut).toFixed(2) + "s", "max", maxVol(crickOut));

  updateCatalogNames();
  updateManifest([
    { id: "white_noise", source: "generated", color: "white", note: "extended 30s loop" },
    { id: "pink_noise", source: "generated", color: "pink", note: "extended + softened" },
    { id: "brown_noise", source: "generated", color: "brown", note: "extended 30s loop" },
    {
      id: "tv_static",
      source: "generated_loop",
      note: "extended existing static bed to 30s",
    },
    {
      id: "campfire",
      source: "bigsoundbank",
      bsb_id: "0988",
      title: "Big branching fire #2",
      url: "https://bigsoundbank.com/UPLOAD/mp3/0988.mp3",
    },
    {
      id: "night_crickets",
      source: "boosted",
      note: "existing cricket bed +9dB / loudnorm",
    },
  ]);

  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (_) {}
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
