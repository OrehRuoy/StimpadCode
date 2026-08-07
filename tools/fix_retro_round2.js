/**
 * Round-2: longer held drill, cassette insert+rewind, realistic PC/tray/HDD,
 * closer console mimics, add dial-up modem.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_round2");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const CSV = path.join(ROOT, "data", "sound_art_map.csv");
const QA = path.join(ROOT, "docs", "SOUND_QA.md");
const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");
const SR = 44100;

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

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(new URL(res.headers.location, url).href).then(resolve).catch(reject);
          return;
        }
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
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

function maxVol(f) {
  const r = spawnSync(FFMPEG, ["-i", f, "-af", "volumedetect", "-f", "null", "-"], {
    encoding: "utf8",
  });
  const m = (r.stderr || "").match(/max_volume:\s*([-\d.]+)/);
  return m ? Number(m[1]) : null;
}

async function fsPreview(id) {
  const html = await get("https://freesound.org/s/" + id + "/");
  const m = html.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  if (!m) throw new Error("no preview " + id);
  const stem = m[1];
  // Freesound CDN folder = floor(soundId / 1000)
  const folder = Math.floor(Number(id) / 1000);
  return `https://cdn.freesound.org/previews/${folder}/${stem}-hq.mp3`;
}

function rmOther(id, keepExt) {
  for (const ext of ["mp3", "ogg", "wav"]) {
    if (ext === keepExt) continue;
    const p = path.join(AUDIO, `${id}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function writeWav(filePath, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE((v * 32767) | 0, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}

function env(t, a, d, s, r, dur) {
  if (t < a) return t / Math.max(a, 1e-6);
  if (t < a + d) return 1 - (1 - s) * ((t - a) / Math.max(d, 1e-6));
  if (t < dur - r) return s;
  if (t < dur) return s * (1 - (t - (dur - r)) / Math.max(r, 1e-6));
  return 0;
}

function osc(type, phase) {
  const x = ((phase % 1) + 1) % 1;
  if (type === "square") return x < 0.5 ? 1 : -1;
  if (type === "triangle") return 1 - 4 * Math.abs(x - 0.5);
  if (type === "pulse") return x < 0.25 ? 1 : -1;
  return Math.sin(2 * Math.PI * x);
}

function synth(duration, render) {
  const n = Math.floor(duration * SR);
  const samples = new Float64Array(n);
  render(samples);
  let peak = 0.001;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return Array.from(samples, (v) => (v / peak) * 0.72);
}

/** Closer arcade: CRT + short 4-note attract (original melody). */
function synthArcadeBoot() {
  return synth(2.8, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 0.06) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.06) * 0.6;
      if (t > 0.05 && t < 0.7) {
        const u = (t - 0.05) / 0.65;
        const f = 120 + u * u * 2800;
        s[i] += Math.sin(2 * Math.PI * f * t) * (1 - u) * 0.25;
        s[i] += (Math.random() * 2 - 1) * (1 - u) * 0.05;
      }
      // Distinct attract melody (not a licensed cabinet)
      const notes = [
        [0.75, 349.23],
        [0.95, 440],
        [1.15, 523.25],
        [1.4, 698.46],
        [1.75, 880],
      ];
      for (const [st, f] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < 0.2)
          s[i] += osc("pulse", f * t) * env(lt, 0.004, 0.03, 0.5, 0.1, 0.2) * 0.3;
      }
      if (t > 2.1 && t < 2.7) {
        const lt = t - 2.1;
        s[i] += osc("square", 1046.5 * t) * env(lt, 0.01, 0.05, 0.35, 0.3, 0.6) * 0.22;
      }
    }
  });
}

function synthArcadeChime() {
  return synth(1.25, (s) => {
    const notes = [
      [0, 740, 0.14],
      [0.14, 988, 0.14],
      [0.32, 1480, 0.55],
    ];
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      for (const [st, f, dur] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          s[i] += osc("pulse", f * t) * env(lt, 0.003, 0.04, 0.4, 0.25, dur) * 0.32;
          s[i] += Math.sin(2 * Math.PI * f * 2 * t) * env(lt, 0.003, 0.04, 0.2, 0.25, dur) * 0.1;
        }
      }
    }
  });
}

/**
 * Disc console (PS-era vibe): whoosh + ascending two-hit logo swell.
 * Melody deliberately different from Sony's jingle.
 */
function synthDiscBoot() {
  return synth(3.2, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      // optical whoosh / air
      if (t < 1.4) {
        const u = t / 1.4;
        const f = 80 + u * 420;
        s[i] += (Math.random() * 2 - 1) * (0.08 + u * 0.12) * (1 - u * 0.3);
        s[i] += Math.sin(2 * Math.PI * f * t) * u * (1 - u) * 0.35;
      }
      // logo chords — original voicing (not PS1)
      const hits = [
        [1.15, [196, 246.94, 311.13], 1.1],
        [1.85, [246.94, 311.13, 392], 1.2],
      ];
      for (const [st, freqs, dur] of hits) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          for (const f of freqs) {
            s[i] +=
              Math.sin(2 * Math.PI * f * t) * env(lt, 0.08, 0.25, 0.5, 0.6, dur) * 0.22;
          }
        }
      }
    }
  });
}

/**
 * Handheld (Game Boy-ish): short square blips then held note.
 * Structure similar to logo boots; pitches are original.
 */
function synthHandheldBoot() {
  return synth(2.1, (s) => {
    const notes = [
      [0.08, 415.3, 0.11],
      [0.22, 523.25, 0.11],
      [0.36, 622.25, 0.12],
      [0.55, 830.61, 1.2],
    ];
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      // tiny power click
      if (t < 0.03) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.03) * 0.2;
      for (const [st, f, dur] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          const vib = 1 + 0.003 * Math.sin(2 * Math.PI * 5.5 * t);
          s[i] +=
            osc("pulse", f * vib * t) * env(lt, 0.003, 0.04, 0.55, 0.35, dur) * 0.34;
        }
      }
    }
  });
}

/**
 * Home console (SNES-era soft power): single warm power-on bong with decay.
 * Timbre inspired by 16-bit power tones; pitch/contour original.
 */
function synthHomeBoot() {
  return synth(2.4, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 0.035) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.035) * 0.3;
      // slight pitch drop into the bong (characteristic feel, original freqs)
      const drop = t < 0.4 ? 1 + (0.4 - t) * 0.08 : 1;
      const partials = [
        [185, 0.35],
        [233, 0.28],
        [277, 0.22],
        [370, 0.12],
      ];
      for (const [f, amp] of partials) {
        s[i] +=
          Math.sin(2 * Math.PI * f * drop * t) *
          env(t, 0.02, 0.25, 0.4, 1.4, 2.35) *
          amp;
      }
      // soft sparkle after
      if (t > 0.55 && t < 1.6) {
        const lt = t - 0.55;
        s[i] +=
          osc("triangle", 740 * t) * env(lt, 0.02, 0.15, 0.2, 0.6, 1.05) * 0.1;
      }
    }
  });
}

/**
 * Build a long "held trigger" drill by acrossfade-looping the densest under-load segment.
 */
function makeHeldDrill(src, dest) {
  // Take a strong mid segment (~3.2s of continuous bite), loop with crossfades to ~40s
  const seg = path.join(TMP, "drill_seg.wav");
  run([
    "-ss",
    "1.2",
    "-i",
    src,
    "-t",
    "3.2",
    "-af",
    "highpass=f=80,loudnorm=I=-14:TP=-1.2:LRA=8",
    "-ac",
    "1",
    "-ar",
    "44100",
    seg,
  ]);
  // acrossfade chain: seg joined to itself many times
  const parts = [];
  const inputs = [];
  const N = 14; // ~3.2 * 14 with overlap ≈ 40s
  for (let i = 0; i < N; i++) {
    inputs.push("-i", seg);
    parts.push(`[${i}:a]`);
  }
  // Build nested acrossfade
  let filter = "";
  let cur = "[0:a]";
  for (let i = 1; i < N; i++) {
    const out = i === N - 1 ? "[out]" : `[a${i}]`;
    filter += `${cur}[${i}:a]acrossfade=d=0.35:c1=tri:c2=tri${out};`;
    cur = `[a${i}]`;
  }
  filter = filter.replace(/;$/, "");
  run([...inputs, "-filter_complex", filter, "-map", "[out]", dest]);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const byId = Object.fromEntries(catalog.sounds.map((s) => [s.id, s]));
  const notes = [];

  // --- Held electric drill ---
  {
    const raw = path.join(TMP, "drill_src.mp3");
    // Prefer BSB 0791 continuous wood drill as source material
    await download("https://bigsoundbank.com/UPLOAD/mp3/0791.mp3", raw);
    const out = path.join(AUDIO, "electric_drill.wav");
    makeHeldDrill(raw, out);
    rmOther("electric_drill", "wav");
    byId.electric_drill.name = "Electric Drill";
    byId.electric_drill.path = "res://assets/audio/electric_drill.wav";
    byId.electric_drill.attribution =
      "Held-trigger loop from corded drill (BigSoundBank #0791, CC0)";
    byId.electric_drill.license = "CC0";
    console.log("electric_drill", probe(out).toFixed(2) + "s", "max", maxVol(out));
    notes.push({ id: "electric_drill", source: "bsb0791_held_loop" });
  }

  // --- Cassette: insert door + rewind ---
  {
    const insert = path.join(TMP, "cass_insert.mp3");
    const rewind = path.join(TMP, "cass_rew.mp3");
    await download("https://bigsoundbank.com/UPLOAD/mp3/0571.mp3", insert);
    await download("https://bigsoundbank.com/UPLOAD/mp3/0566.mp3", rewind);
    const a = path.join(TMP, "cass_a.wav");
    const b = path.join(TMP, "cass_b.wav");
    // First insert cycle (~first half of 0571 which does it twice)
    run([
      "-i",
      insert,
      "-t",
      "8.5",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      a,
    ]);
    // One rewind+stop (~half of 0566 twice)
    run([
      "-i",
      rewind,
      "-t",
      "4.0",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      b,
    ]);
    const out = path.join(AUDIO, "cassette_deck.wav");
    run([
      "-i",
      a,
      "-i",
      b,
      "-filter_complex",
      "[0:a][1:a]concat=n=2:v=0:a=1[out]",
      "-map",
      "[out]",
      out,
    ]);
    rmOther("cassette_deck", "wav");
    Object.assign(byId.cassette_deck, {
      name: "Cassette Deck",
      path: "res://assets/audio/cassette_deck.wav",
      license: "CC0",
      attribution:
        "Cassette insert (BSB #0571) + rewind/stop (BSB #0566), CC0",
    });
    console.log("cassette_deck", probe(out).toFixed(2) + "s", "max", maxVol(out));
    notes.push({ id: "cassette_deck", source: "bsb0571+0566" });
  }

  // --- PC Power On: real mid-90s desktop boot ---
  {
    const url = await fsPreview(52050);
    const raw = path.join(TMP, "pc_boot.mp3");
    await download(url, raw);
    const out = path.join(AUDIO, "ui_boot_start.wav");
    run([
      "-i",
      raw,
      "-af",
      "highpass=f=40,afftdn=nr=6:nf=-32,loudnorm=I=-16:TP=-1.5:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    rmOther("ui_boot_start", "wav");
    Object.assign(byId.ui_boot_start, {
      name: "PC Power On",
      path: "res://assets/audio/ui_boot_start.wav",
      license: "CC0",
      attribution: "Old mid-90s desktop computer starting up (Freesound #52050, CC0)",
    });
    console.log("ui_boot_start", probe(out).toFixed(2) + "s", "max", maxVol(out));
    notes.push({ id: "ui_boot_start", freesound: 52050 });
  }

  // --- Disc tray open from CD/DVD drive operating (eject portion) ---
  {
    const url = await fsPreview(812507);
    const raw = path.join(TMP, "drive.mp3");
    await download(url, raw);
    const out = path.join(AUDIO, "unlock_chime.wav");
    // Author notes: eject ~0:19–0:23; keep a little before for button + motor
    run([
      "-ss",
      "18.5",
      "-i",
      raw,
      "-t",
      "5.0",
      "-af",
      "loudnorm=I=-14:TP=-1.2:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    rmOther("unlock_chime", "wav");
    Object.assign(byId.unlock_chime, {
      name: "Disc Tray Open",
      path: "res://assets/audio/unlock_chime.wav",
      license: "CC0",
      attribution: "CD/DVD drive eject (Freesound #812507 by Mihacappy, CC0)",
    });
    console.log("unlock_chime", probe(out).toFixed(2) + "s", "max", maxVol(out));
    notes.push({ id: "unlock_chime", freesound: 812507 });
  }

  // --- Hard drive boot hum: clean PC fan loop (studio), not phone-y NAS ---
  {
    const raw = path.join(TMP, "fan.mp3");
    await download("https://bigsoundbank.com/UPLOAD/mp3/0125.mp3", raw);
    const out = path.join(AUDIO, "os_loading_hum.wav");
    // Extend clean 10s fan to 45s with acrossfade loops (seamless-ish)
    const seg = path.join(TMP, "fan_seg.wav");
    run([
      "-i",
      raw,
      "-af",
      "highpass=f=50,loudnorm=I=-20:TP=-3:LRA=7",
      "-ac",
      "1",
      "-ar",
      "44100",
      seg,
    ]);
    const inputs = [];
    for (let i = 0; i < 6; i++) inputs.push("-i", seg);
    let filter = "";
    let cur = "[0:a]";
    for (let i = 1; i < 6; i++) {
      const outL = i === 5 ? "[out]" : `[f${i}]`;
      filter += `${cur}[${i}:a]acrossfade=d=0.8:c1=tri:c2=tri${outL};`;
      cur = `[f${i}]`;
    }
    filter = filter.replace(/;$/, "");
    run([...inputs, "-filter_complex", filter, "-map", "[out]", out]);
    rmOther("os_loading_hum", "wav");
    Object.assign(byId.os_loading_hum, {
      name: "Hard Drive Boot Hum",
      path: "res://assets/audio/os_loading_hum.wav",
      mode: "loop",
      default_duration_sec: 60,
      license: "CC0",
      attribution:
        "Clean computer PSU/fan hum while booting (BigSoundBank #0125, CC0)",
    });
    console.log("os_loading_hum", probe(out).toFixed(2) + "s", "max", maxVol(out));
    notes.push({ id: "os_loading_hum", source: "bsb0125_fan_loop" });
  }

  // --- Closer console / arcade mimics ---
  writeWav(path.join(AUDIO, "arcade_boot_jingle.wav"), synthArcadeBoot());
  writeWav(path.join(AUDIO, "arcade_notify.wav"), synthArcadeChime());
  writeWav(path.join(AUDIO, "disc_console_boot.wav"), synthDiscBoot());
  writeWav(path.join(AUDIO, "handheld_boot.wav"), synthHandheldBoot());
  writeWav(path.join(AUDIO, "home_console_boot.wav"), synthHomeBoot());
  for (const id of [
    "arcade_boot_jingle",
    "arcade_notify",
    "disc_console_boot",
    "handheld_boot",
    "home_console_boot",
  ]) {
    byId[id].license = "CC0";
    byId[id].attribution =
      "Original console/arcade-inspired boot (in-repo synth, CC0) — not a licensed manufacturer jingle";
    byId[id].path = `res://assets/audio/${id}.wav`;
    console.log(id, probe(path.join(AUDIO, id + ".wav")).toFixed(2) + "s");
  }
  rmOther("arcade_notify", "wav");

  // --- Modem dial-up ---
  {
    const url = await fsPreview(454651);
    const raw = path.join(TMP, "modem.mp3");
    await download(url, raw);
    const out = path.join(AUDIO, "modem_dial.wav");
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
    const artPath = "res://assets/art/sounds/modem_dial.png";
    if (!fs.existsSync(path.join(ROOT, "assets", "art", "sounds", "modem_dial.png"))) {
      throw new Error("modem_dial.png missing — generate art first");
    }
    const entry = {
      id: "modem_dial",
      name: "Dial-Up Modem",
      category: "Retro",
      tier: "plus",
      mode: "oneshot",
      path: "res://assets/audio/modem_dial.wav",
      art: artPath,
      animation: "spin_teal",
      default_duration_sec: 0,
      license: "CC0",
      attribution: "14k modem dial-up connecting (Freesound #454651 by G_M_D_THREE, CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    };
    if (byId.modem_dial) {
      Object.assign(byId.modem_dial, entry);
    } else {
      // Insert after cassette_deck in Retro block
      const idx = catalog.sounds.findIndex((s) => s.id === "cassette_deck");
      catalog.sounds.splice(idx >= 0 ? idx + 1 : catalog.sounds.length, 0, entry);
    }
    console.log("modem_dial", probe(out).toFixed(2) + "s", "max", maxVol(out));
    notes.push({ id: "modem_dial", freesound: 454651 });
  }

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  // CSV
  if (fs.existsSync(CSV)) {
    let csv = fs.readFileSync(CSV, "utf8");
    if (!csv.includes("modem_dial")) {
      csv = csv.trimEnd() + `\nmodem_dial,"Dial-Up Modem",modem_dial.wav,modem_dial.png,plus,Retro\n`;
    }
    fs.writeFileSync(CSV, csv);
  }

  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch (_) {
    manifest = [];
  }
  if (!Array.isArray(manifest)) manifest = [];
  const touch = new Set(notes.map((n) => n.id));
  for (const id of [
    "arcade_boot_jingle",
    "arcade_notify",
    "disc_console_boot",
    "handheld_boot",
    "home_console_boot",
  ])
    touch.add(id);
  manifest = manifest.filter((e) => !touch.has(e.id));
  for (const n of notes) manifest.push(n);
  manifest.push(
    { id: "arcade_boot_jingle", source: "generated_inspired", note: "arcade CRT+attract mimic" },
    { id: "arcade_notify", source: "generated_inspired", note: "arcade chime mimic" },
    { id: "disc_console_boot", source: "generated_inspired", note: "disc-console boot mimic" },
    { id: "handheld_boot", source: "generated_inspired", note: "handheld boot mimic" },
    { id: "home_console_boot", source: "generated_inspired", note: "16-bit home boot mimic" }
  );
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  fs.writeFileSync(
    QA,
    `# StimPad Sound QA Tracker

Last updated: 2026-08-07 (afternoon)

**Resume bookmark: Dial-Up Modem** — new sound; listen & confirm, then continue remaining catalog.

## Notes on console boots

Real Nintendo / Sony / Sega startup jingles are copyrighted — we cannot ship them.
What we ship instead: **original mimics** that keep the *feel* (square handheld blips, soft 16-bit power bong, disc whoosh + logo swell, arcade CRT + attract) with **different melodies**.

## This pass

| Sound | Status | Notes |
|---|---|---|
| Electric Drill | **FIXED (needs listen)** | Held-trigger acrossfade loop ~40s from BSB #0791 |
| Cassette Deck | **FIXED (needs listen)** | Insert (BSB #0571) + rewind (BSB #0566) |
| PC Power On | **FIXED (needs listen)** | Real mid-90s desktop boot FS #52050 |
| Disc Tray Open | **FIXED (needs listen)** | Real CD/DVD eject FS #812507 |
| Hard Drive Boot Hum | **FIXED (needs listen)** | Clean studio PC fan loop BSB #0125 |
| Arcade / Disc / Handheld / Home boots | **FIXED (needs listen)** | Closer inspired mimics (still original) |
| Dial-Up Modem | **NEW (needs listen)** | FS #454651 classic 14k handshake + new art |

Chainsaw / Construction / Arcade game over — previously OK.
`
  );

  console.log("Done. Catalog sounds:", catalog.sounds.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
