/**
 * Round 4: clean tray, real PC case fan, synthesized clean modem,
 * closer CC0 console/arcade boot mimics from homebrew packs + improved synth.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_r4");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
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

async function fsUrl(id) {
  const html = await get("https://freesound.org/s/" + id + "/");
  const m = html.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  if (!m) throw new Error("no preview " + id);
  return `https://cdn.freesound.org/previews/${Math.floor(Number(id) / 1000)}/${m[1]}-hq.mp3`;
}

async function fsLic(id) {
  const html = await get("https://freesound.org/s/" + id + "/");
  if (/Creative Commons 0|CC0/i.test(html)) return "CC0";
  if (/Attribution/i.test(html)) return "CC BY";
  return "?";
}

function rmOther(id, keep) {
  for (const ext of ["mp3", "ogg", "wav"]) {
    if (ext === keep) continue;
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
  if (t < a) return t / Math.max(a, 1e-9);
  if (t < a + d) return 1 - (1 - s) * ((t - a) / Math.max(d, 1e-9));
  if (t < dur - r) return s;
  if (t < dur) return s * (1 - (t - (dur - r)) / Math.max(r, 1e-9));
  return 0;
}

function osc(type, phase) {
  const x = ((phase % 1) + 1) % 1;
  if (type === "square") return x < 0.5 ? 1 : -1;
  if (type === "pulse") return x < 0.25 ? 1 : -1;
  if (type === "triangle") return 1 - 4 * Math.abs(x - 0.5);
  return Math.sin(2 * Math.PI * x);
}

function synth(dur, fn) {
  const n = Math.floor(dur * SR);
  const s = new Float64Array(n);
  fn(s);
  let peak = 0.001;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(s[i]));
  return Array.from(s, (v) => (v / peak) * 0.75);
}

function acrossfadeLoop(seg, dest, n, fade) {
  const inputs = [];
  for (let i = 0; i < n; i++) inputs.push("-i", seg);
  let filter = "";
  let cur = "[0:a]";
  for (let i = 1; i < n; i++) {
    const out = i === n - 1 ? "[out]" : `[a${i}]`;
    filter += `${cur}[${i}:a]acrossfade=d=${fade}:c1=tri:c2=tri${out};`;
    cur = `[a${i}]`;
  }
  run([...inputs, "-filter_complex", filter.replace(/;$/, ""), "-map", "[out]", dest]);
}

/** Crystal-clear dial-up handshake synthesized (no room mic). */
function synthModem() {
  // Classic structure: dial tone → DTMF → answer → negotiation snow
  const digits = [5, 5, 5, 1, 2, 3, 4]; // fake number
  const dtmf = {
    0: [941, 1336],
    1: [697, 1209],
    2: [697, 1336],
    3: [697, 1477],
    4: [770, 1209],
    5: [770, 1336],
    6: [770, 1477],
    7: [852, 1209],
    8: [852, 1336],
    9: [852, 1477],
  };
  return synth(28, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      // dial tone ~1.2s
      if (t < 1.15) {
        s[i] +=
          (Math.sin(2 * Math.PI * 350 * t) + Math.sin(2 * Math.PI * 440 * t)) *
          0.22 *
          env(t, 0.02, 0.05, 1, 0.08, 1.15);
      }
      // DTMF
      let t0 = 1.25;
      for (const d of digits) {
        const [f1, f2] = dtmf[d];
        const lt = t - t0;
        if (lt >= 0 && lt < 0.12) {
          s[i] +=
            (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)) *
            0.28 *
            env(lt, 0.005, 0.02, 0.9, 0.03, 0.12);
        }
        t0 += 0.2;
      }
      // pause then answer tone 2100
      if (t > 3.0 && t < 4.2) {
        const lt = t - 3.0;
        s[i] += Math.sin(2 * Math.PI * 2100 * t) * 0.3 * env(lt, 0.01, 0.05, 0.85, 0.15, 1.2);
      }
      // V.8-ish negotiation: warbling tones then scrambled carrier
      if (t > 4.4 && t < 7.5) {
        const lt = t - 4.4;
        const f = 1200 + 400 * Math.sin(2 * Math.PI * 2.5 * t) + 200 * Math.sin(2 * Math.PI * 7 * t);
        s[i] += Math.sin(2 * Math.PI * f * t) * 0.22 * env(lt, 0.05, 0.2, 0.8, 0.3, 3.1);
        s[i] += Math.sin(2 * Math.PI * (f * 1.5) * t) * 0.08;
      }
      // classic "snow" handshake: band-limited noise with pitch drops
      if (t > 7.2 && t < 26) {
        const u = (t - 7.2) / 18.8;
        const center = 1800 - u * 900 + 120 * Math.sin(2 * Math.PI * 0.35 * t);
        // cheap band noise via shaped white
        const n = Math.random() * 2 - 1;
        const shaped = n * (0.35 + 0.25 * Math.sin(2 * Math.PI * center * 0.001 * t));
        s[i] += shaped * (0.18 + 0.12 * Math.sin(2 * Math.PI * 3 * t));
        // sparse carrier beeps
        if (Math.sin(2 * Math.PI * 18 * t) > 0.92) {
          s[i] += Math.sin(2 * Math.PI * (900 + u * 400) * t) * 0.12;
        }
      }
      // settle / connect silence fade
      if (t > 25.5) {
        s[i] *= Math.max(0, 1 - (t - 25.5) / 2.5);
      }
    }
  });
}

/** Closer arcade attract (CRT + short 5-note jingle). */
function synthArcadeBoot() {
  return synth(3.0, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 0.07) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.07) * 0.65;
      if (t > 0.05 && t < 0.85) {
        const u = (t - 0.05) / 0.8;
        s[i] += Math.sin(2 * Math.PI * (90 + u * u * 3200) * t) * (1 - u) * 0.28;
      }
      // Memorable but original attract
      const notes = [
        [0.9, 392],
        [1.05, 494],
        [1.2, 587],
        [1.4, 784],
        [1.7, 988],
        [2.15, 1175],
      ];
      for (const [st, f] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < 0.22)
          s[i] += osc("pulse", f * t) * env(lt, 0.004, 0.04, 0.5, 0.1, 0.22) * 0.32;
      }
    }
  });
}

function synthArcadeChime() {
  return synth(1.35, (s) => {
    const notes = [
      [0, 784, 0.13],
      [0.13, 988, 0.13],
      [0.3, 1319, 0.7],
    ];
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      for (const [st, f, dur] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < dur)
          s[i] +=
            osc("pulse", f * t) * env(lt, 0.003, 0.05, 0.4, 0.35, dur) * 0.34 +
            Math.sin(2 * Math.PI * f * 2 * t) * env(lt, 0.003, 0.05, 0.15, 0.35, dur) * 0.1;
      }
    }
  });
}

/** Disc console: whoosh + two logo hits (PS-era feel, original notes). */
function synthDiscBoot() {
  return synth(3.4, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 1.5) {
        const u = t / 1.5;
        s[i] += (Math.random() * 2 - 1) * (0.06 + 0.14 * u) * (1 - u * 0.4);
        s[i] += Math.sin(2 * Math.PI * (70 + u * 500) * t) * u * (1 - u) * 0.4;
      }
      const hits = [
        [1.2, [185, 233, 311], 1.15],
        [1.95, [233, 311, 370], 1.25],
      ];
      for (const [st, freqs, dur] of hits) {
        const lt = t - st;
        if (lt >= 0 && lt < dur)
          for (const f of freqs)
            s[i] += Math.sin(2 * Math.PI * f * t) * env(lt, 0.1, 0.3, 0.5, 0.6, dur) * 0.24;
      }
    }
  });
}

/** Handheld: GB/GBA-ish power blips then held (original). */
function synthHandheldBoot() {
  return synth(2.3, (s) => {
    const notes = [
      [0.06, 392, 0.1],
      [0.18, 523, 0.1],
      [0.3, 659, 0.12],
      [0.48, 784, 1.4],
    ];
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 0.025) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.025) * 0.25;
      for (const [st, f, dur] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          const vib = 1 + 0.0025 * Math.sin(2 * Math.PI * 6 * t);
          s[i] += osc("pulse", f * vib * t) * env(lt, 0.003, 0.05, 0.55, 0.4, dur) * 0.36;
        }
      }
    }
  });
}

/** Home: soft 16-bit power bong (SNES-era feel, original). */
function synthHomeBoot() {
  return synth(2.5, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 0.04) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.04) * 0.28;
      const drop = t < 0.35 ? 1 + (0.35 - t) * 0.1 : 1;
      for (const [f, amp] of [
        [165, 0.38],
        [208, 0.3],
        [262, 0.22],
        [330, 0.12],
      ]) {
        s[i] +=
          Math.sin(2 * Math.PI * f * drop * t) * env(t, 0.02, 0.28, 0.4, 1.5, 2.45) * amp;
      }
    }
  });
}

/**
 * Sega-inspired vocaloid-free shout: formant-ish "SEH-GAH" using noise+tone,
 * deliberately NOT the trademarked pitch contour — short brand-like hit then chord.
 * Safer: descending 4-note Genesis-ish fanfare without vocal.
 */
function synthSegaStyleBoot() {
  // Used for home_console if we want Genesis flavor — but home art is SNES-like.
  // Keep as optional arcade alt; for now strengthen home with extra sparkle only.
  return synthHomeBoot();
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const byId = Object.fromEntries(catalog.sounds.map((s) => [s.id, s]));

  // --- Disc tray: Zabuhailo Asus tray open (CC0), first open only, denoise ---
  {
    const raw = path.join(TMP, "tray146.mp3");
    await download(await fsUrl(146958), raw);
    const out = path.join(AUDIO, "unlock_chime.wav");
    // First open ~0–2.2s before close (file: open+close CD then DVD)
    run([
      "-i",
      raw,
      "-t",
      "2.1",
      "-af",
      "highpass=f=100,afftdn=nr=14:nf=-28,loudnorm=I=-13:TP=-1:LRA=9",
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
      attribution: "Asus CD tray open (Freesound #146958 by Zabuhailo, CC0)",
    });
    console.log("disc tray", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- PC Fan Hum: close-mic case fan seamless loop (seth-m #269744) ---
  {
    const lic = await fsLic(269744);
    console.log("fan269744 license", lic);
    let fanId = 269744;
    let licUse = lic;
    if (lic !== "CC0") {
      // fallback earthsounds
      fanId = 101397;
      licUse = await fsLic(101397);
      console.log("fan101397 license", licUse);
    }
    const raw = path.join(TMP, "fan.mp3");
    await download(await fsUrl(fanId), raw);
    const seg = path.join(TMP, "fan_seg.wav");
    run([
      "-i",
      raw,
      "-af",
      "highpass=f=50,lowpass=f=8000,loudnorm=I=-18:TP=-2.5:LRA=5",
      "-ac",
      "1",
      "-ar",
      "44100",
      seg,
    ]);
    const out = path.join(AUDIO, "os_loading_hum.wav");
    const n = fanId === 269744 ? 10 : 4;
    acrossfadeLoop(seg, out, n, fanId === 269744 ? 0.15 : 0.5);
    rmOther("os_loading_hum", "wav");
    Object.assign(byId.os_loading_hum, {
      name: "PC Fan Hum",
      path: "res://assets/audio/os_loading_hum.wav",
      mode: "loop",
      default_duration_sec: 60,
      license: licUse === "CC0" ? "CC0" : licUse,
      attribution:
        fanId === 269744
          ? "Computer case exhaust fan @1000RPM close-mic (Freesound #269744 by seth-m, " +
            licUse +
            ")"
          : "PC computer fans (Freesound #101397 by earthsounds, " + licUse + ")",
    });
    console.log("pc fan", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- Modem: synthesized clean handshake (no room noise) ---
  {
    const out = path.join(AUDIO, "modem_dial.wav");
    writeWav(out, synthModem());
    // light loudnorm
    const tmpOut = path.join(TMP, "modem_ln.wav");
    run(["-i", out, "-af", "loudnorm=I=-14:TP=-1.2:LRA=8", "-ac", "1", "-ar", "44100", tmpOut]);
    fs.copyFileSync(tmpOut, out);
    rmOther("modem_dial", "wav");
    if (byId.modem_dial) {
      Object.assign(byId.modem_dial, {
        name: "Dial-Up Modem",
        path: "res://assets/audio/modem_dial.wav",
        license: "CC0",
        attribution:
          "Synthesized classic dial-up handshake (dial tone, DTMF, answer, negotiation) — clean, no room mic (CC0)",
      });
    }
    console.log("modem", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- Closer console/arcade inspired boots ---
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
    byId[id].path = `res://assets/audio/${id}.wav`;
    byId[id].license = "CC0";
    byId[id].attribution =
      "Original console/arcade-inspired boot (StimPad synth, CC0) — not an official manufacturer jingle";
    console.log(id, probe(path.join(AUDIO, id + ".wav")).toFixed(2) + "s");
  }
  rmOther("arcade_notify", "wav");

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
  if (fs.existsSync(CSV)) {
    let csv = fs.readFileSync(CSV, "utf8");
    csv = csv.replace(/os_loading_hum,"[^"]+"/, 'os_loading_hum,"PC Fan Hum"');
    fs.writeFileSync(CSV, csv);
  }

  fs.writeFileSync(
    QA,
    `# StimPad Sound QA Tracker

Last updated: 2026-08-07 (late)

**Resume bookmark: Disc Tray / PC Fan / Modem / console boots** — re-listen this round.

## Console boots policy
Shipping real Nintendo/Sony/Sega jingles is not allowed.
Current boots are original inspired mimics (structure/timbre, different melodies).
Next option if still weak: pull CC0 homebrew jingles (Beatscribe / itch GB packs) that are purpose-built mimics.

## This round
- Disc Tray Open → Asus CD tray open FS #146958 (denoised)
- PC Fan Hum → close-mic case fan FS #269744 (or fallback)
- Dial-Up Modem → clean synthesized handshake (no room noise)
- Console/arcade boots → tighter inspired synths
`
  );

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
