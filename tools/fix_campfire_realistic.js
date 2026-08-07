/**
 * Replace campfire with a real close-mic campfire recording (Freesound CC0).
 * Source: HECKFRICKER "Campfire 01" #729395 — seamless loop, ~1:49.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_campfire_real");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const LICENSES = path.join(ROOT, "docs", "SOUND_LICENSES.md");
const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");

const SRC = {
  freesound: 729395,
  title: "Campfire 01",
  author: "HECKFRICKER",
  url: "https://cdn.freesound.org/previews/729/729395_12863902-hq.mp3",
  page: "https://freesound.org/people/HECKFRICKER/sounds/729395/",
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

function updateCatalog() {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const camp = catalog.sounds.find((s) => s.id === "campfire");
  if (camp) {
    camp.path = "res://assets/audio/campfire.wav";
    camp.license = "CC0";
    camp.attribution = `${SRC.title} by ${SRC.author} (Freesound #${SRC.freesound}, CC0)`;
    camp.mixkit_id = 0;
    camp.mixkit_title = "";
    camp.mixkit_url = "";
  }
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  let licenses = fs.readFileSync(LICENSES, "utf8");
  licenses = licenses.replace(
    /\| campfire \| .*/,
    `| campfire | Campfire Crackles (Freesound #${SRC.freesound}, CC0) |`
  );
  fs.writeFileSync(LICENSES, licenses);

  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch (_) {
    manifest = [];
  }
  if (!Array.isArray(manifest)) manifest = [];
  manifest = manifest.filter((e) => e.id !== "campfire");
  manifest.push({
    id: "campfire",
    source: "freesound",
    freesound_id: String(SRC.freesound),
    title: SRC.title,
    author: SRC.author,
    url: SRC.url,
    page: SRC.page,
    note: "Close-mic real campfire, seamless loop (CC0)",
  });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const raw = path.join(TMP, "campfire_src.mp3");
  // Prefer already-downloaded preview if present
  const cached = path.join(AUDIO, "_tmp_campfire", "fs729395.mp3");
  if (fs.existsSync(cached)) {
    fs.copyFileSync(cached, raw);
  } else {
    await download(SRC.url, raw);
  }

  const out = path.join(AUDIO, "campfire.wav");
  // Real close recording — light loudnorm only; no highpass that thins crackles
  run([
    "-i",
    raw,
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ac",
    "1",
    "-ar",
    "44100",
    out,
  ]);

  const mp3 = path.join(AUDIO, "campfire.mp3");
  if (fs.existsSync(mp3)) fs.unlinkSync(mp3);

  updateCatalog();
  console.log("campfire", probe(out).toFixed(2) + "s", "max", maxVol(out));
  console.log("Source:", SRC.page);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
