/**
 * Fix disc tray + modem with cleaner sources.
 * Tray: FS #325730 PC Disk Drive Open and Close (open portion) if CC0,
 *       else FS #146958 open, else BY #619294.
 * Modem: FS #454651 with strong denoise, fallback SoundBible PD.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_tray_modem");
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
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-1000));
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
  const lic = /Creative Commons 0|CC0/i.test(html)
    ? "CC0"
    : /Attribution/i.test(html)
      ? "CC BY"
      : "?";
  const m = html.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  if (!m) throw new Error("no preview " + id);
  const url = `https://cdn.freesound.org/previews/${Math.floor(Number(id) / 1000)}/${m[1]}-hq.mp3`;
  return { lic, url };
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(SOUNDS, "utf8"));
  const byId = Object.fromEntries(catalog.sounds.map((s) => [s.id, s]));

  // --- Disc tray: prefer dedicated PC disk drive open/close ---
  let trayId = 325730;
  let trayMeta = await fsMeta(trayId);
  console.log("tray", trayId, trayMeta.lic);
  if (trayMeta.lic !== "CC0" && trayMeta.lic !== "CC BY") {
    trayId = 146958;
    trayMeta = await fsMeta(trayId);
  }
  const trayRaw = path.join(TMP, "tray.mp3");
  await download(trayMeta.url, trayRaw);
  const trayOut = path.join(AUDIO, "unlock_chime.wav");
  // Open portion only (first ~2.5–3.5s typical before close)
  run([
    "-i",
    trayRaw,
    "-t",
    trayId === 325730 ? "2.8" : "2.1",
    "-af",
    "highpass=f=90,afftdn=nr=12:nf=-30,loudnorm=I=-12:TP=-1:LRA=9",
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
    attribution:
      trayId === 325730
        ? "PC Disk Drive Open (Freesound #325730 by 15050_Francois, " + trayMeta.lic + ")"
        : "CD/DVD tray open (Freesound #" + trayId + ", " + trayMeta.lic + ")",
  });
  console.log("tray out", probe(trayOut).toFixed(2) + "s");

  // --- Modem: real 14k handshake, heavy denoise ---
  const modemMeta = await fsMeta(454651);
  const modemRaw = path.join(TMP, "modem.mp3");
  await download(modemMeta.url, modemRaw);
  const modemOut = path.join(AUDIO, "modem_dial.wav");
  run([
    "-i",
    modemRaw,
    "-af",
    "highpass=f=200,lowpass=f=3800,afftdn=nr=18:nf=-35,equalizer=f=1200:t=h:w=800:g=2,loudnorm=I=-14:TP=-1.2:LRA=10",
    "-ac",
    "1",
    "-ar",
    "44100",
    modemOut,
  ]);
  Object.assign(byId.modem_dial, {
    name: "Dial-Up Modem",
    path: "res://assets/audio/modem_dial.wav",
    license: "CC0",
    attribution: "14k modem dial-up connecting (Freesound #454651 by G_M_D_THREE, CC0)",
  });
  console.log("modem out", probe(modemOut).toFixed(2) + "s");

  for (const id of ["unlock_chime", "modem_dial"]) {
    for (const ext of ["mp3", "ogg"]) {
      const p = path.join(AUDIO, id + "." + ext);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }

  fs.writeFileSync(SOUNDS, JSON.stringify(catalog, null, 2) + "\n");
  console.log("Done audio fixes.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
