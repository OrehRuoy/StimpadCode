/**
 * Misc QA round 2:
 * - Longer paper crumple
 * - Realistic popcorn (BSB pan)
 * - Authentic rotary phone ring (Stromberg)
 * - Real scissors snips (BSB)
 * - Real toy xylophone notes
 * - Slower wooden metronome (~72 BPM)
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_misc_round2");
const SOUNDS = path.join(ROOT, "data", "sounds.json");
const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");
const BSB = (n) =>
  `https://bigsoundbank.com/UPLOAD/mp3/${String(n).padStart(4, "0")}.mp3`;

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return get(new URL(res.headers.location, url).href).then(resolve).catch(reject);
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "StimPad/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error("HTTP " + res.statusCode + " " + url));
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", reject);
  });
}

function run(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-1400));
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

async function fsPreview(id) {
  const html = await get("https://freesound.org/s/" + id + "/");
  let lic = "?";
  if (/Creative Commons 0|CC0|PUBLIC\s*-\(CC0\)-|public domain/i.test(html)) lic = "CC0";
  else if (/Attribution-NonCommercial|BY-NC/i.test(html)) lic = "BY-NC";
  else if (/Attribution/i.test(html)) lic = "CC BY";
  if (lic === "BY-NC") throw new Error("BY-NC not allowed: " + id);
  const m = html.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  if (!m) throw new Error("no preview " + id);
  return {
    lic,
    url: `https://cdn.freesound.org/previews/${Math.floor(Number(id) / 1000)}/${m[1]}-hq.mp3`,
  };
}

function cleanOld(id) {
  for (const ext of ["mp3", "ogg", "wav"]) {
    const p = path.join(AUDIO, id + "." + ext);
    const imp = p + ".import";
    // keep current wav while overwriting; only remove non-target leftovers after write
    if (ext !== "wav" && fs.existsSync(p)) fs.unlinkSync(p);
    if (ext !== "wav" && fs.existsSync(imp)) fs.unlinkSync(imp);
  }
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS, "utf8"));
  const byId = Object.fromEntries(catalog.sounds.map((s) => [s.id, s]));

  // --- Crumpled Paper: longer close-mic crumple (~10s) ---
  {
    const meta = await fsPreview(725251);
    const raw = path.join(TMP, "paper.mp3");
    await download(meta.url, raw);
    const out = path.join(AUDIO, "paper_crinkle.wav");
    run([
      "-t",
      "10.5",
      "-i",
      raw,
      "-af",
      "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:st=0:d=0.02,afade=t=out:st=10.0:d=0.4",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    cleanOld("paper_crinkle");
    Object.assign(byId.paper_crinkle, {
      path: "res://assets/audio/paper_crinkle.wav",
      license: "CC0",
      attribution: "PaperCrumpling 2 (Freesound #725251 by lematt, CC0)",
    });
    console.log("paper", probe(out).toFixed(2) + "s");
  }

  // --- Popcorn: pan popping (BSB #0413) — active mid section ---
  {
    const raw = path.join(TMP, "popcorn.mp3");
    await download(BSB(413), raw);
    const out = path.join(AUDIO, "popcorn_pop.wav");
    // Skip quiet start; take a stretch of continuous pops
    run([
      "-ss",
      "8",
      "-t",
      "12",
      "-i",
      raw,
      "-af",
      "highpass=f=100,loudnorm=I=-15:TP=-1.3:LRA=10,afade=t=in:st=0:d=0.08,afade=t=out:st=11.4:d=0.5",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    cleanOld("popcorn_pop");
    Object.assign(byId.popcorn_pop, {
      path: "res://assets/audio/popcorn_pop.wav",
      license: "CC0",
      attribution: "Pop-Corn: Corn bursting in pan (BigSoundBank #0413 by Joseph Sardin, CC0)",
    });
    console.log("popcorn", probe(out).toFixed(2) + "s");
  }

  // --- Rotary phone: Stromberg Carlson 1543 with real telco ring timing ---
  {
    const meta = await fsPreview(274436);
    const raw = path.join(TMP, "phone.mp3");
    await download(meta.url, raw);
    const out = path.join(AUDIO, "old_phone_ring.wav");
    // Keep ~4 rings (comments praise authentic 1970s ring)
    run([
      "-t",
      "16",
      "-i",
      raw,
      "-af",
      "highpass=f=180,loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:st=0:d=0.04,afade=t=out:st=15.4:d=0.5",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    cleanOld("old_phone_ring");
    Object.assign(byId.old_phone_ring, {
      path: "res://assets/audio/old_phone_ring.wav",
      license: "CC0",
      attribution:
        "Stromberg Carlson 1543 rotary phone ringing (Freesound #274436 by Hockinfinger, CC0)",
    });
    console.log("phone", probe(out).toFixed(2) + "s");
  }

  // --- Scissors: BSB studio scissors (closing snips) ---
  {
    const raw = path.join(TMP, "scissors.mp3");
    await download(BSB(8), raw);
    const out = path.join(AUDIO, "scissors_snip.wav");
    // First cluster of closing snips
    run([
      "-t",
      "3.2",
      "-i",
      raw,
      "-af",
      "highpass=f=200,loudnorm=I=-15:TP=-1.3:LRA=7,afade=t=in:st=0:d=0.01,afade=t=out:st=2.9:d=0.25",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    cleanOld("scissors_snip");
    Object.assign(byId.scissors_snip, {
      path: "res://assets/audio/scissors_snip.wav",
      license: "CC0",
      attribution: "Scissors closing/opening (BigSoundBank #0008 by Joseph Sardin, CC0)",
    });
    console.log("scissors", probe(out).toFixed(2) + "s");
  }

  // --- Toy xylophone: real toy being played ---
  {
    const meta = await fsPreview(501300);
    const raw = path.join(TMP, "xylo.mp3");
    await download(meta.url, raw);
    const out = path.join(AUDIO, "xylophone.wav");
    run([
      "-t",
      "8.5",
      "-i",
      raw,
      "-af",
      "highpass=f=250,loudnorm=I=-16:TP=-1.5:LRA=8,afade=t=in:st=0:d=0.02,afade=t=out:st=8.0:d=0.4",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    cleanOld("xylophone");
    Object.assign(byId.xylophone, {
      path: "res://assets/audio/xylophone.wav",
      license: "CC0",
      attribution: "Toy Xylophone (Freesound #501300 by JappeHallunken, CC0)",
    });
    console.log("xylophone", probe(out).toFixed(2) + "s");
  }

  // --- Metronome: mechanical wood tick slowed from 120 → ~72 BPM ---
  {
    const raw = path.join(TMP, "metro120.mp3");
    await download(BSB(468), raw);
    const out = path.join(AUDIO, "metronome.wav");
    // 72/120 = 0.6; build a longer seamless loop (~20s at new tempo)
    run([
      "-stream_loop",
      "3",
      "-i",
      raw,
      "-af",
      "atempo=0.6,loudnorm=I=-16:TP=-1.5:LRA=6,afade=t=in:st=0:d=0.02,afade=t=out:st=19.5:d=0.4",
      "-t",
      "20",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    cleanOld("metronome");
    Object.assign(byId.metronome, {
      mode: "loop",
      default_duration_sec: 60,
      path: "res://assets/audio/metronome.wav",
      license: "CC0",
      attribution:
        "Mechanical metronome (~72 BPM from BSB #0468 @120, BigSoundBank / Joseph Sardin, CC0)",
    });
    console.log("metronome", probe(out).toFixed(2) + "s @~72bpm");
  }

  fs.writeFileSync(SOUNDS, JSON.stringify(catalog, null, 2) + "\n");
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
