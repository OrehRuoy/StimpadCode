/**
 * Fix Relay Click start + replace Rotary Selector with clear radial knob clicks.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const TMP = path.join(AUDIO, "_tmp_fix_relay_rotary");
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
          return reject(new Error("HTTP " + res.statusCode));
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

async function fsPreview(id) {
  const html = await get("https://freesound.org/s/" + id + "/");
  let lic = "?";
  if (/Creative Commons 0|CC0/i.test(html)) lic = "CC0";
  else if (/Attribution-NonCommercial|BY-NC/i.test(html)) lic = "BY-NC";
  else if (/Attribution/i.test(html)) lic = "CC BY";
  if (lic === "BY-NC") throw new Error("BY-NC " + id);
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

  // --- Relay: re-pull and cut handling noise at the front ---
  const relayMeta = await fsPreview(807384);
  const relayRaw = path.join(TMP, "relay.mp3");
  await download(relayMeta.url, relayRaw);
  const relayOut = path.join(AUDIO, "relay_click.wav");
  // Skip quiet/handling lead-in; keep a clean burst of overload-relay snaps
  run([
    "-ss",
    "2.55",
    "-t",
    "5.4",
    "-i",
    relayRaw,
    "-af",
    "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-38dB:detection=peak,highpass=f=140,loudnorm=I=-14:TP=-1.2:LRA=7,afade=t=in:st=0:d=0.01,afade=t=out:st=5.1:d=0.25",
    "-ac",
    "1",
    "-ar",
    "44100",
    relayOut,
  ]);
  Object.assign(byId.relay_click, {
    attribution:
      "Siemens contactor / overload relay clicks (Freesound #807384 by tt_runscript, CC0)",
    license: "CC0",
    path: "res://assets/audio/relay_click.wav",
  });
  console.log("relay", probe(relayOut).toFixed(2) + "s");

  // --- Rotary: real radial knob stepped clicks (what a selector dial should sound like) ---
  const rotMeta = await fsPreview(643563);
  const rotRaw = path.join(TMP, "rotary.mp3");
  await download(rotMeta.url, rotRaw);
  const rotOut = path.join(AUDIO, "rotary_selector.wav");
  run([
    "-i",
    rotRaw,
    "-af",
    "highpass=f=100,loudnorm=I=-14:TP=-1.2:LRA=8,afade=t=in:st=0:d=0.02,afade=t=out:st=6.8:d=0.25",
    "-ac",
    "1",
    "-ar",
    "44100",
    rotOut,
  ]);
  Object.assign(byId.rotary_selector, {
    name: "Rotary Selector",
    attribution:
      "Radial knob clicks turning dial (Freesound #643563 by el_boss, " + rotMeta.lic + ")",
    license: rotMeta.lic === "CC0" ? "CC0" : "CC BY",
    path: "res://assets/audio/rotary_selector.wav",
  });
  console.log("rotary", probe(rotOut).toFixed(2) + "s", rotMeta.lic);

  fs.writeFileSync(SOUNDS, JSON.stringify(catalog, null, 2) + "\n");
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
