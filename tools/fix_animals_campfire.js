/**
 * Fix mismatched animal SFX + clean campfire.
 *
 * Root cause: Mixkit preview IDs were guessed from titles/scripts and never
 * verified against Mixkit category pages. Hashes prove:
 *   cat_meow.mp3 == Mixkit #80 (NOT on /cat/ page → horse-like wrong clip)
 *   dog_bark.mp3 == Mixkit #2196 (NOT on /dog/ page → kiss-like wrong clip)
 *   cat_purr.mp3 == Mixkit #96 ("Big wild cat long purr" → weird wild-cat tone)
 *
 * Replacements (BigSoundBank CC0, titles verified on BSB pages):
 *   cat_meow  → Meow Cat #14 (#1902) ~10s
 *   cat_purr  → Cat purring #2 (#0981) ~2m
 *   dog_bark  → Barking Dog Inside (#0112) ~9s
 *   campfire  → Fireplace #4 (#2856) indoor crackle, denoised (no outdoor hiss)
 *
 * Also renames: Sweet Cat Meow → Cat Meow, Cat Long Purr → Cat Purr,
 * Dog Bark Twice → Dog Bark.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_animals");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const CSV = path.join(ROOT, "data", "sound_art_map.csv");
const LICENSES = path.join(ROOT, "docs", "SOUND_LICENSES.md");
const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");

const JOBS = {
  cat_meow: {
    bsb: "1902",
    title: "Meow Cat #14",
    name: "Cat Meow",
    mode: "oneshot",
    af: "loudnorm=I=-16:TP=-1.5:LRA=11",
    page: "https://bigsoundbank.com/meow-cat-14-s1902.html",
  },
  cat_purr: {
    bsb: "0981",
    title: "Cat purring #2",
    name: "Cat Purr",
    mode: "loop",
    af: "highpass=f=40,loudnorm=I=-18:TP=-2:LRA=11",
    page: "https://bigsoundbank.com/cat-purring-2-s0981.html",
  },
  dog_bark: {
    bsb: "0112",
    title: "Barking Dog Inside",
    name: "Dog Bark",
    mode: "oneshot",
    af: "loudnorm=I=-14:TP=-1.2:LRA=11",
    page: "https://bigsoundbank.com/barking-dog-inside-s0112.html",
  },
  campfire: {
    bsb: "2856",
    title: "Fireplace #4",
    name: "Campfire Crackles",
    mode: "loop",
    // Indoor fireplace = fire crackle without outdoor wind/room hiss
    af: "highpass=f=90,afftdn=nr=10:nf=-28,loudnorm=I=-16:TP=-1.5:LRA=11",
    page: "https://bigsoundbank.com/fireplace-4-s2856.html",
  },
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
  for (const [id, job] of Object.entries(JOBS)) {
    const s = catalog.sounds.find((x) => x.id === id);
    if (!s) continue;
    s.name = job.name;
    s.path = `res://assets/audio/${id}.wav`;
    s.mode = job.mode;
    s.license = "CC0";
    s.attribution = `${job.title} (BigSoundBank #${job.bsb}, CC0)`;
    s.mixkit_id = 0;
    s.mixkit_title = "";
    s.mixkit_url = "";
    if (job.mode === "loop") s.default_duration_sec = 60;
    else s.default_duration_sec = 0;
  }
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  if (fs.existsSync(CSV)) {
    let csv = fs.readFileSync(CSV, "utf8");
    csv = csv.replace(
      /cat_meow,"Sweet Cat Meow",cat_meow\.mp3/,
      'cat_meow,"Cat Meow",cat_meow.wav'
    );
    csv = csv.replace(
      /cat_purr,"Cat Long Purr",cat_purr\.mp3/,
      'cat_purr,"Cat Purr",cat_purr.wav'
    );
    csv = csv.replace(
      /dog_bark,"Dog Bark Twice",dog_bark\.mp3/,
      'dog_bark,"Dog Bark",dog_bark.wav'
    );
    csv = csv.replace(/campfire,"Campfire Crackles",campfire\.wav/, 'campfire,"Campfire Crackles",campfire.wav');
    fs.writeFileSync(CSV, csv);
  }

  let licenses = fs.readFileSync(LICENSES, "utf8");
  licenses = licenses.replace(
    /\| campfire \| .*/,
    `| campfire | Campfire Crackles (BigSoundBank #${JOBS.campfire.bsb}) |`
  );
  licenses = licenses.replace(
    /\| cat_meow \| .*/,
    `| cat_meow | Cat Meow (BigSoundBank #${JOBS.cat_meow.bsb}) |`
  );
  // free tier table may only list campfire/cat_meow among these
  if (!/\| cat_meow \|/.test(licenses)) {
    // leave as-is if not in free table
  }
  fs.writeFileSync(LICENSES, licenses);

  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch (_) {
    manifest = [];
  }
  if (!Array.isArray(manifest)) manifest = [];
  const keep = new Set(Object.keys(JOBS));
  manifest = manifest.filter((e) => !keep.has(e.id));
  for (const [id, job] of Object.entries(JOBS)) {
    manifest.push({
      id,
      source: "bigsoundbank",
      bsb_id: job.bsb,
      title: job.title,
      url: `https://bigsoundbank.com/UPLOAD/mp3/${job.bsb}.mp3`,
      page: job.page,
      note: `Replaced mismatched Mixkit ID; verified BSB title`,
    });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  for (const [id, job] of Object.entries(JOBS)) {
    const raw = path.join(TMP, `bsb${job.bsb}.mp3`);
    const url = `https://bigsoundbank.com/UPLOAD/mp3/${job.bsb}.mp3`;
    if (!fs.existsSync(raw)) {
      console.log("download", id, job.title);
      await download(url, raw);
    } else {
      console.log("cached", id, job.title);
    }
    const out = path.join(AUDIO, `${id}.wav`);
    run(["-i", raw, "-af", job.af, "-ac", "1", "-ar", "44100", out]);
    for (const ext of ["mp3", "ogg"]) {
      const p = path.join(AUDIO, `${id}.${ext}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    console.log(id, probe(out).toFixed(2) + "s", "max", maxVol(out), "→", job.name);
  }

  updateCatalog();
  console.log("Done. Animals + campfire replaced with verified BSB sources.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
