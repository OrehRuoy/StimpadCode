/**
 * Fix audible loop seams + campfire wind + cricket source:
 * - Regenerate white/pink/brown/TV as continuous beds (ffmpeg anoisesrc) — no stream_loop seams
 * - Campfire → Mixkit Campfire crackles (#1330), loudnorm (crackles without outdoor wind bed)
 * - Crickets → Mixkit Summer night crickets loop (#1789)
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_seamless_nature");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const LICENSES = path.join(ROOT, "docs", "SOUND_LICENSES.md");
const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");

const NOISE_SEC = 45;
const CAMPFIRE = {
  id: 1330,
  title: "Campfire crackles",
  url: "https://assets.mixkit.co/active_storage/sfx/1330/1330-preview.mp3",
};
const CRICKETS = {
  id: 1789,
  title: "Summer night crickets loop",
  url: "https://assets.mixkit.co/active_storage/sfx/1789/1789-preview.mp3",
};

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
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-1200));
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

/** Continuous generated noise — no short-clip stitch seams. */
function makeContinuousNoise(color, dest, extraAf = "") {
  const parts = [];
  if (extraAf) parts.push(extraAf);
  parts.push("loudnorm=I=-18:TP=-2:LRA=7");
  run([
    "-f",
    "lavfi",
    "-i",
    `anoisesrc=d=${NOISE_SEC}:c=${color}:r=44100:a=0.35`,
    "-af",
    parts.join(","),
    "-ac",
    "1",
    "-ar",
    "44100",
    dest,
  ]);
}

/** Soft analog TV hiss: continuous white, mid-high emphasis, no loop seams. */
function makeTvStatic(dest) {
  run([
    "-f",
    "lavfi",
    "-i",
    `anoisesrc=d=${NOISE_SEC}:c=white:r=44100:a=0.4`,
    "-af",
    "highpass=f=200,lowpass=f=9000,equalizer=f=3500:t=h:w=2000:g=4,loudnorm=I=-17:TP=-2:LRA=7",
    "-ac",
    "1",
    "-ar",
    "44100",
    dest,
  ]);
}

function processBed(src, dest, af) {
  run(["-i", src, "-af", af, "-ac", "1", "-ar", "44100", dest]);
}

function updateCatalog() {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const byId = {};
  for (const s of catalog.sounds) byId[s.id] = s;

  if (byId.white_noise) {
    byId.white_noise.name = "White Noise";
    byId.white_noise.path = "res://assets/audio/white_noise.wav";
    byId.white_noise.license = "CC0";
    byId.white_noise.attribution = "Generated continuous white noise (ffmpeg anoisesrc)";
  }
  if (byId.pink_noise) {
    byId.pink_noise.name = "Pink Noise";
    byId.pink_noise.path = "res://assets/audio/pink_noise.wav";
    byId.pink_noise.license = "CC0";
    byId.pink_noise.attribution = "Generated continuous pink noise (ffmpeg anoisesrc)";
  }
  if (byId.brown_noise) {
    byId.brown_noise.path = "res://assets/audio/brown_noise.wav";
    byId.brown_noise.license = "CC0";
    byId.brown_noise.attribution = "Generated continuous brown noise (ffmpeg anoisesrc)";
  }
  if (byId.tv_static) {
    byId.tv_static.path = "res://assets/audio/tv_static.wav";
    byId.tv_static.license = "CC0";
    byId.tv_static.attribution = "Generated continuous TV static bed (filtered white noise)";
  }
  if (byId.campfire) {
    byId.campfire.path = "res://assets/audio/campfire.wav";
    byId.campfire.license = "Mixkit License";
    byId.campfire.attribution = `${CAMPFIRE.title} (Mixkit #${CAMPFIRE.id})`;
    byId.campfire.mixkit_id = CAMPFIRE.id;
    byId.campfire.mixkit_title = CAMPFIRE.title;
    byId.campfire.mixkit_url = CAMPFIRE.url;
  }
  if (byId.night_crickets) {
    byId.night_crickets.name = "Night Cricket Ambience";
    byId.night_crickets.path = "res://assets/audio/night_crickets.wav";
    byId.night_crickets.license = "Mixkit License";
    byId.night_crickets.attribution = `${CRICKETS.title} (Mixkit #${CRICKETS.id})`;
    byId.night_crickets.mixkit_id = CRICKETS.id;
    byId.night_crickets.mixkit_title = CRICKETS.title;
    byId.night_crickets.mixkit_url = CRICKETS.url;
  }

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  let licenses = fs.readFileSync(LICENSES, "utf8");
  licenses = licenses.replace(
    /\| campfire \| .*/,
    `| campfire | Campfire Crackles (Mixkit #${CAMPFIRE.id}) |`
  );
  fs.writeFileSync(LICENSES, licenses);

  let manifest = [];
  if (fs.existsSync(MANIFEST)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    } catch (_) {
      manifest = [];
    }
  }
  if (!Array.isArray(manifest)) manifest = [];
  const keep = new Set([
    "white_noise",
    "pink_noise",
    "brown_noise",
    "tv_static",
    "campfire",
    "night_crickets",
  ]);
  manifest = manifest.filter((e) => !keep.has(e.id));
  manifest.push(
    {
      id: "white_noise",
      source: "generated_continuous",
      note: `ffmpeg anoisesrc white ${NOISE_SEC}s (no stitch seams)`,
    },
    {
      id: "pink_noise",
      source: "generated_continuous",
      note: `ffmpeg anoisesrc pink ${NOISE_SEC}s, softer level`,
    },
    {
      id: "brown_noise",
      source: "generated_continuous",
      note: `ffmpeg anoisesrc brown ${NOISE_SEC}s`,
    },
    {
      id: "tv_static",
      source: "generated_continuous",
      note: `filtered continuous white noise ${NOISE_SEC}s`,
    },
    {
      id: "campfire",
      source: "mixkit",
      mixkit_id: CAMPFIRE.id,
      title: CAMPFIRE.title,
      url: CAMPFIRE.url,
      note: "crackles-only bed; replaces windy BSB #0988",
    },
    {
      id: "night_crickets",
      source: "mixkit",
      mixkit_id: CRICKETS.id,
      title: CRICKETS.title,
      url: CRICKETS.url,
    }
  );
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  console.log("Generating continuous noise beds…");
  const white = path.join(AUDIO, "white_noise.wav");
  const pink = path.join(AUDIO, "pink_noise.wav");
  const brown = path.join(AUDIO, "brown_noise.wav");
  const tv = path.join(AUDIO, "tv_static.wav");

  makeContinuousNoise("white", white);
  // Pink slightly quieter for comfort
  makeContinuousNoise("pink", pink, "volume=0.72");
  makeContinuousNoise("brown", brown);
  makeTvStatic(tv);

  for (const [label, f] of [
    ["white_noise", white],
    ["pink_noise", pink],
    ["brown_noise", brown],
    ["tv_static", tv],
  ]) {
    console.log(label, probe(f).toFixed(2) + "s", "max", maxVol(f));
  }

  console.log("Campfire crackles (Mixkit #" + CAMPFIRE.id + ")…");
  const fireSrc = path.join(TMP, "campfire_src.mp3");
  await download(CAMPFIRE.url, fireSrc);
  const fireOut = path.join(AUDIO, "campfire.wav");
  // Mild highpass trims residual low wind rumble; loudnorm for audible crackle
  processBed(
    fireSrc,
    fireOut,
    "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11"
  );
  console.log("campfire", probe(fireOut).toFixed(2) + "s", "max", maxVol(fireOut));

  console.log("Summer night crickets (Mixkit #" + CRICKETS.id + ")…");
  const crickSrc = path.join(TMP, "crickets_src.mp3");
  await download(CRICKETS.url, crickSrc);
  const crickOut = path.join(AUDIO, "night_crickets.wav");
  processBed(crickSrc, crickOut, "loudnorm=I=-16:TP=-1.5:LRA=11");
  console.log("night_crickets", probe(crickOut).toFixed(2) + "s", "max", maxVol(crickOut));

  // Drop leftover mp3 siblings if present
  for (const id of ["campfire", "night_crickets", "white_noise", "pink_noise", "brown_noise", "tv_static"]) {
    const mp3 = path.join(AUDIO, id + ".mp3");
    if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
  }

  updateCatalog();
  console.log("Done. Continuous noise + campfire crackles + summer night crickets.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
