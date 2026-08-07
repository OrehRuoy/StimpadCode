/**
 * Restore audible faucet drip with irregular real-life spacing (not silent).
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_drip_fix");
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
          reject(new Error("HTTP " + res.statusCode));
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

function maxVol(file) {
  const r = spawnSync(
    FFMPEG,
    ["-i", file, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" }
  );
  const m = (r.stderr || "").match(/max_volume:\s*([-\d.]+)/);
  return m ? Number(m[1]) : null;
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const raw = path.join(TMP, "src.mp3");
  await downloadBsb(1384, raw);
  console.log("raw", probe(raw).toFixed(2) + "s", "max", maxVol(raw));

  // Use a longer natural drip section (audible), not a tiny gated plink
  const bed = path.join(TMP, "bed.wav");
  run([
    "-i",
    raw,
    "-ss",
    "0.4",
    "-t",
    "16",
    "-af",
    "highpass=f=200,lowpass=f=9000,loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ac",
    "1",
    "-ar",
    "44100",
    bed,
  ]);
  console.log("bed", probe(bed).toFixed(2) + "s", "max", maxVol(bed));

  // Build irregular drip pattern by taking short slices at uneven offsets from bed
  // so spacing varies but each drip is from the real recording (audible).
  const offsets = [0.2, 1.6, 2.9, 4.8, 5.7, 7.5, 8.3, 10.1, 11.4, 13.2, 14.0];
  const gaps = [0.55, 1.15, 0.7, 1.8, 0.9, 1.4, 0.6, 1.6, 0.85, 2.0, 1.1];
  const parts = [];
  const listPath = path.join(TMP, "list.txt");

  for (let i = 0; i < offsets.length; i++) {
    const drip = path.join(TMP, `d${i}.wav`);
    const gap = path.join(TMP, `g${i}.wav`);
    const vol = 0.9 + (i % 4) * 0.08;
    run([
      "-i",
      bed,
      "-ss",
      String(offsets[i]),
      "-t",
      "0.55",
      "-af",
      `afade=t=in:st=0:d=0.02,afade=t=out:st=0.42:d=0.1,volume=${vol.toFixed(2)}`,
      "-ac",
      "1",
      "-ar",
      "44100",
      drip,
    ]);
    run([
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=mono",
      "-t",
      String(gaps[i]),
      gap,
    ]);
    parts.push(`file '${drip.replace(/\\/g, "/")}'`);
    parts.push(`file '${gap.replace(/\\/g, "/")}'`);
  }
  fs.writeFileSync(listPath, parts.join("\n") + "\n");

  const concat = path.join(TMP, "irreg.wav");
  run(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", concat]);

  const out = path.join(AUDIO, "tap_drip.wav");
  run([
    "-i",
    concat,
    "-af",
    "loudnorm=I=-14:TP=-1.2:LRA=10,afade=t=in:st=0:d=0.05,afade=t=out:st=" +
      Math.max(0.3, probe(concat) - 0.35).toFixed(2) +
      ":d=0.3",
    "-ac",
    "1",
    "-ar",
    "44100",
    out,
  ]);

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
    sound.attribution =
      "Irregular audible leaky faucet drips (BigSoundBank #1384, CC0)";
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
    title: "Irregular audible water drips",
    url: "https://bigsoundbank.com/UPLOAD/mp3/1384.mp3",
  });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  console.log("out", probe(out).toFixed(2) + "s", "max", maxVol(out));
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (_) {}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
