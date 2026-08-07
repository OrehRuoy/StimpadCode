/**
 * Fix Misc sounds with realistic sources + rename Triangle + quieter.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_misc_fix");
const SOUNDS = path.join(ROOT, "data", "sounds.json");
const CSV = path.join(ROOT, "data", "sound_art_map.csv");
const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");

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
  if (/Creative Commons 0|CC0/i.test(html)) lic = "CC0";
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

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS, "utf8"));
  const byId = Object.fromEntries(catalog.sounds.map((s) => [s.id, s]));

  // --- Crumpled Paper: classic hand crumple ---
  {
    const meta = await fsPreview(151231);
    const raw = path.join(TMP, "paper.mp3");
    await download(meta.url, raw);
    const out = path.join(AUDIO, "paper_crinkle.wav");
    run([
      "-i",
      raw,
      "-af",
      "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=8,afade=t=in:st=0:d=0.01,afade=t=out:st=1.95:d=0.18",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    Object.assign(byId.paper_crinkle, {
      name: "Crumpled Paper",
      path: "res://assets/audio/paper_crinkle.wav",
      license: "CC0",
      attribution: "Crumpling Paper (Freesound #151231 by OwlStorm / Ashe Kirk, CC0)",
    });
    console.log("paper", probe(out).toFixed(2) + "s");
  }

  // --- Ice crunch: actual chewing/crunching ice cubes ---
  {
    const meta = await fsPreview(187331);
    const raw = path.join(TMP, "ice.mp3");
    await download(meta.url, raw);
    const out = path.join(AUDIO, "ice_crunch.wav");
    run([
      "-t",
      "8.5",
      "-i",
      raw,
      "-af",
      "highpass=f=100,loudnorm=I=-15:TP=-1.3:LRA=9,afade=t=in:st=0:d=0.02,afade=t=out:st=8.1:d=0.3",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    Object.assign(byId.ice_crunch, {
      name: "Crunching Ice Cubes",
      path: "res://assets/audio/ice_crunch.wav",
      license: "CC0",
      attribution:
        "Crunching and Chewing Ice Cubes (Freesound #187331 by baidonovan, CC0)",
    });
    console.log("ice", probe(out).toFixed(2) + "s");
  }

  // --- Triangle: rename + quieter ---
  {
    const src = path.join(AUDIO, "triangle_ting.wav");
    const tmp = path.join(TMP, "triangle_quiet.wav");
    run([
      "-i",
      src,
      "-af",
      "loudnorm=I=-20:TP=-2.5:LRA=7",
      "-ac",
      "1",
      "-ar",
      "44100",
      tmp,
    ]);
    fs.copyFileSync(tmp, src);
    Object.assign(byId.triangle_ting, {
      name: "Triangle",
      path: "res://assets/audio/triangle_ting.wav",
    });
    console.log("triangle quieter", probe(src).toFixed(2) + "s");
  }

  // --- Dial tone: authentic US continuous dial tone (350 + 440 Hz) ---
  {
    const out = path.join(AUDIO, "dial_tone.wav");
    // Generate ~20s seamless loopable dual-tone
    run([
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=350:sample_rate=44100:duration=20",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=44100:duration=20",
      "-filter_complex",
      "[0][1]amix=inputs=2:duration=longest,volume=0.55,loudnorm=I=-18:TP=-2:LRA=5",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    Object.assign(byId.dial_tone, {
      name: "Phone Dial Tone",
      mode: "loop",
      default_duration_sec: 60,
      path: "res://assets/audio/dial_tone.wav",
      license: "CC0",
      attribution: "US dial tone (350 Hz + 440 Hz sine mix, original StimPad, CC0)",
    });
    console.log("dial_tone", probe(out).toFixed(2) + "s");
  }

  // --- Popcorn: real pot popping (active mid section) ---
  {
    const meta = await fsPreview(198381);
    const raw = path.join(TMP, "popcorn.mp3");
    await download(meta.url, raw);
    const out = path.join(AUDIO, "popcorn_pop.wav");
    run([
      "-ss",
      "35",
      "-t",
      "12",
      "-i",
      raw,
      "-af",
      "highpass=f=120,loudnorm=I=-15:TP=-1.3:LRA=10,afade=t=in:st=0:d=0.08,afade=t=out:st=11.5:d=0.4",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    Object.assign(byId.popcorn_pop, {
      name: "Popcorn Kernel Pop",
      path: "res://assets/audio/popcorn_pop.wav",
      license: "CC0",
      attribution:
        "Popcorn popping in metal pot (Freesound #198381 by goose278, CC0)",
    });
    console.log("popcorn", probe(out).toFixed(2) + "s");
  }

  // --- Rotary phone ring: Western Electric 500 brass bells ---
  {
    const meta = await fsPreview(456433);
    const raw = path.join(TMP, "phone.mp3");
    await download(meta.url, raw);
    const out = path.join(AUDIO, "old_phone_ring.wav");
    run([
      "-ss",
      "1.0",
      "-t",
      "10.5",
      "-i",
      raw,
      "-af",
      "highpass=f=200,loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:st=0:d=0.05,afade=t=out:st=10.0:d=0.4",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    Object.assign(byId.old_phone_ring, {
      name: "Rotary Phone Ring",
      path: "res://assets/audio/old_phone_ring.wav",
      license: "CC0",
      attribution:
        "Western Electric 500 rotary phone ringing (Freesound #456433 by mycompasstv, CC0)",
    });
    console.log("phone_ring", probe(out).toFixed(2) + "s");
  }

  // Clean sibling mp3/ogg (+ Godot .import) for replaced ids
  for (const id of [
    "paper_crinkle",
    "ice_crunch",
    "dial_tone",
    "popcorn_pop",
    "old_phone_ring",
  ]) {
    for (const ext of ["mp3", "ogg"]) {
      const p = path.join(AUDIO, id + "." + ext);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      const imp = p + ".import";
      if (fs.existsSync(imp)) fs.unlinkSync(imp);
    }
  }

  fs.writeFileSync(SOUNDS, JSON.stringify(catalog, null, 2) + "\n");

  // CSV display name for triangle
  if (fs.existsSync(CSV)) {
    let csv = fs.readFileSync(CSV, "utf8");
    csv = csv.replace(
      /triangle_ting,"Orchestra Triangle"/,
      'triangle_ting,"Triangle"'
    );
    fs.writeFileSync(CSV, csv);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
