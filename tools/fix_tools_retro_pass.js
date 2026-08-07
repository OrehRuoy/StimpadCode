/**
 * Tools + Retro SFX fix pass (verified sources + original console mimics).
 *
 * Chainsaw: Mixkit #796 was literally "chainsaw + axe hits" → BSB #0983 Stihl using
 * Construction: rename only
 * Drill: short Mixkit → BSB #0791 corded drill ~82s
 * Cassette: Mixkit short → BSB #0565 Cassette Player Play
 * Unlock: was game UI chime; art = tray open → Freesound CD tray CC0
 * Device power: art = PC tower → PC Power On (POST beep + fan)
 * OS loading: empty sci-fi → Hard Drive Boot Hum (NAS HDD spin, BSB #1622)
 * Arcade / disc / handheld / home boots: original synths (legal mimics, not real jingles)
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_tools_retro");
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
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur - r) return s;
  if (t < dur) return s * (1 - (t - (dur - r)) / r);
  return 0;
}

function osc(type, phase) {
  const x = phase % 1;
  if (type === "square") return x < 0.5 ? 1 : -1;
  if (type === "triangle") return 1 - 4 * Math.abs(x - 0.5);
  if (type === "saw") return 2 * x - 1;
  return Math.sin(2 * Math.PI * x);
}

function synth(duration, render) {
  const n = Math.floor(duration * SR);
  const samples = new Float64Array(n);
  render(samples);
  let peak = 0.001;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = (samples[i] / peak) * 0.72;
  return out;
}

/** Arcade cabinet power-on: relay + CRT whine + attract beeps (original). */
function synthArcadeBoot() {
  return synth(2.4, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      // relay / power click
      if (t < 0.05) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.05) * 0.55;
      // CRT-ish rising whine
      if (t > 0.04 && t < 0.55) {
        const u = (t - 0.04) / 0.51;
        const f = 180 + u * u * 2200;
        s[i] += Math.sin(2 * Math.PI * f * t) * (1 - u) * 0.22;
        s[i] += (Math.random() * 2 - 1) * (1 - u) * 0.04;
      }
      // attract-mode square beeps (original intervals, not a licensed jingle)
      const notes = [
        [0.6, 392],
        [0.85, 523.25],
        [1.1, 659.25],
        [1.4, 784],
      ];
      for (const [st, f] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < 0.18) {
          s[i] +=
            osc("square", f * t) * env(lt, 0.005, 0.03, 0.55, 0.08, 0.18) * 0.28;
        }
      }
      if (t > 1.7 && t < 2.2) {
        const lt = t - 1.7;
        s[i] += osc("square", 988 * t) * env(lt, 0.01, 0.05, 0.4, 0.25, 0.5) * 0.22;
      }
    }
  });
}

/** Short arcade attract / coin-accept style chime (original). */
function synthArcadeChime() {
  return synth(1.15, (s) => {
    const notes = [
      [0.0, 880, 0.12],
      [0.12, 1174.66, 0.12],
      [0.28, 1567.98, 0.45],
    ];
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      for (const [st, f, dur] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          s[i] +=
            osc("square", f * t) * env(lt, 0.004, 0.04, 0.45, 0.2, dur) * 0.3;
          s[i] +=
            osc("triangle", f * 2 * t) * env(lt, 0.004, 0.04, 0.3, 0.2, dur) * 0.12;
        }
      }
    }
  });
}

/** Disc console boot — PS-era vibe, original notes (not Sony). */
function synthDiscBoot() {
  return synth(2.6, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      // soft disc-motor whir
      if (t < 1.2) {
        s[i] += Math.sin(2 * Math.PI * (90 + t * 40) * t) * (1 - t / 1.2) * 0.08;
        s[i] += (Math.random() * 2 - 1) * 0.015 * (1 - t / 1.2);
      }
      // deep two-tone swell (original)
      const tones = [
        [0.35, 220, 1.6],
        [0.55, 329.63, 1.5],
        [0.9, 440, 1.2],
      ];
      for (const [st, f, dur] of tones) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          s[i] +=
            Math.sin(2 * Math.PI * f * t) * env(lt, 0.12, 0.35, 0.55, 0.55, dur) * 0.28;
        }
      }
      // airy sparkle
      if (t > 1.5 && t < 2.4) {
        const lt = t - 1.5;
        s[i] +=
          osc("triangle", 880 * t) * env(lt, 0.02, 0.1, 0.25, 0.5, 0.9) * 0.12;
      }
    }
  });
}

/** Handheld boot — Game Boy-ish square fanfare, original pitches (not Nintendo). */
function synthHandheldBoot() {
  return synth(1.8, (s) => {
    // Distinct from Nintendo logo: minor-ish rising square blips then held fifth
    const notes = [
      [0.05, 466.16, 0.14],
      [0.22, 554.37, 0.14],
      [0.4, 698.46, 0.16],
      [0.62, 932.33, 0.85],
    ];
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      for (const [st, f, dur] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 6 * t);
          s[i] +=
            osc("square", f * vib * t) * env(lt, 0.004, 0.05, 0.5, 0.25, dur) * 0.32;
        }
      }
    }
  });
}

/** Home console boot — SNES-era soft power bong, original (not Nintendo). */
function synthHomeBoot() {
  return synth(2.0, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 0.04) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.04) * 0.25;
      // warm power chord (original voicing)
      const chord = [
        [0.05, 174.61, 1.5],
        [0.05, 220.0, 1.5],
        [0.08, 261.63, 1.55],
        [0.35, 349.23, 1.2],
      ];
      for (const [st, f, dur] of chord) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          s[i] +=
            Math.sin(2 * Math.PI * f * t) * env(lt, 0.02, 0.2, 0.45, 0.7, dur) * 0.26;
          s[i] +=
            osc("triangle", f * 2 * t) * env(lt, 0.02, 0.2, 0.2, 0.7, dur) * 0.08;
        }
      }
    }
  });
}

/** PC power-on: click + classic single POST beep (generic, not a branded chime). */
function synthPcPowerBeep() {
  return synth(0.55, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 0.03) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.03) * 0.4;
      if (t > 0.05 && t < 0.28) {
        const lt = t - 0.05;
        s[i] += Math.sin(2 * Math.PI * 1000 * t) * env(lt, 0.002, 0.02, 0.7, 0.05, 0.23) * 0.55;
      }
    }
  });
}

function processBed(src, dest, af) {
  run(["-i", src, "-af", af, "-ac", "1", "-ar", "44100", dest]);
}

function rmSiblings(id) {
  for (const ext of ["mp3", "ogg", "wav"]) {
    // keep the extension we just wrote — handled by caller
  }
  for (const ext of ["mp3", "ogg"]) {
    const p = path.join(AUDIO, `${id}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

async function resolveFreesoundPreview(soundId) {
  const html = await get(`https://freesound.org/s/${soundId}/`);
  const m = html.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  if (!m) throw new Error("No preview for FS " + soundId);
  const stem = m[1];
  const folder = String(soundId).padStart(3, "0").slice(0, 3);
  // Freesound uses first 3 digits of sound id for folder
  const folder2 = stem.split("_")[0].slice(0, 3);
  return `https://cdn.freesound.org/previews/${folder2}/${stem}-hq.mp3`;
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const byId = Object.fromEntries(catalog.sounds.map((s) => [s.id, s]));
  const manifestEntries = [];

  // --- Chainsaw ---
  {
    const id = "chainsaw";
    const raw = path.join(TMP, "bsb0983.mp3");
    const cached = path.join(AUDIO, "_tmp_tools_arcade", "bsb0983.mp3");
    if (fs.existsSync(cached)) fs.copyFileSync(cached, raw);
    else await download("https://bigsoundbank.com/UPLOAD/mp3/0983.mp3", raw);
    const out = path.join(AUDIO, "chainsaw.wav");
    processBed(raw, out, "loudnorm=I=-16:TP=-1.5:LRA=11");
    rmSiblings(id);
    Object.assign(byId[id], {
      name: "Chainsaw",
      path: "res://assets/audio/chainsaw.wav",
      license: "CC0",
      attribution: "Chainsaw, Using — Stihl MS260 (BigSoundBank #0983, CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    });
    manifestEntries.push({
      id,
      source: "bigsoundbank",
      bsb_id: "0983",
      title: "Chainsaw, Using",
    });
    console.log(id, probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- Construction rename only ---
  {
    const id = "construction_site";
    byId[id].name = "Construction Site";
    console.log(id, "renamed only");
  }

  // --- Electric drill ---
  {
    const id = "electric_drill";
    const raw = path.join(TMP, "bsb0791.mp3");
    const cached = path.join(AUDIO, "_tmp_tools_arcade", "bsb0791.mp3");
    if (fs.existsSync(cached)) fs.copyFileSync(cached, raw);
    else await download("https://bigsoundbank.com/UPLOAD/mp3/0791.mp3", raw);
    const out = path.join(AUDIO, "electric_drill.wav");
    processBed(raw, out, "loudnorm=I=-16:TP=-1.5:LRA=11");
    rmSiblings(id);
    Object.assign(byId[id], {
      name: "Electric Drill",
      path: "res://assets/audio/electric_drill.wav",
      license: "CC0",
      attribution: "Corded drill drilling into wood (BigSoundBank #0791, CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    });
    manifestEntries.push({
      id,
      source: "bigsoundbank",
      bsb_id: "0791",
      title: "Drill",
    });
    console.log(id, probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- Arcade boot + chime (original synth) ---
  {
    const boot = path.join(AUDIO, "arcade_boot_jingle.wav");
    writeWav(boot, synthArcadeBoot());
    Object.assign(byId.arcade_boot_jingle, {
      name: "Arcade Cabinet Boot",
      path: "res://assets/audio/arcade_boot_jingle.wav",
      license: "CC0",
      attribution: "Original arcade power-on / attract mimic (in-repo synth, CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    });
    console.log("arcade_boot", probe(boot).toFixed(2) + "s");

    const chime = path.join(AUDIO, "arcade_notify.wav");
    writeWav(chime, synthArcadeChime());
    rmSiblings("arcade_notify");
    Object.assign(byId.arcade_notify, {
      name: "Arcade Cabinet Chime",
      path: "res://assets/audio/arcade_notify.wav",
      license: "CC0",
      attribution: "Original arcade attract chime (in-repo synth, CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    });
    console.log("arcade_chime", probe(chime).toFixed(2) + "s");
  }

  // arcade_game_over left alone
  console.log("arcade_game_over left OK");

  // --- Cassette ---
  {
    const id = "cassette_deck";
    const raw = path.join(TMP, "bsb0565.mp3");
    await download("https://bigsoundbank.com/UPLOAD/mp3/0565.mp3", raw);
    const out = path.join(AUDIO, "cassette_deck.wav");
    // Take first play/stop cycle (~half of 27s file has twice) — keep ~6s of mechanism
    run([
      "-i",
      raw,
      "-t",
      "6.5",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    rmSiblings(id);
    Object.assign(byId[id], {
      name: "Cassette Deck",
      path: "res://assets/audio/cassette_deck.wav",
      license: "CC0",
      attribution: "Cassette Player: Play (BigSoundBank #0565, CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    });
    manifestEntries.push({
      id,
      source: "bigsoundbank",
      bsb_id: "0565",
      title: "Cassette Player: Play",
    });
    console.log(id, probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- PC Power On (art = beige tower) ---
  {
    const id = "ui_boot_start";
    const beepPath = path.join(TMP, "post_beep.wav");
    writeWav(beepPath, synthPcPowerBeep());
    const fanRaw = path.join(TMP, "bsb0125.mp3");
    await download("https://bigsoundbank.com/UPLOAD/mp3/0125.mp3", fanRaw);
    const fanCut = path.join(TMP, "fan_cut.wav");
    run([
      "-i",
      fanRaw,
      "-t",
      "2.2",
      "-af",
      "afade=t=in:st=0:d=0.15,afade=t=out:st=1.7:d=0.45,volume=0.55",
      "-ac",
      "1",
      "-ar",
      "44100",
      fanCut,
    ]);
    const out = path.join(AUDIO, "ui_boot_start.wav");
    run([
      "-i",
      beepPath,
      "-i",
      fanCut,
      "-filter_complex",
      "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=8",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    rmSiblings(id);
    Object.assign(byId[id], {
      name: "PC Power On",
      path: "res://assets/audio/ui_boot_start.wav",
      license: "CC0",
      attribution:
        "Original POST beep + Computer 1 Ventilation (BigSoundBank #0125, CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    });
    console.log(id, "→ PC Power On", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- Disc console boot mimic ---
  {
    const out = path.join(AUDIO, "disc_console_boot.wav");
    writeWav(out, synthDiscBoot());
    Object.assign(byId.disc_console_boot, {
      name: "Disc Console Startup",
      path: "res://assets/audio/disc_console_boot.wav",
      license: "CC0",
      attribution: "Original disc-console boot mimic (in-repo synth, CC0) — not a licensed console jingle",
    });
    console.log("disc_console_boot", probe(out).toFixed(2) + "s");
  }

  // --- Disc tray open (was Disc Console Unlock / unlock_chime) ---
  {
    const id = "unlock_chime";
    const page = await get("https://freesound.org/people/jpkweli/sounds/154754/");
    if (!/Creative Commons 0|CC0/.test(page) && !/cc0/i.test(page)) {
      console.warn("FS154754 license text unclear — proceeding from catalog CC0 listing");
    }
    const prev = page.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
    if (!prev) throw new Error("No freesound preview for tray");
    const stem = prev[1];
    const folder = stem.slice(0, 3);
    const raw = path.join(TMP, "tray.mp3");
    await download(`https://cdn.freesound.org/previews/${folder}/${stem}-hq.mp3`, raw);
    const out = path.join(AUDIO, "unlock_chime.wav");
    // Keep opening motion (~first 4s of tray eject)
    run([
      "-i",
      raw,
      "-t",
      "4.0",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    rmSiblings(id);
    Object.assign(byId[id], {
      name: "Disc Tray Open",
      path: "res://assets/audio/unlock_chime.wav",
      license: "CC0",
      attribution: "CD Player Tray Ejecting (Freesound #154754 by jpkweli, CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    });
    manifestEntries.push({
      id,
      source: "freesound",
      freesound_id: "154754",
      title: "CD Player Tray Ejecting",
      note: "Renamed from Disc Console Unlock — matches tray art",
    });
    console.log(id, "→ Disc Tray Open", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- Handheld Game Boy-ish mimic ---
  {
    const out = path.join(AUDIO, "handheld_boot.wav");
    writeWav(out, synthHandheldBoot());
    Object.assign(byId.handheld_boot, {
      name: "Handheld Console Boot",
      path: "res://assets/audio/handheld_boot.wav",
      license: "CC0",
      attribution: "Original handheld boot mimic (in-repo synth, CC0) — not a Nintendo jingle",
    });
    console.log("handheld_boot", probe(out).toFixed(2) + "s");
  }

  // --- Home SNES-ish mimic ---
  {
    const out = path.join(AUDIO, "home_console_boot.wav");
    writeWav(out, synthHomeBoot());
    Object.assign(byId.home_console_boot, {
      name: "Home Console Startup",
      path: "res://assets/audio/home_console_boot.wav",
      license: "CC0",
      attribution: "Original 16-bit home-console boot mimic (in-repo synth, CC0) — not a Nintendo jingle",
    });
    console.log("home_console_boot", probe(out).toFixed(2) + "s");
  }

  // --- Hard drive boot hum (was empty sci-fi OS hum) ---
  {
    const id = "os_loading_hum";
    const raw = path.join(TMP, "bsb1622.mp3");
    await download("https://bigsoundbank.com/UPLOAD/mp3/1622.mp3", raw);
    const out = path.join(AUDIO, "os_loading_hum.wav");
    // Skip initial silence-ish, keep ~45s of drives spinning for loop
    run([
      "-ss",
      "8",
      "-i",
      raw,
      "-t",
      "45",
      "-af",
      "loudnorm=I=-18:TP=-2:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    rmSiblings(id);
    Object.assign(byId[id], {
      name: "Hard Drive Boot Hum",
      path: "res://assets/audio/os_loading_hum.wav",
      mode: "loop",
      default_duration_sec: 60,
      license: "CC0",
      attribution:
        "NAS starting — HDD spin / fans while booting (BigSoundBank #1622, CC0)",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    });
    manifestEntries.push({
      id,
      source: "bigsoundbank",
      bsb_id: "1622",
      title: "NAS, starting",
      note: "Renamed Hard Drive Boot Hum — spinning disks/fans during boot",
    });
    console.log(id, "→ Hard Drive Boot Hum", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  // CSV name/path updates
  if (fs.existsSync(CSV)) {
    let csv = fs.readFileSync(CSV, "utf8");
    const reps = [
      [/chainsaw,"Chainsaw Cutting",chainsaw\.mp3/, 'chainsaw,"Chainsaw",chainsaw.wav'],
      [
        /construction_site,"Construction Site Ambience",construction_site\.mp3/,
        'construction_site,"Construction Site",construction_site.mp3',
      ],
      [
        /electric_drill,"Electric Drill Whirr",electric_drill\.mp3/,
        'electric_drill,"Electric Drill",electric_drill.wav',
      ],
      [
        /arcade_notify,"Arcade Cabinet Chime",arcade_notify\.mp3/,
        'arcade_notify,"Arcade Cabinet Chime",arcade_notify.wav',
      ],
      [
        /cassette_deck,"Cassette Deck Play",cassette_deck\.mp3/,
        'cassette_deck,"Cassette Deck",cassette_deck.wav',
      ],
      [
        /ui_boot_start,"Device Power-On UI",ui_boot_start\.mp3/,
        'ui_boot_start,"PC Power On",ui_boot_start.wav',
      ],
      [
        /unlock_chime,"Disc Console Unlock",unlock_chime\.mp3/,
        'unlock_chime,"Disc Tray Open",unlock_chime.wav',
      ],
      [
        /os_loading_hum,"OS Boot Loading Hum",os_loading_hum\.mp3/,
        'os_loading_hum,"Hard Drive Boot Hum",os_loading_hum.wav',
      ],
    ];
    for (const [a, b] of reps) csv = csv.replace(a, b);
    fs.writeFileSync(CSV, csv);
  }

  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch (_) {
    manifest = [];
  }
  if (!Array.isArray(manifest)) manifest = [];
  const touch = new Set(manifestEntries.map((e) => e.id));
  touch.add("arcade_boot_jingle");
  touch.add("arcade_notify");
  touch.add("disc_console_boot");
  touch.add("handheld_boot");
  touch.add("home_console_boot");
  touch.add("construction_site");
  touch.add("ui_boot_start");
  manifest = manifest.filter((e) => !touch.has(e.id));
  for (const e of manifestEntries) manifest.push(e);
  manifest.push(
    { id: "arcade_boot_jingle", source: "generated", note: "original arcade boot mimic" },
    { id: "arcade_notify", source: "generated", note: "original arcade chime" },
    { id: "disc_console_boot", source: "generated", note: "original disc-console boot mimic" },
    { id: "handheld_boot", source: "generated", note: "original handheld boot mimic" },
    { id: "home_console_boot", source: "generated", note: "original 16-bit home boot mimic" },
    { id: "construction_site", note: "renamed only — audio unchanged" },
    { id: "ui_boot_start", source: "generated+bsb", note: "PC Power On POST+fan" }
  );
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  // QA tracker bookmark
  const qa = `# StimPad Sound QA Tracker

Last updated: 2026-08-07

**Resume bookmark: Hard Drive Boot Hum** (renamed from OS Boot Loading Hum) — listen & confirm, then continue remaining catalog.

Policy: verify Mixkit IDs against live category pages; prefer BSB/Freesound CC0; console boots must be **original mimics** (never real Nintendo/Sony/Sega jingles).

## Tools / Retro (2026-08-07)

| Sound | Status | Notes |
|---|---|---|
| Chainsaw | **FIXED (needs listen)** | Renamed; BSB #0983 Stihl using (was Mixkit axe+chainsaw). |
| Construction Site | **OK** | Renamed only. |
| Electric Drill | **FIXED (needs listen)** | Renamed; BSB #0791 ~82s. |
| Arcade Cabinet Boot | **FIXED (needs listen)** | Original power-on/attract synth. |
| Arcade Cabinet Chime | **FIXED (needs listen)** | Original attract chime synth. |
| Arcade Game-Over Tone | **OK** | Left alone. |
| Cassette Deck | **FIXED (needs listen)** | Renamed; BSB #0565 play/stop. |
| PC Power On | **FIXED (needs listen)** | Was Device Power-On UI; art=PC tower → POST beep + fan. |
| Disc Console Startup | **FIXED (needs listen)** | Original disc-console boot mimic (not Sony). |
| Disc Tray Open | **FIXED (needs listen)** | Was Disc Console Unlock; art=tray → Freesound #154754. |
| Handheld Console Boot | **FIXED (needs listen)** | Original Game Boy-ish mimic (not Nintendo). |
| Home Console Startup | **FIXED (needs listen)** | Original SNES-era soft bong (not Nintendo). |
| Hard Drive Boot Hum | **FIXED (needs listen)** | Was empty sci-fi OS hum → BSB #1622 NAS HDD spin. |

## Earlier OK

Dog Bark, Cat Meow, Cat Purr, Campfire, noises, crickets — OK (2026-08-06).
`;
  fs.writeFileSync(QA, qa);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
