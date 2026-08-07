/**
 * Round 3: pure drill whir, better cassette, real CD tray, clean modem,
 * rename HDD hum → PC Fan Hum.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_r3");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const CSV = path.join(ROOT, "data", "sound_art_map.csv");
const QA = path.join(ROOT, "docs", "SOUND_QA.md");
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

async function fsUrl(id) {
  const html = await get("https://freesound.org/s/" + id + "/");
  const m = html.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  if (!m) throw new Error("no preview " + id);
  const stem = m[1];
  const folder = Math.floor(Number(id) / 1000);
  return `https://cdn.freesound.org/previews/${folder}/${stem}-hq.mp3`;
}

function rmOther(id, keep) {
  for (const ext of ["mp3", "ogg", "wav"]) {
    if (ext === keep) continue;
    const p = path.join(AUDIO, `${id}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

/** Acrossfade-loop a segment N times. */
function acrossfadeLoop(seg, dest, n, fade = 0.25) {
  const inputs = [];
  for (let i = 0; i < n; i++) inputs.push("-i", seg);
  let filter = "";
  let cur = "[0:a]";
  for (let i = 1; i < n; i++) {
    const out = i === n - 1 ? "[out]" : `[a${i}]`;
    filter += `${cur}[${i}:a]acrossfade=d=${fade}:c1=tri:c2=tri${out};`;
    cur = `[a${i}]`;
  }
  filter = filter.replace(/;$/, "");
  run([...inputs, "-filter_complex", filter, "-map", "[out]", dest]);
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const byId = Object.fromEntries(catalog.sounds.map((s) => [s.id, s]));

  // --- Drill: pure motor whir only (cordless FS #393422), held ~35s ---
  {
    const raw = path.join(TMP, "drill393.mp3");
    await download(await fsUrl(393422), raw);
    // Find a steady mid run: skip startup, take continuous motor, band-emphasize whir
    const seg = path.join(TMP, "drill_whir.wav");
    run([
      "-ss",
      "8",
      "-i",
      raw,
      "-t",
      "4.5",
      "-af",
      "highpass=f=120,lowpass=f=6000,equalizer=f=1800:t=h:w=1200:g=3,loudnorm=I=-14:TP=-1.2:LRA=5",
      "-ac",
      "1",
      "-ar",
      "44100",
      seg,
    ]);
    const out = path.join(AUDIO, "electric_drill.wav");
    acrossfadeLoop(seg, out, 9, 0.4);
    rmOther("electric_drill", "wav");
    Object.assign(byId.electric_drill, {
      name: "Electric Drill",
      path: "res://assets/audio/electric_drill.wav",
      license: "CC0",
      attribution: "Cordless drill motor whir (Freesound #393422, CC0) — held continuous loop",
    });
    console.log("electric_drill", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- Cassette: single door+insert cycle, then rewind (cleaner cuts) ---
  {
    const insert = path.join(TMP, "bsb0571.mp3");
    const rewind = path.join(TMP, "bsb0566.mp3");
    if (!fs.existsSync(insert))
      await download("https://bigsoundbank.com/UPLOAD/mp3/0571.mp3", insert);
    if (!fs.existsSync(rewind))
      await download("https://bigsoundbank.com/UPLOAD/mp3/0566.mp3", rewind);
    const a = path.join(TMP, "cass_in.wav");
    const b = path.join(TMP, "cass_rw.wav");
    // One door/insert/close (~first cycle ends ~9s before second open)
    run([
      "-i",
      insert,
      "-ss",
      "0.15",
      "-t",
      "8.8",
      "-af",
      "afade=t=in:st=0:d=0.05,afade=t=out:st=8.4:d=0.35,loudnorm=I=-15:TP=-1.5:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      a,
    ]);
    run([
      "-i",
      rewind,
      "-ss",
      "0.1",
      "-t",
      "3.6",
      "-af",
      "afade=t=in:st=0:d=0.05,afade=t=out:st=3.2:d=0.35,loudnorm=I=-15:TP=-1.5:LRA=11",
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
      "[0:a][1:a]concat=n=2:v=0:a=1,loudnorm=I=-15:TP=-1.5:LRA=11[out]",
      "-map",
      "[out]",
      out,
    ]);
    rmOther("cassette_deck", "wav");
    Object.assign(byId.cassette_deck, {
      name: "Cassette Deck",
      path: "res://assets/audio/cassette_deck.wav",
      license: "CC0",
      attribution: "Cassette door/insert (BSB #0571) + rewind (BSB #0566), CC0",
    });
    console.log("cassette_deck", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- Disc tray: BSB CD drive boot #4 is short tray mechanism; also try #1 open motion ---
  // Prefer longer CD player tray/boot #1 first ~3s which is the mechanical open/spin engage
  {
    const raw = path.join(TMP, "bsb2651.mp3");
    if (!fs.existsSync(raw))
      await download("https://bigsoundbank.com/UPLOAD/mp3/2651.mp3", raw);
    const out = path.join(AUDIO, "unlock_chime.wav");
    // CD player startup includes tray/drive engage — take the distinctive mechanical start
    run([
      "-i",
      raw,
      "-t",
      "4.5",
      "-af",
      "highpass=f=60,loudnorm=I=-14:TP=-1.2:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    // Also prepare alternate from 2654 (1.85s pure short tray) if needed — keep 2651 for length
    rmOther("unlock_chime", "wav");
    Object.assign(byId.unlock_chime, {
      name: "Disc Tray Open",
      path: "res://assets/audio/unlock_chime.wav",
      license: "CC0",
      attribution: "CD drive / tray mechanism (BigSoundBank #2651, CC0)",
    });
    console.log("unlock_chime", probe(out).toFixed(2) + "s", "max", maxVol(out));

    // Save short tray alt for comparison
    const altRaw = path.join(TMP, "bsb2654.mp3");
    if (!fs.existsSync(altRaw))
      await download("https://bigsoundbank.com/UPLOAD/mp3/2654.mp3", altRaw);
    const alt = path.join(TMP, "tray_alt_2654.wav");
    run([
      "-i",
      altRaw,
      "-af",
      "loudnorm=I=-14:TP=-1.2:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      alt,
    ]);
    console.log("tray_alt_2654", probe(alt).toFixed(2) + "s", "max", maxVol(alt));
  }

  // --- PC Fan Hum (rename) — steady computer running, NOT boot sequence ---
  {
    const raw = path.join(TMP, "fan0125.mp3");
    await download("https://bigsoundbank.com/UPLOAD/mp3/0125.mp3", raw);
    const seg = path.join(TMP, "fan_seg.wav");
    run([
      "-i",
      raw,
      "-af",
      "highpass=f=40,loudnorm=I=-18:TP=-2.5:LRA=6",
      "-ac",
      "1",
      "-ar",
      "44100",
      seg,
    ]);
    const out = path.join(AUDIO, "os_loading_hum.wav");
    acrossfadeLoop(seg, out, 6, 0.9);
    rmOther("os_loading_hum", "wav");
    Object.assign(byId.os_loading_hum, {
      name: "PC Fan Hum",
      path: "res://assets/audio/os_loading_hum.wav",
      mode: "loop",
      default_duration_sec: 60,
      license: "CC0",
      attribution:
        "Steady computer fan/PSU hum of a PC already running (BigSoundBank #0125, CC0) — different from PC Power On boot sequence",
    });
    console.log("os_loading_hum → PC Fan Hum", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  // --- Clean public-domain modem (Wikimedia / pdsounds) ---
  {
    const raw = path.join(TMP, "modem_wiki.ogg");
    if (!fs.existsSync(raw)) {
      await download(
        "https://upload.wikimedia.org/wikipedia/commons/4/4f/Dial_up_connection.ogg",
        raw
      );
    }
    const out = path.join(AUDIO, "modem_dial.wav");
    run([
      "-i",
      raw,
      "-af",
      "highpass=f=80,loudnorm=I=-14:TP=-1.2:LRA=11",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    rmOther("modem_dial", "wav");
    if (byId.modem_dial) {
      Object.assign(byId.modem_dial, {
        name: "Dial-Up Modem",
        path: "res://assets/audio/modem_dial.wav",
        license: "Public Domain / CC0",
        attribution:
          "Dial-up connection (ezwa / pdsounds via Wikimedia Commons, public domain)",
      });
    }
    console.log("modem_dial", probe(out).toFixed(2) + "s", "max", maxVol(out));
  }

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  if (fs.existsSync(CSV)) {
    let csv = fs.readFileSync(CSV, "utf8");
    csv = csv.replace(
      /os_loading_hum,"Hard Drive Boot Hum",os_loading_hum\.wav/,
      'os_loading_hum,"PC Fan Hum",os_loading_hum.wav'
    );
    csv = csv.replace(
      /os_loading_hum,"OS Boot Loading Hum".*/,
      'os_loading_hum,"PC Fan Hum",os_loading_hum.wav,os_loading_hum.png,plus,Retro'
    );
    fs.writeFileSync(CSV, csv);
  }

  fs.writeFileSync(
    QA,
    fs.readFileSync(QA, "utf8").replace(
      /\*\*Resume bookmark:.*\n/,
      "**Resume bookmark: Electric Drill / Disc Tray / console-boots decision** — listen fixes; decide whether to keep inspired console boots.\n"
    )
  );

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
