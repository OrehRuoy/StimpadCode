/**
 * Misc + Retro QA:
 * - Clean longer paper crumple
 * - Clean rotary phone ring (no lead-in noise)
 * - Faster trimmed toy xylophone
 * - Arcade cabinet real power-on + Pac-Man-inspired chime (original notes)
 * - Stronger disc / handheld / home boot mimics (original, not copyrighted jingles)
 * - Mask rotary phone art corners
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const ART = path.join(ROOT, "assets", "art", "sounds");
const TMP = path.join(AUDIO, "_tmp_misc_retro");
const SOUNDS = path.join(ROOT, "data", "sounds.json");
const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");
const SR = 44100;
const BSB = (n) =>
  `https://bigsoundbank.com/UPLOAD/mp3/${String(n).padStart(4, "0")}.mp3`;
const BS_RAW = (p) =>
  `https://raw.githubusercontent.com/Beatscribe/homebrew_vgm/master/${p}`;

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
  if (/Attribution-NonCommercial|BY-NC/i.test(html)) throw new Error("BY-NC " + id);
  const m = html.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  if (!m) throw new Error("no preview " + id);
  return `https://cdn.freesound.org/previews/${Math.floor(Number(id) / 1000)}/${m[1]}-hq.mp3`;
}

function cleanOld(id) {
  for (const ext of ["mp3", "ogg"]) {
    const p = path.join(AUDIO, id + "." + ext);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    const imp = p + ".import";
    if (fs.existsSync(imp)) fs.unlinkSync(imp);
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
  if (type === "tri") return 1 - 4 * Math.abs(x - 0.5);
  return Math.sin(2 * Math.PI * x);
}

function synth(dur, fn) {
  const n = Math.floor(dur * SR);
  const s = new Float64Array(n);
  fn(s);
  let peak = 0.001;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(s[i]));
  return Array.from(s, (v) => (v / peak) * 0.78);
}

/** Arcade cabinet power: CRT thump + HF + short attract jingle (cabinet feel). */
function synthArcadeBoot() {
  return synth(3.4, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      // power relay / switch thump
      if (t < 0.06) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.06) * 0.85;
      // CRT coil/whine sweep
      if (t > 0.04 && t < 1.1) {
        const u = (t - 0.04) / 1.06;
        s[i] += Math.sin(2 * Math.PI * (120 + u * u * 9800) * t) * (1 - u) * 0.22;
        s[i] += (Math.random() * 2 - 1) * (1 - u) * 0.08;
      }
      // 15.7kHz-ish line whistle (sampled as high sine with jitter)
      if (t > 0.2 && t < 2.4) {
        const jit = 15700 + Math.sin(2 * Math.PI * 7 * t) * 40;
        s[i] += Math.sin(2 * Math.PI * jit * t) * 0.045 * Math.min(1, (t - 0.2) * 3);
      }
      // short attract melody after CRT settles
      const notes = [
        [1.35, 392],
        [1.5, 523],
        [1.65, 659],
        [1.85, 784],
        [2.15, 988],
        [2.55, 784],
      ];
      for (const [st, f] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < 0.28)
          s[i] +=
            osc("pulse", f * t) * env(lt, 0.004, 0.05, 0.45, 0.12, 0.28) * 0.3 +
            Math.sin(2 * Math.PI * f * 2 * t) * env(lt, 0.004, 0.05, 0.2, 0.12, 0.28) * 0.08;
      }
    }
  });
}

/** Pac-Man-inspired chomp / start jingle — original pitches, not the copyrighted theme. */
function synthPacChompChime() {
  return synth(1.55, (s) => {
    // Rapid alternating "waka" chirps then a bright fruit-like ding
    const wakas = [];
    for (let k = 0; k < 8; k++) {
      wakas.push([0.04 + k * 0.09, k % 2 === 0 ? 880 : 698, 0.07]);
    }
    const finish = [
      [0.8, 1047, 0.12],
      [0.95, 1319, 0.14],
      [1.12, 1568, 0.35],
    ];
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      for (const [st, f, dur] of [...wakas, ...finish]) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          s[i] +=
            osc("pulse", f * t) * env(lt, 0.002, 0.02, 0.35, 0.04, dur) * 0.38 +
            Math.sin(2 * Math.PI * f * 2 * t) * env(lt, 0.002, 0.02, 0.2, 0.04, dur) * 0.1;
        }
      }
    }
  });
}

/** Disc console: spin-up whoosh + dual logo chords (PS-era feel, original). */
function synthDiscBoot() {
  return synth(3.6, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      // disc spin-up air/noise
      if (t < 1.6) {
        const u = t / 1.6;
        s[i] += (Math.random() * 2 - 1) * (0.05 + 0.18 * u) * (1 - u * 0.35);
        s[i] += Math.sin(2 * Math.PI * (55 + u * u * 720) * t) * u * (1 - u) * 0.45;
      }
      // two stacked logo hits (not Sony's pitches)
      const hits = [
        [1.15, [196, 247, 311, 392], 1.2],
        [1.95, [247, 311, 370, 466], 1.4],
      ];
      for (const [st, freqs, dur] of hits) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          for (let fi = 0; fi < freqs.length; fi++) {
            const f = freqs[fi];
            s[i] +=
              Math.sin(2 * Math.PI * f * t) *
              env(lt, 0.08, 0.35, 0.45, 0.7, dur) *
              (0.28 - fi * 0.04);
          }
        }
      }
    }
  });
}

/** Handheld: GBA/GB power-on style — short rising chip tones then soft hold. */
function synthHandheldBoot() {
  return synth(2.0, (s) => {
    const notes = [
      [0.05, 523.25, 0.09],
      [0.16, 659.25, 0.09],
      [0.27, 783.99, 0.1],
      [0.42, 1046.5, 1.35],
    ];
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 0.02) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.02) * 0.2;
      for (const [st, f, dur] of notes) {
        const lt = t - st;
        if (lt >= 0 && lt < dur) {
          const vib = 1 + 0.0018 * Math.sin(2 * Math.PI * 5.5 * t);
          s[i] +=
            osc("pulse", f * vib * t) * env(lt, 0.004, 0.06, 0.5, 0.55, dur) * 0.34 +
            osc("tri", f * 0.5 * t) * env(lt, 0.004, 0.08, 0.3, 0.55, dur) * 0.12;
        }
      }
    }
  });
}

/** Home console: soft 16-bit SNES-era power chord (original pitches). */
function synthHomeBoot() {
  return synth(2.8, (s) => {
    for (let i = 0; i < s.length; i++) {
      const t = i / SR;
      if (t < 0.035) s[i] += (Math.random() * 2 - 1) * (1 - t / 0.035) * 0.22;
      // gentle pitch settle like CRT/console power
      const drop = t < 0.45 ? 1 + (0.45 - t) * 0.08 : 1;
      const partials = [
        [130.81, 0.42],
        [164.81, 0.34],
        [196.0, 0.26],
        [246.94, 0.18],
        [329.63, 0.1],
      ];
      for (const [f, amp] of partials) {
        s[i] +=
          Math.sin(2 * Math.PI * f * drop * t) * env(t, 0.025, 0.35, 0.42, 1.6, 2.7) * amp;
      }
      // soft sparkle on top
      if (t > 0.15 && t < 2.2) {
        s[i] +=
          Math.sin(2 * Math.PI * 523.25 * t) *
          env(t - 0.15, 0.02, 0.2, 0.2, 1.2, 2.0) *
          0.08;
      }
    }
  });
}

async function maskPhoneArt() {
  const file = path.join(ART, "old_phone_ring.png");
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const w = info.width;
  const h = info.height;
  const out = Buffer.from(data);
  const radius = Math.min(w, h) * 0.255;
  const feather = 4.5;
  const cx0 = radius;
  const cy0 = radius;
  const cx1 = w - 1 - radius;
  const cy1 = h - 1 - radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let edgeDist = 9999;
      let inside = true;
      if (x < cx0 && y < cy0) {
        const d = Math.hypot(x - cx0, y - cy0);
        inside = d <= radius;
        edgeDist = radius - d;
      } else if (x > cx1 && y < cy0) {
        const d = Math.hypot(x - cx1, y - cy0);
        inside = d <= radius;
        edgeDist = radius - d;
      } else if (x < cx0 && y > cy1) {
        const d = Math.hypot(x - cx0, y - cy1);
        inside = d <= radius;
        edgeDist = radius - d;
      } else if (x > cx1 && y > cy1) {
        const d = Math.hypot(x - cx1, y - cy1);
        inside = d <= radius;
        edgeDist = radius - d;
      } else if (x < cx0 || x > cx1 || y < cy0 || y > cy1) {
        // mid-edge: keep
      }
      // Outside rounded plate: clear
      if (x < cx0 && y < cy0 && !inside) out[i + 3] = 0;
      else if (x > cx1 && y < cy0 && !inside) out[i + 3] = 0;
      else if (x < cx0 && y > cy1 && !inside) out[i + 3] = 0;
      else if (x > cx1 && y > cy1 && !inside) out[i + 3] = 0;
      else if (edgeDist < feather && edgeDist >= 0) {
        out[i + 3] = Math.round(out[i + 3] * Math.max(0, edgeDist / feather));
      }
      // Kill leftover cyan/blue fringe near bottom outside subject (high blue, low lum)
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      if (out[i + 3] > 10 && b > r + 25 && b > g + 20 && (r + g + b) / 3 < 70 && y > h * 0.82) {
        // only clear if near outer bottom edge of plate (fringe), not intentional LEDs
        const distToPlateEdge = Math.min(x, w - 1 - x, h - 1 - y);
        if (distToPlateEdge < w * 0.04) out[i + 3] = 0;
      }
    }
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(file);
  console.log("phone art masked");
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS, "utf8"));
  const byId = Object.fromEntries(catalog.sounds.map((s) => [s.id, s]));

  // --- Paper: clean crunchy crumple + second take for length ---
  {
    const a = path.join(TMP, "paper_a.mp3");
    const b = path.join(TMP, "paper_b.mp3");
    await download(await fsPreview(447926), a);
    await download(await fsPreview(851248), b);
    const mid = path.join(TMP, "paper_mid.wav");
    run([
      "-i",
      a,
      "-i",
      b,
      "-filter_complex",
      "[0:a][1:a]concat=n=2:v=0:a=1[a]",
      "-map",
      "[a]",
      mid,
    ]);
    const out = path.join(AUDIO, "paper_crinkle.wav");
    run([
      "-i",
      mid,
      "-af",
      "highpass=f=120,lowpass=f=12000,loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:st=0:d=0.02,afade=t=out:st=17.5:d=0.5",
      "-t",
      "18",
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
      attribution:
        "Crunchy Paper (Freesound #447926 by Breviceps) + Crumpling Paper (#851248 by gettinsomegamesounds), CC0",
    });
    console.log("paper", probe(out).toFixed(2) + "s");
  }

  // --- Rotary phone: clean measured ring (no room lead-in) ---
  {
    const raw = path.join(TMP, "phone.mp3");
    await download(await fsPreview(556499), raw);
    const once = path.join(TMP, "phone_once.wav");
    run([
      "-i",
      raw,
      "-af",
      "highpass=f=250,loudnorm=I=-16:TP=-1.5:LRA=8",
      "-ac",
      "1",
      "-ar",
      "44100",
      once,
    ]);
    // Two rings for a satisfying oneshot
    const out = path.join(AUDIO, "old_phone_ring.wav");
    run([
      "-i",
      once,
      "-i",
      once,
      "-filter_complex",
      "[0:a][1:a]concat=n=2:v=0:a=1,afade=t=in:st=0:d=0.02,afade=t=out:st=10.8:d=0.4[a]",
      "-map",
      "[a]",
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
        "Rotary Phone Ring loopable (Freesound #556499 by cookies+policy, CC0)",
    });
    console.log("phone", probe(out).toFixed(2) + "s");
  }

  // --- Toy xylophone: trim start noise, faster taps ---
  {
    const raw = path.join(TMP, "xylo.mp3");
    await download(await fsPreview(501300), raw);
    const out = path.join(AUDIO, "xylophone.wav");
    run([
      "-ss",
      "0.35",
      "-t",
      "7.5",
      "-i",
      raw,
      "-af",
      "atempo=1.28,highpass=f=280,loudnorm=I=-16:TP=-1.5:LRA=8,afade=t=in:st=0:d=0.01,afade=t=out:st=5.5:d=0.35",
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
      attribution: "Toy Xylophone (Freesound #501300 by JappeHallunken, CC0, sped/trimmed)",
    });
    console.log("xylophone", probe(out).toFixed(2) + "s");
  }

  // --- Arcade cabinet boot: CRT power-on + attract jingle ---
  {
    const crtRaw = path.join(TMP, "crt.mp3");
    await download(await fsPreview(382312), crtRaw);
    const crt = path.join(TMP, "crt_cut.wav");
    run([
      "-t",
      "2.2",
      "-i",
      crtRaw,
      "-af",
      "highpass=f=40,loudnorm=I=-18:TP=-2:LRA=9",
      "-ac",
      "1",
      "-ar",
      "44100",
      crt,
    ]);
    const synthPath = path.join(TMP, "arcade_synth.wav");
    writeWav(synthPath, synthArcadeBoot());
    const out = path.join(AUDIO, "arcade_boot_jingle.wav");
    run([
      "-i",
      crt,
      "-i",
      synthPath,
      "-filter_complex",
      "[0:a]afade=t=out:st=1.6:d=0.5,volume=0.85[a0];[1:a]volume=0.9[a1];[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:st=0:d=0.01,afade=t=out:st=3.1:d=0.25[a]",
      "-map",
      "[a]",
      "-t",
      "3.4",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    cleanOld("arcade_boot_jingle");
    Object.assign(byId.arcade_boot_jingle, {
      path: "res://assets/audio/arcade_boot_jingle.wav",
      license: "CC0",
      attribution:
        "CRT monitor power-on (Freesound #382312 by dav0r, CC0) + original arcade attract jingle (StimPad, CC0)",
    });
    console.log("arcade_boot", probe(out).toFixed(2) + "s");
  }

  // --- Arcade chime: Pac-Man-inspired original chomp jingle ---
  {
    const out = path.join(AUDIO, "arcade_notify.wav");
    writeWav(out, synthPacChompChime());
    // normalize
    const tmp = path.join(TMP, "arcade_chime_n.wav");
    run([
      "-i",
      out,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=7",
      "-ac",
      "1",
      "-ar",
      "44100",
      tmp,
    ]);
    fs.copyFileSync(tmp, out);
    cleanOld("arcade_notify");
    Object.assign(byId.arcade_notify, {
      name: "Arcade Cabinet Chime",
      path: "res://assets/audio/arcade_notify.wav",
      license: "CC0",
      attribution:
        "Original Pac-Man-inspired chomp/start jingle (StimPad synth, CC0) — not an official Namco/Bandai Namco sound",
    });
    console.log("arcade_chime", probe(out).toFixed(2) + "s");
  }

  // --- Disc / Handheld / Home boots ---
  {
    const disc = path.join(AUDIO, "disc_console_boot.wav");
    writeWav(disc, synthDiscBoot());
    const discN = path.join(TMP, "disc_n.wav");
    run(["-i", disc, "-af", "loudnorm=I=-17:TP=-1.8:LRA=8", "-ac", "1", "-ar", "44100", discN]);
    fs.copyFileSync(discN, disc);
    cleanOld("disc_console_boot");
    Object.assign(byId.disc_console_boot, {
      path: "res://assets/audio/disc_console_boot.wav",
      license: "CC0",
      attribution:
        "Original PlayStation-era inspired disc-console boot (StimPad synth, CC0) — not an official Sony jingle",
    });
    console.log("disc", probe(disc).toFixed(2) + "s");
  }
  {
    const hh = path.join(AUDIO, "handheld_boot.wav");
    writeWav(hh, synthHandheldBoot());
    const hhN = path.join(TMP, "hh_n.wav");
    run(["-i", hh, "-af", "loudnorm=I=-16:TP=-1.5:LRA=7", "-ac", "1", "-ar", "44100", hhN]);
    fs.copyFileSync(hhN, hh);
    cleanOld("handheld_boot");
    Object.assign(byId.handheld_boot, {
      path: "res://assets/audio/handheld_boot.wav",
      license: "CC0",
      attribution:
        "Original Game Boy / GBA-inspired power-on (StimPad synth, CC0) — not an official Nintendo jingle",
    });
    console.log("handheld", probe(hh).toFixed(2) + "s");
  }
  {
    const home = path.join(AUDIO, "home_console_boot.wav");
    writeWav(home, synthHomeBoot());
    const homeN = path.join(TMP, "home_n.wav");
    run(["-i", home, "-af", "loudnorm=I=-17:TP=-1.8:LRA=8", "-ac", "1", "-ar", "44100", homeN]);
    fs.copyFileSync(homeN, home);
    cleanOld("home_console_boot");
    Object.assign(byId.home_console_boot, {
      path: "res://assets/audio/home_console_boot.wav",
      license: "CC0",
      attribution:
        "Original SNES-era inspired home-console power chord (StimPad synth, CC0) — not an official Nintendo jingle",
    });
    console.log("home", probe(home).toFixed(2) + "s");
  }

  await maskPhoneArt();

  fs.writeFileSync(SOUNDS, JSON.stringify(catalog, null, 2) + "\n");
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
