/**
 * Replace whistle, school bell, desk fan, vacuum, toaster from Freesound CC0.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix6");

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
  if (meta.mode) sound.mode = meta.mode;
  if (meta.mode === "loop") sound.default_duration_sec = 60;
  if (meta.mode === "oneshot") sound.default_duration_sec = 0;
  sound.license = meta.license || "CC0";
  sound.attribution = meta.note;
  sound.mixkit_id = 0;
  sound.mixkit_title = "";
  sound.mixkit_url = "";
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  let manifest = [];
  if (fs.existsSync(MANIFEST)) {
    const raw = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    manifest = Array.isArray(raw) ? raw : raw.sounds || [];
  }
  manifest = manifest.filter((s) => s.id !== id);
  manifest.push({
    id,
    source: "freesound",
    freesound_id: String(meta.freesound),
    title: meta.title,
    url: meta.url,
  });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

function loopTo(src, dest, seconds, af) {
  const dur = probe(src);
  const list = path.join(TMP, path.basename(dest) + ".txt");
  const reps = Math.max(2, Math.ceil((seconds + 2) / Math.max(dur, 0.4)));
  fs.writeFileSync(
    list,
    Array(reps)
      .fill(`file '${src.replace(/\\/g, "/")}'`)
      .join("\n")
  );
  const concat = path.join(TMP, path.basename(dest) + "_concat.wav");
  runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat]);
  runFfmpeg(["-i", concat, "-t", String(seconds), "-af", af, "-ac", "1", "-ar", "44100", dest]);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  // 1) Whistle — real referee whistle blow (gymnasium), use whistle only
  {
    const id = "fire_whistle";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/218/218318_1480854-hq.mp3";
    const raw = path.join(TMP, "whistle.mp3");
    await download(url, raw);
    const out = path.join(AUDIO, "fire_whistle.wav");
    // Trim to the whistle peal; fade ends; solid oneshot level.
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.05",
      "-t",
      "2.4",
      "-af",
      "highpass=f=500,afade=t=in:st=0:d=0.02,afade=t=out:st=2.15:d=0.22,loudnorm=I=-10:TP=-1.0:LRA=7",
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
        freesound: 218318,
        title: "Referee whistle blow (gymnasium)",
        note: "Referee-style whistle blow (Freesound #218318, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 2) School bell — real LA public school passing-period bell
  {
    const id = "school_bell";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/403/403459_7254895-hq.mp3";
    const raw = path.join(TMP, "school.mp3");
    await download(url, raw);
    const out = path.join(AUDIO, "school_bell.wav");
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "afade=t=in:st=0:d=0.02,afade=t=out:st=4.6:d=0.35,loudnorm=I=-11:TP=-1.2:LRA=8",
      "-t",
      "5.2",
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
        freesound: 403459,
        title: "Modern School Bell (LA public school)",
        note: "Real school hallway passing bell (Freesound #403459, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 3) Desk fan — actual desk fan recording; take steady run
  {
    const id = "fan_hum";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/191/191580_3463736-hq.mp3";
    const raw = path.join(TMP, "fan.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    // Skip startup; take mid run; loop quietly-ish for a desk fan.
    const steady = path.join(TMP, "fan_steady.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "2.0",
      "-t",
      "8.0",
      "-af",
      "highpass=f=60,lowpass=f=8000",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    const out = path.join(AUDIO, "fan_hum.wav");
    loopTo(
      steady,
      out,
      28,
      "afade=t=in:st=0:d=0.25,afade=t=out:st=27.5:d=0.45,loudnorm=I=-18:TP=-2.0:LRA=8"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 191580,
        title: "Electric desk fan run",
        note: "Electric desk fan running (Freesound #191580, CC0)",
        url,
        mode: "loop",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 4) Vacuum — upright/home vacuum running
  {
    const id = "vacuum";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/482/482754_2524442-hq.mp3";
    const raw = path.join(TMP, "vac.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const steady = path.join(TMP, "vac_steady.wav");
    // Take a continuous running section if long; otherwise whole clip.
    const d = probe(raw);
    const ss = d > 6 ? "1.2" : "0";
    const t = d > 6 ? "10" : String(Math.max(d - 0.2, 2));
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      ss,
      "-t",
      t,
      "-af",
      "highpass=f=50,lowpass=f=10000",
      "-ac",
      "1",
      "-ar",
      "44100",
      steady,
    ]);
    const out = path.join(AUDIO, "vacuum.wav");
    loopTo(
      steady,
      out,
      30,
      "afade=t=in:st=0:d=0.2,afade=t=out:st=29.5:d=0.45,loudnorm=I=-14:TP=-1.5:LRA=9"
    );
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 482754,
        title: "Vacuum running closer",
        note: "Vacuum cleaner running (Freesound #482754, CC0)",
        url,
        mode: "loop",
      },
      `res://assets/audio/${id}.wav`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // 5) Toaster — clear pop-up
  {
    const id = "toaster_pop";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/444/444430_8522109-hq.mp3";
    const raw = path.join(TMP, "toast.mp3");
    await download(url, raw);
    const out = path.join(AUDIO, "toaster_pop.mp3");
    runFfmpeg([
      "-i",
      raw,
      "-af",
      "silenceremove=start_periods=1:start_silence=0.02:start_threshold=-42dB,afade=t=in:st=0:d=0.005,afade=t=out:st=0.85:d=0.12,loudnorm=I=-9:TP=-1.0:LRA=6",
      "-t",
      "1.2",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-b:a",
      "192k",
      out,
    ]);
    clearOther(id, "mp3");
    updateCatalog(
      id,
      {
        freesound: 444430,
        title: "Toaster Pop",
        note: "Toaster pop-up (Freesound #444430, CC0)",
        url,
        mode: "oneshot",
      },
      `res://assets/audio/${id}.mp3`
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
