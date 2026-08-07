/**
 * Faucet drip: clean water drops (BSB #1386), natural irregular rhythm preserved.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_drip3");
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

function run(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-800));
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

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  // Prefer Mixkit if it's a clear drip; fall back to BSB drops of water #3
  const candidates = [
    {
      id: "mixkit",
      mixkit: 2415,
      url: "https://assets.mixkit.co/active_storage/sfx/2415/2415-preview.mp3",
      title: "Mixkit water drip candidate",
    },
    {
      id: "bsb1386",
      bsb: 1386,
      url: "https://bigsoundbank.com/UPLOAD/mp3/1386.mp3",
      title: "Drops of water #3",
    },
  ];

  let chosen = null;
  let raw = null;
  for (const c of candidates) {
    raw = path.join(TMP, c.id + ".mp3");
    try {
      await download(c.url, raw);
      const d = probe(raw);
      const mv = maxVol(raw);
      console.log("try", c.id, d.toFixed(2) + "s", "max", mv);
      if (d >= 3 && mv !== null && mv > -40) {
        chosen = c;
        break;
      }
    } catch (e) {
      console.log("fail", c.id, e.message);
    }
  }
  if (!chosen) throw new Error("no drip source");

  // Light cleanup only — keep natural drip cadence
  const clean = path.join(TMP, "clean.wav");
  run([
    "-i",
    raw,
    "-af",
    "highpass=f=150,lowpass=f=10000,loudnorm=I=-13:TP=-1.0:LRA=11",
    "-ac",
    "1",
    "-ar",
    "44100",
    clean,
  ]);

  const out = path.join(AUDIO, "tap_drip.wav");
  const dur = Math.min(Math.max(probe(clean), 12), 40);
  run([
    "-stream_loop",
    "-1",
    "-i",
    clean,
    "-t",
    String(Math.max(dur * 1.5, 24)),
    "-af",
    `afade=t=in:st=0:d=0.2,afade=t=out:st=${(Math.max(dur * 1.5, 24) - 0.5).toFixed(2)}:d=0.45,loudnorm=I=-13:TP=-1.0:LRA=11`,
    "-ac",
    "1",
    "-ar",
    "44100",
    out,
  ]);

  for (const ext of ["mp3", "ogg"]) {
    const p = path.join(AUDIO, `tap_drip.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const sound = catalog.sounds.find((s) => s.id === "tap_drip");
  if (sound) {
    sound.path = "res://assets/audio/tap_drip.wav";
    sound.mode = "loop";
    sound.default_duration_sec = 60;
    sound.license = chosen.mixkit ? "Mixkit License" : "CC0";
    sound.attribution = chosen.mixkit
      ? `Water drip loop (Mixkit #${chosen.mixkit})`
      : "Water drops (BigSoundBank #1386, CC0)";
    sound.mixkit_id = chosen.mixkit || 0;
    sound.mixkit_title = chosen.mixkit ? chosen.title : "";
    sound.mixkit_url = chosen.mixkit ? chosen.url : "";
    fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
  }

  let manifest = [];
  if (fs.existsSync(MANIFEST)) {
    const rawM = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    manifest = Array.isArray(rawM) ? rawM : rawM.sounds || [];
  }
  manifest = manifest.filter((s) => s.id !== "tap_drip");
  if (chosen.mixkit) {
    manifest.push({
      id: "tap_drip",
      mixkit_id: chosen.mixkit,
      title: chosen.title,
      url: chosen.url,
    });
  } else {
    manifest.push({
      id: "tap_drip",
      source: "bigsoundbank",
      bsb_id: "1386",
      title: chosen.title,
      url: chosen.url,
    });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  console.log("chosen", chosen.id, "out", probe(out).toFixed(2) + "s", "max", maxVol(out));
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.rmSync(path.join(AUDIO, "_tmp_drip2"), { recursive: true, force: true });
  } catch (_) {}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
