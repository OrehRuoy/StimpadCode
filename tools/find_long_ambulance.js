/**
 * Prefer a longer continuous REAL ambulance recording.
 * If none found, keep SoundBible #558 and soft-crossfade-extend so hard repeats are less obvious.
 */
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const TMP = path.join(AUDIO, "_tmp");
const SR = 44100;
const OUT = path.join(AUDIO, "ambulance_siren.wav");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    lib
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPadAudioBot/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(new URL(res.headers.location, url).href, dest).then(resolve).catch(reject);
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

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-600));
}

function probeDuration(file) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
    { encoding: "utf8" }
  );
  return parseFloat(String(r.stdout || "0").trim()) || 0;
}

function updateEntry(catalog, id, patch) {
  const s = catalog.sounds.find((x) => x.id === id);
  if (s) Object.assign(s, patch);
}

function loudnormInstall(srcWav) {
  const loud = path.join(TMP, "ambulance_best_loud.wav");
  ffmpeg([
    "-y",
    "-i",
    srcWav,
    "-af",
    "loudnorm=I=-14:TP=-1.5:LRA=11",
    "-ac",
    "1",
    "-ar",
    String(SR),
    loud,
  ]);
  fs.copyFileSync(loud, OUT);
  return probeDuration(OUT);
}

/** Soft-crossfade concat of SoundBible clip so loop edges are less choppy. */
function softExtend(srcWav, targetSec = 42) {
  const dur = probeDuration(srcWav);
  if (dur < 1) throw new Error("source too short");
  const fade = Math.min(0.85, dur * 0.12);
  const pieces = Math.ceil(targetSec / Math.max(dur - fade, 1));
  const list = path.join(TMP, "amb_concat.txt");
  const faded = path.join(TMP, "amb_piece.wav");
  // Trim a hair off ends and fade in/out for crossfade-friendly piece
  ffmpeg([
    "-y",
    "-i",
    srcWav,
    "-af",
    `afade=t=in:st=0:d=${fade.toFixed(3)},afade=t=out:st=${(dur - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
    "-ac",
    "1",
    "-ar",
    String(SR),
    faded,
  ]);
  const lines = [];
  for (let i = 0; i < pieces; i++) lines.push(`file '${faded.replace(/\\/g, "/")}'`);
  fs.writeFileSync(list, lines.join("\n"));
  const joined = path.join(TMP, "amb_joined.wav");
  ffmpeg(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
  const trimmed = path.join(TMP, "amb_soft_ext.wav");
  ffmpeg(["-y", "-i", joined, "-t", String(targetSec), "-ac", "1", "-ar", String(SR), trimmed]);
  return trimmed;
}

async function tryCandidate(name, url, destWav) {
  const tmp = path.join(TMP, name);
  console.log("try", name, url);
  await download(url, tmp);
  ffmpeg(["-y", "-i", tmp, "-ac", "1", "-ar", String(SR), destWav]);
  const dur = probeDuration(destWav);
  console.log("  dur", dur.toFixed(2), "size", fs.statSync(destWav).size);
  return dur;
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const backup = path.join(TMP, "ambulance_keep.wav");
  // Prefer existing SoundBible-backed keep if present; else current file
  if (!fs.existsSync(backup) && fs.existsSync(OUT)) {
    fs.copyFileSync(OUT, backup);
  }

  // Prefer continuous real recordings that include yelp / US-style, >= ~20s
  const candidates = [
    {
      name: "fsl_emergency_long.mp3",
      url: "https://www.freesoundslibrary.com/wp-content/uploads/2019/09/emergency-siren-close-long.mp3",
      attr: "Emergency Siren Close Long (Free Sounds Library)",
      license: "CC BY 4.0",
      minDur: 20,
    },
    {
      name: "wm_nl_pass.ogg",
      url: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Het_voorbijrijden_van_twee_ambulances_met_sirenes_-_SoundCloud_-_Beeld_en_Geluid.ogg",
      attr: "Two ambulances with sirens passing — Beeld en Geluid / Wikimedia",
      license: "CC BY-SA",
      minDur: 20,
    },
    {
      name: "mix_ambulance_us.mp3",
      // Mixkit “Ambulance siren US” (~12s continuous; still better than hard short loops if longer fails)
      url: "https://assets.mixkit.co/active_storage/sfx/998/998-preview.mp3",
      attr: "Mixkit Ambulance siren US",
      license: "Mixkit License",
      minDur: 10,
      preferLonger: false,
    },
  ];

  let best = null;
  for (const c of candidates) {
    try {
      const tmpWav = path.join(TMP, c.name + ".wav");
      const dur = await tryCandidate(c.name, c.url, tmpWav);
      if (dur >= (c.minDur || 15)) {
        // Prefer longer continuous takes
        if (!best || dur > best.dur) {
          best = { ...c, dur, wav: tmpWav };
        }
      }
    } catch (e) {
      console.log("  fail", e.message.slice(0, 140));
    }
  }

  // Reject Mixkit if we already know it's the short-looped feel / or keep SoundBible character
  // User liked SoundBible #558 yelp. Prefer FreeSoundsLibrary or Wikimedia; else soft-extend SoundBible.
  const soundBibleSrc =
    fs.existsSync(path.join(TMP, "ambulance_soundbible.wav"))
      ? path.join(TMP, "ambulance_soundbible.wav")
      : fs.existsSync(backup)
        ? backup
        : null;

  if (best && best.name.startsWith("fsl_")) {
    const dur = loudnormInstall(best.wav);
    updateEntry(catalog, "ambulance_siren", {
      path: "res://assets/audio/ambulance_siren.wav",
      license: best.license,
      attribution: best.attr,
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
      mode: "loop",
      default_duration_sec: 60,
    });
    console.log("INSTALLED", best.name, "dur", dur.toFixed(1));
  } else if (best && best.name.startsWith("wm_")) {
    const dur = loudnormInstall(best.wav);
    updateEntry(catalog, "ambulance_siren", {
      path: "res://assets/audio/ambulance_siren.wav",
      license: best.license,
      attribution: best.attr,
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
      mode: "loop",
      default_duration_sec: 60,
    });
    console.log("INSTALLED", best.name, "dur", dur.toFixed(1));
  } else if (soundBibleSrc) {
    console.log("No longer continuous yelp source — soft-crossfade extending SoundBible keep");
    const soft = softExtend(soundBibleSrc, 42);
    const dur = loudnormInstall(soft);
    updateEntry(catalog, "ambulance_siren", {
      path: "res://assets/audio/ambulance_siren.wav",
      license: "CC BY 3.0",
      attribution: "Ambulance — Mike Koenig / SoundBible #558 (soft-extended)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
      mode: "loop",
      default_duration_sec: 60,
    });
    console.log("INSTALLED soft-extended SoundBible dur", dur.toFixed(1));
  } else if (best) {
    const dur = loudnormInstall(best.wav);
    updateEntry(catalog, "ambulance_siren", {
      path: "res://assets/audio/ambulance_siren.wav",
      license: best.license,
      attribution: best.attr,
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
      mode: "loop",
      default_duration_sec: 60,
    });
    console.log("INSTALLED fallback", best.name, "dur", dur.toFixed(1));
  } else {
    console.log("Nothing to install");
  }

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
