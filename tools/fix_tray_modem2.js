/**
 * Replace Disc Tray + Modem with cleaner quieter sources.
 * Tray: FS #556487 Disc drive open (dedicated, short)
 * Modem: FS #546450 classic line-in dial-up (headphone jack capture)
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_tray_modem2");
const SOUNDS = path.join(ROOT, "data", "sounds.json");
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

async function fsMeta(id) {
  const html = await get("https://freesound.org/s/" + id + "/");
  let lic = "?";
  if (/Creative Commons 0|CC0/i.test(html)) lic = "CC0";
  else if (/Attribution-NonCommercial|BY-NC/i.test(html)) lic = "BY-NC";
  else if (/Attribution/i.test(html)) lic = "CC BY";
  const m = html.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  if (!m) throw new Error("no preview " + id);
  const url = `https://cdn.freesound.org/previews/${Math.floor(Number(id) / 1000)}/${m[1]}-hq.mp3`;
  const title = ((html.match(/<h1[^>]*>([^<]+)/) || [])[1] || "").trim();
  return { lic, url, title };
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS, "utf8"));
  const byId = Object.fromEntries(catalog.sounds.map((s) => [s.id, s]));

  // --- Disc tray: dedicated short open ---
  const trayId = 556487;
  const trayMeta = await fsMeta(trayId);
  console.log("tray", trayId, trayMeta.lic, trayMeta.title);
  if (trayMeta.lic === "BY-NC") throw new Error("tray not commercial-safe");
  const trayRaw = path.join(TMP, "tray.mp3");
  await download(trayMeta.url, trayRaw);
  const trayOut = path.join(AUDIO, "unlock_chime.wav");
  // Mild level only — keep recognizable mechanical character, avoid blasting
  run([
    "-i",
    trayRaw,
    "-af",
    "highpass=f=80,loudnorm=I=-18:TP=-2.5:LRA=7",
    "-ac",
    "1",
    "-ar",
    "44100",
    trayOut,
  ]);
  Object.assign(byId.unlock_chime, {
    name: "Disc Tray Open",
    path: "res://assets/audio/unlock_chime.wav",
    license: trayMeta.lic === "CC0" ? "CC0" : "CC BY",
    attribution: "Disc drive open (Freesound #556487 by sed4906, " + trayMeta.lic + ")",
  });
  console.log("tray out", probe(trayOut).toFixed(2) + "s");

  // --- Modem: classic clean line-in capture ---
  let modemId = 546450;
  let modemMeta = await fsMeta(modemId);
  console.log("modem", modemId, modemMeta.lic, modemMeta.title);
  if (modemMeta.lic === "BY-NC") {
    modemId = 454651;
    modemMeta = await fsMeta(modemId);
    console.log("modem fallback", modemId, modemMeta.lic);
  }
  if (modemMeta.lic === "BY-NC") throw new Error("modem not commercial-safe");
  const modemRaw = path.join(TMP, "modem.mp3");
  await download(modemMeta.url, modemRaw);
  const modemOut = path.join(AUDIO, "modem_dial.wav");
  // Line-in captures are already clean — very light highpass only, no heavy denoise
  run([
    "-i",
    modemRaw,
    "-af",
    "highpass=f=120,lowpass=f=4200,loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ac",
    "1",
    "-ar",
    "44100",
    modemOut,
  ]);
  Object.assign(byId.modem_dial, {
    name: "Dial-Up Modem",
    path: "res://assets/audio/modem_dial.wav",
    license: modemMeta.lic === "CC0" ? "CC0" : "CC BY",
    attribution:
      modemId === 546450
        ? "Dial-up Internet handshake (Freesound #546450 by wtermini, " + modemMeta.lic + ")"
        : "14k modem dial-up connecting (Freesound #" + modemId + ", " + modemMeta.lic + ")",
  });
  console.log("modem out", probe(modemOut).toFixed(2) + "s");

  fs.writeFileSync(SOUNDS, JSON.stringify(catalog, null, 2) + "\n");
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
