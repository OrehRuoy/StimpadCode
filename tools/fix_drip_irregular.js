/**
 * Quieter faucet drip with irregular real-life drip spacing.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_drip_irreg");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");

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
          reject(new Error(`HTTP ${res.statusCode}`));
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

function run(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-900));
}

function probe(file) {
  return Number(
    spawnSync(
      FFPROBE,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", file],
      { encoding: "utf8" }
    ).stdout.trim()
  );
}

function silenceWav(seconds, dest) {
  run([
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=mono",
    "-t",
    String(seconds),
    dest,
  ]);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const raw = path.join(TMP, "drip_src.mp3");
  await downloadBsb(1384, raw);
  console.log("raw", probe(raw).toFixed(2) + "s");

  // Isolate a single drip plink (~0.35s) from a clean region
  const drip = path.join(TMP, "plink.wav");
  run([
    "-i",
    raw,
    "-ss",
    "1.15",
    "-t",
    "0.42",
    "-af",
    "highpass=f=450,lowpass=f=7000,afade=t=in:st=0:d=0.01,afade=t=out:st=0.32:d=0.08,volume=0.55,loudnorm=I=-22:TP=-3.5:LRA=6",
    "-ac",
    "1",
    "-ar",
    "44100",
    drip,
  ]);
  console.log("plink", probe(drip).toFixed(2) + "s");

  // Irregular gaps (seconds) — real leaky faucet rhythm
  const gaps = [0.85, 1.35, 0.7, 2.1, 1.05, 0.55, 1.8, 0.95, 1.55, 0.65, 2.4, 1.2, 0.75, 1.9];
  const listPath = path.join(TMP, "list.txt");
  const parts = [];
  for (let i = 0; i < gaps.length; i++) {
    const dFile = path.join(TMP, `d${i}.wav`).replace(/\\/g, "/");
    const gFile = path.join(TMP, `g${i}.wav`).replace(/\\/g, "/");
    fs.copyFileSync(drip, path.join(TMP, `d${i}.wav`));
    // tiny volume variation per drip
    const vol = 0.72 + (i % 5) * 0.06;
    run([
      "-i",
      drip,
      "-af",
      `volume=${vol.toFixed(2)}`,
      "-ac",
      "1",
      "-ar",
      "44100",
      path.join(TMP, `d${i}.wav`),
    ]);
    silenceWav(gaps[i], path.join(TMP, `g${i}.wav`));
    parts.push(`file '${dFile}'`);
    parts.push(`file '${gFile}'`);
  }
  fs.writeFileSync(listPath, parts.join("\n") + "\n");

  const concat = path.join(TMP, "irreg.wav");
  run(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", concat]);
  console.log("concat", probe(concat).toFixed(2) + "s");

  const out = path.join(AUDIO, "tap_drip.wav");
  // Soft overall; keep quieter than before
  run([
    "-i",
    concat,
    "-af",
    "afade=t=in:st=0:d=0.05,afade=t=out:st=" +
      Math.max(0.2, probe(concat) - 0.35).toFixed(2) +
      ":d=0.3,volume=0.85,loudnorm=I=-23:TP=-4.0:LRA=8",
    "-ac",
    "1",
    "-ar",
    "44100",
    out,
  ]);

  // clear other extensions for this id only
  for (const ext of ["mp3", "ogg"]) {
    const p = path.join(AUDIO, `tap_drip.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    if (fs.existsSync(p + ".import")) fs.unlinkSync(p + ".import");
  }

  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const sound = catalog.sounds.find((s) => s.id === "tap_drip");
  if (sound) {
    sound.path = "res://assets/audio/tap_drip.wav";
    sound.mode = "loop";
    sound.default_duration_sec = 60;
    sound.license = "CC0";
    sound.attribution = "Irregular quiet leaky faucet drips (BigSoundBank #1384, CC0)";
    sound.mixkit_id = 0;
    sound.mixkit_title = "";
    sound.mixkit_url = "";
    fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
  }

  let manifest = [];
  if (fs.existsSync(MANIFEST)) {
    const rawM = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    manifest = Array.isArray(rawM) ? rawM : rawM.sounds || [];
  }
  manifest = manifest.filter((s) => s.id !== "tap_drip");
  manifest.push({
    id: "tap_drip",
    source: "bigsoundbank",
    bsb_id: "1384",
    title: "Irregular quiet water drips",
    url: "https://bigsoundbank.com/UPLOAD/mp3/1384.mp3",
  });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  console.log("out", probe(out).toFixed(2) + "s");
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (_) {}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
